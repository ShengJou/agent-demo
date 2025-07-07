import { v4 as uuidv4 } from "uuid"; // 用于生成唯一ID

import {
  Message,
  AgentCard,
  PushNotificationConfig,
  Task,
  MessageSendParams,
  TaskState,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TaskQueryParams,
  TaskIdParams,
  TaskPushNotificationConfig,
} from "../../types.js";
import { AgentExecutor } from "../agent_execution/agent_executor.js";
import { RequestContext } from "../agent_execution/request_context.js";
import { A2AError } from "../error.js";
import {
  ExecutionEventBusManager,
  DefaultExecutionEventBusManager,
} from "../events/execution_event_bus_manager.js";
import { ExecutionEventBus } from "../events/execution_event_bus.js";
import { ExecutionEventQueue } from "../events/execution_event_queue.js";
import { ResultManager } from "../result_manager.js";
import { TaskStore } from "../store.js";
import { A2ARequestHandler } from "./a2a_request_handler.js";

const terminalStates: TaskState[] = [
  "completed",
  "failed",
  "canceled",
  "rejected",
];

export class DefaultRequestHandler implements A2ARequestHandler {
  private readonly agentCard: AgentCard;
  private readonly taskStore: TaskStore;
  private readonly agentExecutor: AgentExecutor;
  private readonly eventBusManager: ExecutionEventBusManager;
  // 存储推送通知配置（可以是TaskStore的一部分或单独的）
  private readonly pushNotificationConfigs: Map<
    string,
    PushNotificationConfig
  > = new Map();

  constructor(
    agentCard: AgentCard,
    taskStore: TaskStore,
    agentExecutor: AgentExecutor,
    eventBusManager: ExecutionEventBusManager = new DefaultExecutionEventBusManager()
  ) {
    this.agentCard = agentCard;
    this.taskStore = taskStore;
    this.agentExecutor = agentExecutor;
    this.eventBusManager = eventBusManager;
  }

  async getAgentCard(): Promise<AgentCard> {
    return this.agentCard;
  }

  private async _createRequestContext(
    incomingMessage: Message,
    taskId: string,
    isStream: boolean
  ): Promise<RequestContext> {
    let task: Task | undefined;
    let referenceTasks: Task[] | undefined;

    // 如果任务已存在，incomingMessage将包含taskId
    if (incomingMessage.taskId) {
      task = await this.taskStore.load(incomingMessage.taskId);
      if (!task) {
        throw A2AError.taskNotFound(incomingMessage.taskId);
      }

      if (terminalStates.includes(task.status.state)) {
        // 抛出符合JSON-RPC无效请求错误规范的错误
        throw A2AError.invalidRequest(
          `Task ${task.id} is in a terminal state (${task.status.state}) and cannot be modified.`
        );
      }
    }

    if (
      incomingMessage.referenceTaskIds &&
      incomingMessage.referenceTaskIds.length > 0
    ) {
      referenceTasks = [];
      for (const refId of incomingMessage.referenceTaskIds) {
        const refTask = await this.taskStore.load(refId);
        if (refTask) {
          referenceTasks.push(refTask);
        } else {
          console.warn(`Reference task ${refId} not found.`);
          // 可选：抛出错误或根据具体要求处理
        }
      }
    }

    // 确保contextId存在
    const messageForContext = { ...incomingMessage };
    if (!messageForContext.contextId) {
      messageForContext.contextId = task?.contextId || uuidv4();
    }

    const contextId = incomingMessage.contextId || uuidv4();

    return new RequestContext(
      messageForContext,
      taskId,
      contextId,
      task,
      referenceTasks
    );
  }

  private async _processEvents(
    taskId: string,
    resultManager: ResultManager,
    eventQueue: ExecutionEventQueue,
    options?: {
      firstResultResolver?: (
        value: Message | Task | PromiseLike<Message | Task>
      ) => void;
      firstResultRejector?: (reason?: any) => void;
    }
  ): Promise<void> {
    let firstResultSent = false;
    try {
      for await (const event of eventQueue.events()) {
        await resultManager.processEvent(event);

        if (options?.firstResultResolver && !firstResultSent) {
          if (event.kind === "message" || event.kind === "task") {
            options.firstResultResolver(event as Message | Task);
            firstResultSent = true;
          }
        }
      }
      if (options?.firstResultRejector && !firstResultSent) {
        options.firstResultRejector(
          A2AError.internalError(
            "Execution finished before a message or task was produced."
          )
        );
      }
    } catch (error) {
      console.error(`Event processing loop failed for task ${taskId}:`, error);
      if (options?.firstResultRejector && !firstResultSent) {
        options.firstResultRejector(error);
      }
      // 为阻塞情况重新抛出错误以便捕获
      throw error;
    } finally {
      this.eventBusManager.cleanupByTaskId(taskId);
    }
  }

  async sendMessage(params: MessageSendParams): Promise<Message | Task> {
    const incomingMessage = params.message;
    if (!incomingMessage.messageId) {
      throw A2AError.invalidParams("message.messageId is required.");
    }

    // 如果'blocking'没有明确设置为false，则默认为阻塞行为
    const isBlocking = params.configuration?.blocking !== false;
    const taskId = incomingMessage.taskId || uuidv4();

    // 在创建RequestContext之前实例化ResultManager
    const resultManager = new ResultManager(this.taskStore);
    resultManager.setContext(incomingMessage); // 为ResultManager设置上下文

    const requestContext = await this._createRequestContext(
      incomingMessage,
      taskId,
      false
    );
    // 使用来自requestContext的（可能已更新的）contextId
    const finalMessageForAgent = requestContext.userMessage;

    const eventBus = this.eventBusManager.createOrGetByTaskId(taskId);
    // EventQueue应该在代理执行开始之前附加到总线
    const eventQueue = new ExecutionEventQueue(eventBus);

    // 开始代理执行（非阻塞）
    // 它在后台运行并向eventBus发布事件
    this.agentExecutor.execute(requestContext, eventBus).catch((err) => {
      console.error(
        `Agent execution failed for message ${finalMessageForAgent.messageId}:`,
        err
      );
      // 发布一个合成错误事件，将由ResultManager处理
      // 并且也会为非阻塞调用解决firstResultPromise
      const errorTask: Task = {
        id: requestContext.task?.id || uuidv4(), // 使用现有任务ID或生成新的
        contextId: finalMessageForAgent.contextId!,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [
              { kind: "text", text: `Agent execution error: ${err.message}` },
            ],
            taskId: requestContext.task?.id,
            contextId: finalMessageForAgent.contextId!,
          },
          timestamp: new Date().toISOString(),
        },
        history: requestContext.task?.history
          ? [...requestContext.task.history]
          : [],
        kind: "task",
      };
      if (finalMessageForAgent) {
        // 将传入消息添加到历史记录
        if (
          !errorTask.history?.find(
            (m) => m.messageId === finalMessageForAgent.messageId
          )
        ) {
          errorTask.history?.push(finalMessageForAgent);
        }
      }
      eventBus.publish(errorTask);
      eventBus.publish({
        // 并发布最终状态更新
        kind: "status-update",
        taskId: errorTask.id,
        contextId: errorTask.contextId,
        status: errorTask.status,
        final: true,
      } as TaskStatusUpdateEvent);
      eventBus.finished();
    });

    if (isBlocking) {
      // 在阻塞模式下，等待完整处理完成
      await this._processEvents(taskId, resultManager, eventQueue);
      const finalResult = resultManager.getFinalResult();
      if (!finalResult) {
        throw A2AError.internalError(
          "Agent execution finished without a result, and no task context found."
        );
      }

      return finalResult;
    } else {
      // 在非阻塞模式下，返回一个将由fullProcessing解决的promise
      return new Promise<Message | Task>((resolve, reject) => {
        this._processEvents(taskId, resultManager, eventQueue, {
          firstResultResolver: resolve,
          firstResultRejector: reject,
        });
      });
    }
  }

  async *sendMessageStream(
    params: MessageSendParams
  ): AsyncGenerator<
    Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent,
    void,
    undefined
  > {
    const incomingMessage = params.message;
    if (!incomingMessage.messageId) {
      // 对于流，messageId可能由客户端设置，或者如果不存在则由服务器生成
      // 现在假设客户端提供它或抛出错误
      throw A2AError.invalidParams(
        "message.messageId is required for streaming."
      );
    }

    const taskId = incomingMessage.taskId || uuidv4();

    // 在创建RequestContext之前实例化ResultManager
    const resultManager = new ResultManager(this.taskStore);
    resultManager.setContext(incomingMessage); // 为ResultManager设置上下文

    const requestContext = await this._createRequestContext(
      incomingMessage,
      taskId,
      true
    );
    const finalMessageForAgent = requestContext.userMessage;

    const eventBus = this.eventBusManager.createOrGetByTaskId(taskId);
    const eventQueue = new ExecutionEventQueue(eventBus);

    // 开始代理执行（非阻塞）
    this.agentExecutor.execute(requestContext, eventBus).catch((err) => {
      console.error(
        `Agent execution failed for stream message ${finalMessageForAgent.messageId}:`,
        err
      );
      // 如果需要，发布合成错误事件
      const errorTaskStatus: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: requestContext.task?.id || uuidv4(), // 使用现有的或占位符
        contextId: finalMessageForAgent.contextId!,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [
              { kind: "text", text: `Agent execution error: ${err.message}` },
            ],
            taskId: requestContext.task?.id,
            contextId: finalMessageForAgent.contextId!,
          },
          timestamp: new Date().toISOString(),
        },
        final: true, // 这将终止客户端的流
      };
      eventBus.publish(errorTaskStatus);
    });

    try {
      for await (const event of eventQueue.events()) {
        await resultManager.processEvent(event); // 在后台更新存储
        yield event; // 将事件流式传输给客户端
      }
    } finally {
      // 当流完全消耗或中断时清理
      this.eventBusManager.cleanupByTaskId(taskId);
    }
  }

  async getTask(params: TaskQueryParams): Promise<Task> {
    const task = await this.taskStore.load(params.id);
    if (!task) {
      throw A2AError.taskNotFound(params.id);
    }
    if (params.historyLength !== undefined && params.historyLength >= 0) {
      if (task.history) {
        task.history = task.history.slice(-params.historyLength);
      }
    } else {
      // 负数或无效的historyLength意味着没有历史记录
      task.history = [];
    }
    return task;
  }

  async cancelTask(params: TaskIdParams): Promise<Task> {
    const task = await this.taskStore.load(params.id);
    if (!task) {
      throw A2AError.taskNotFound(params.id);
    }

    // 检查任务是否处于可取消状态
    const nonCancelableStates = ["completed", "failed", "canceled", "rejected"];
    if (nonCancelableStates.includes(task.status.state)) {
      throw A2AError.taskNotCancelable(params.id);
    }

    const eventBus = this.eventBusManager.getByTaskId(params.id);

    if (eventBus) {
      await this.agentExecutor.cancelTask(params.id, eventBus);
    } else {
      // 这里我们将任务标记为已取消。我们不等待执行器实际取消处理
      task.status = {
        state: "canceled",
        message: {
          // 可选：添加指示取消的系统消息
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [
            { kind: "text", text: "Task cancellation requested by user." },
          ],
          taskId: task.id,
          contextId: task.contextId,
        },
        timestamp: new Date().toISOString(),
      };
      // 将取消消息添加到历史记录
      task.history = [...(task.history || []), task.status.message];

      await this.taskStore.save(task);
    }

    const latestTask = await this.taskStore.load(params.id);
    return latestTask;
  }

  async setTaskPushNotificationConfig(
    params: TaskPushNotificationConfig
  ): Promise<TaskPushNotificationConfig> {
    if (!this.agentCard.capabilities.pushNotifications) {
      throw A2AError.pushNotificationNotSupported();
    }
    const taskAndHistory = await this.taskStore.load(params.taskId);
    if (!taskAndHistory) {
      throw A2AError.taskNotFound(params.taskId);
    }
    // 存储配置。在真实应用中，这可能存储在TaskStore中
    // 或专用的推送通知服务
    this.pushNotificationConfigs.set(
      params.taskId,
      params.pushNotificationConfig
    );
    return params;
  }

  async getTaskPushNotificationConfig(
    params: TaskIdParams
  ): Promise<TaskPushNotificationConfig> {
    if (!this.agentCard.capabilities.pushNotifications) {
      throw A2AError.pushNotificationNotSupported();
    }
    const taskAndHistory = await this.taskStore.load(params.id); // 确保任务存在
    if (!taskAndHistory) {
      throw A2AError.taskNotFound(params.id);
    }
    const config = this.pushNotificationConfigs.get(params.id);
    if (!config) {
      throw A2AError.internalError(
        `Push notification config not found for task ${params.id}.`
      );
    }
    return { taskId: params.id, pushNotificationConfig: config };
  }

  async *resubscribe(params: TaskIdParams): AsyncGenerator<
    | Task // 初始任务状态
    | TaskStatusUpdateEvent
    | TaskArtifactUpdateEvent,
    void,
    undefined
  > {
    if (!this.agentCard.capabilities.streaming) {
      throw A2AError.unsupportedOperation(
        "Streaming (and thus resubscription) is not supported."
      );
    }

    const task = await this.taskStore.load(params.id);
    if (!task) {
      throw A2AError.taskNotFound(params.id);
    }

    // 首先yield当前任务状态
    yield task;

    // 如果任务已处于最终状态，则不会再有事件
    const finalStates = ["completed", "failed", "canceled", "rejected"];
    if (finalStates.includes(task.status.state)) {
      return;
    }

    const eventBus = this.eventBusManager.getByTaskId(params.id);
    if (!eventBus) {
      // 此任务没有活动执行，因此没有实时事件
      console.warn(`Resubscribe: No active event bus for task ${params.id}.`);
      return;
    }

    // 为此重新订阅将新队列附加到现有总线
    const eventQueue = new ExecutionEventQueue(eventBus);
    // 注意：ResultManager部分已由原始执行流程处理
    // 重新订阅只是监听新事件

    try {
      for await (const event of eventQueue.events()) {
        // 我们只关心与*此*任务相关的更新
        // 如果messageId被重用，事件总线可能是共享的
        // ExecutionEventBusManager尝试为每个原始消息提供一个总线
        if (event.kind === "status-update" && event.taskId === params.id) {
          yield event as TaskStatusUpdateEvent;
        } else if (
          event.kind === "artifact-update" &&
          event.taskId === params.id
        ) {
          yield event as TaskArtifactUpdateEvent;
        } else if (event.kind === "task" && event.id === params.id) {
          // 这意味着任务被重新发出，yield它
          yield event as Task;
        }
        // 我们通常不会在重新订阅时yield 'message'事件，
        // 因为这些信号表示*原始*请求的交互结束
        // 如果原始请求的'message'事件终止总线，此循环也将结束
      }
    } finally {
      eventQueue.stop();
    }
  }
}
