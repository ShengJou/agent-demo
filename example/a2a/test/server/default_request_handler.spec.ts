import "mocha";
import { assert, expect } from "chai";
import sinon, { SinonStub, SinonFakeTimers } from "sinon";

import { AgentExecutor } from "../../src/lib/server/agent_execution/agent_executor.js";
import {
  RequestContext,
  ExecutionEventBus,
  TaskStore,
  InMemoryTaskStore,
  DefaultRequestHandler,
  AgentCard,
  Artifact,
  Message,
  MessageSendParams,
  PushNotificationConfig,
  Task,
  TaskIdParams,
  TaskPushNotificationConfig,
  TaskState,
  TaskStatusUpdateEvent,
} from "../../src/lib/index.js";
import {
  DefaultExecutionEventBusManager,
  ExecutionEventBusManager,
} from "../../src/lib/server/events/execution_event_bus_manager.js";
import { A2ARequestHandler } from "../../src/lib/server/request_handler/a2a_request_handler.js";

/**
 * 用于取消测试的AgentExecutor的真实模拟实现。
 */
class CancellableMockAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private clock: SinonFakeTimers;

  constructor(clock: SinonFakeTimers) {
    this.clock = clock;
  }

  public execute = async (
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    eventBus.publish({
      id: taskId,
      contextId,
      status: { state: "submitted" },
      kind: "task",
    });
    eventBus.publish({
      taskId,
      contextId,
      kind: "status-update",
      status: { state: "working" },
      final: false,
    });

    // 模拟长时间运行的过程
    for (let i = 0; i < 5; i++) {
      if (this.cancelledTasks.has(taskId)) {
        eventBus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "canceled" },
          final: true,
        });
        eventBus.finished();
        return;
      }
      // 使用假计时器模拟工作
      await this.clock.tickAsync(100);
    }

    eventBus.publish({
      taskId,
      contextId,
      kind: "status-update",
      status: { state: "completed" },
      final: true,
    });
    eventBus.finished();
  };

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // execute循环负责发布最终状态
  };

  // 用于监视cancelTask调用的存根
  public cancelTaskSpy = sinon.spy(this, "cancelTask");
}

describe("DefaultRequestHandler as A2ARequestHandler", () => {
  let handler: A2ARequestHandler;
  let mockTaskStore: TaskStore;
  let mockAgentExecutor: AgentExecutor;
  let executionEventBusManager: ExecutionEventBusManager;
  let clock: SinonFakeTimers;

  const testAgentCard: AgentCard = {
    name: "Test Agent",
    description: "An agent for testing purposes",
    url: "http://localhost:8080",
    version: "1.0.0",
    capabilities: {
      streaming: true,
      pushNotifications: true,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "test-skill",
        name: "Test Skill",
        description: "A skill for testing",
        tags: ["test"],
      },
    ],
  };

  // 在每个测试之前，将组件重置为干净状态
  beforeEach(() => {
    mockTaskStore = new InMemoryTaskStore();
    // 大多数测试的默认模拟
    mockAgentExecutor = new MockAgentExecutor();
    executionEventBusManager = new DefaultExecutionEventBusManager();
    handler = new DefaultRequestHandler(
      testAgentCard,
      mockTaskStore,
      mockAgentExecutor,
      executionEventBusManager
    );
  });

  // 在每个测试之后，恢复任何sinon假对象或存根
  afterEach(() => {
    sinon.restore();
    if (clock) {
      clock.restore();
    }
  });

  // 用于创建基本用户消息的辅助函数
  const createTestMessage = (id: string, text: string): Message => ({
    messageId: id,
    role: "user",
    parts: [{ kind: "text", text }],
    kind: "message",
  });

  /**
   * AgentExecutor的模拟实现，用于在测试期间控制代理行为。
   */
  class MockAgentExecutor implements AgentExecutor {
    // 用于控制和检查对execute和cancelTask调用的存根
    public execute: SinonStub<
      [RequestContext, ExecutionEventBus],
      Promise<void>
    > = sinon.stub();
    public cancelTask: SinonStub<[string, ExecutionEventBus], Promise<void>> =
      sinon.stub();
  }

  it("sendMessage: should return a simple message response", async () => {
    const params: MessageSendParams = {
      message: createTestMessage("msg-1", "Hello"),
    };

    const agentResponse: Message = {
      messageId: "agent-msg-1",
      role: "agent",
      parts: [{ kind: "text", text: "Hi there!" }],
      kind: "message",
    };

    (mockAgentExecutor as MockAgentExecutor).execute.callsFake(
      async (ctx, bus) => {
        bus.publish(agentResponse);
        bus.finished();
      }
    );

    const result = await handler.sendMessage(params);

    assert.deepEqual(result, agentResponse, "结果应该是代理的消息");
    assert.isTrue(
      (mockAgentExecutor as MockAgentExecutor).execute.calledOnce,
      "AgentExecutor.execute应该被调用一次"
    );
  });

  it("sendMessage: (blocking) should return a task in a completed state with an artifact", async () => {
    const params: MessageSendParams = {
      message: createTestMessage("msg-2", "Do a task"),
    };

    const taskId = "task-123";
    const contextId = "ctx-abc";
    const testArtifact: Artifact = {
      artifactId: "artifact-1",
      name: "Test Document",
      description: "A test artifact.",
      parts: [{ kind: "text", text: "This is the content of the artifact." }],
    };

    (mockAgentExecutor as MockAgentExecutor).execute.callsFake(
      async (ctx, bus) => {
        bus.publish({
          id: taskId,
          contextId,
          status: { state: "submitted" },
          kind: "task",
        });
        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "working" },
          final: false,
        });
        bus.publish({
          taskId,
          contextId,
          kind: "artifact-update",
          artifact: testArtifact,
        });
        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ kind: "text", text: "Done!" }],
              messageId: "agent-msg-2",
              kind: "message",
            },
          },
          final: true,
        });
        bus.finished();
      }
    );

    const result = await handler.sendMessage(params);
    const taskResult = result as Task;

    assert.equal(taskResult.kind, "task");
    assert.equal(taskResult.id, taskId);
    assert.equal(taskResult.status.state, "completed");
    assert.isDefined(taskResult.artifacts, "任务结果应该有工件");
    assert.isArray(taskResult.artifacts);
    assert.lengthOf(taskResult.artifacts!, 1);
    assert.deepEqual(taskResult.artifacts![0], testArtifact);
  });

  it("sendMessage: should handle agent execution failure for blocking calls", async () => {
    const errorMessage = "Agent failed!";
    (mockAgentExecutor as MockAgentExecutor).execute.rejects(
      new Error(errorMessage)
    );

    // 测试阻塞情况
    const blockingParams: MessageSendParams = {
      message: createTestMessage("msg-fail-block", "Test failure blocking"),
    };

    const blockingResult = await handler.sendMessage(blockingParams);
    const blockingTask = blockingResult as Task;
    assert.equal(blockingTask.kind, "task", "结果应该是一个任务");
    assert.equal(blockingTask.status.state, "failed", "任务状态应该是失败");
    assert.include(
      (blockingTask.status.message?.parts[0] as any).text,
      errorMessage,
      "错误消息应该在状态中"
    );
  });

  it("sendMessage: (non-blocking) should return first task event immediately and process full task in background", async () => {
    clock = sinon.useFakeTimers();
    const saveSpy = sinon.spy(mockTaskStore, "save");

    const params: MessageSendParams = {
      message: createTestMessage("msg-nonblock", "Do a long task"),
      configuration: { blocking: false, acceptedOutputModes: [] },
    };

    const taskId = "task-nonblock-123";
    const contextId = "ctx-nonblock-abc";

    (mockAgentExecutor as MockAgentExecutor).execute.callsFake(
      async (ctx, bus) => {
        // 第一个事件是任务创建，应该立即返回
        bus.publish({
          id: taskId,
          contextId,
          status: { state: "submitted" },
          kind: "task",
        });

        // 在发布更多事件之前模拟工作
        await clock.tickAsync(500);

        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "completed" },
          final: true,
        });
        bus.finished();
      }
    );

    // 一旦发布第一个'task'事件，此调用应该立即返回
    const immediateResult = await handler.sendMessage(params);

    // 断言我们立即得到了初始任务对象
    const taskResult = immediateResult as Task;
    assert.equal(taskResult.kind, "task");
    assert.equal(taskResult.id, taskId);
    assert.equal(
      taskResult.status.state,
      "submitted",
      "应该立即以'submitted'状态返回"
    );

    // 后台处理尚未完成
    assert.isTrue(saveSpy.calledOnce, "应该为初始任务创建调用Save");
    assert.equal(saveSpy.firstCall.args[0].status.state, "submitted");

    // 允许后台处理完成
    await clock.runAllAsync();

    // 现在，检查存储中的最终状态以确保后台处理完成
    const finalTask = await mockTaskStore.load(taskId);
    assert.isDefined(finalTask);
    assert.equal(
      finalTask!.status.state,
      "completed",
      "后台处理完成后，存储中的任务应该是'completed'"
    );
    assert.isTrue(
      saveSpy.calledTwice,
      "Save应该被调用两次（submitted和completed）"
    );
    assert.equal(saveSpy.secondCall.args[0].status.state, "completed");
  });

  it("sendMessage: should handle agent execution failure for non-blocking calls", async () => {
    const errorMessage = "Agent failed!";
    (mockAgentExecutor as MockAgentExecutor).execute.rejects(
      new Error(errorMessage)
    );

    // 测试非阻塞情况
    const nonBlockingParams: MessageSendParams = {
      message: createTestMessage(
        "msg-fail-nonblock",
        "Test failure non-blocking"
      ),
      configuration: { blocking: false, acceptedOutputModes: [] },
    };

    const nonBlockingResult = await handler.sendMessage(nonBlockingParams);
    const nonBlockingTask = nonBlockingResult as Task;
    assert.equal(nonBlockingTask.kind, "task", "结果应该是一个任务");
    assert.equal(nonBlockingTask.status.state, "failed", "任务状态应该是失败");
    assert.include(
      (nonBlockingTask.status.message?.parts[0] as any).text,
      errorMessage,
      "错误消息应该在状态中"
    );
  });

  it("sendMessageStream: should stream submitted, working, and completed events", async () => {
    const params: MessageSendParams = {
      message: createTestMessage("msg-3", "Stream a task"),
    };
    const taskId = "task-stream-1";
    const contextId = "ctx-stream-1";

    (mockAgentExecutor as MockAgentExecutor).execute.callsFake(
      async (ctx, bus) => {
        bus.publish({
          id: taskId,
          contextId,
          status: { state: "submitted" },
          kind: "task",
        });
        await new Promise((res) => setTimeout(res, 10));
        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "working" },
          final: false,
        });
        await new Promise((res) => setTimeout(res, 10));
        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "completed" },
          final: true,
        });
        bus.finished();
      }
    );

    const eventGenerator = handler.sendMessageStream(params);
    const events: any[] = [];
    for await (const event of eventGenerator) {
      events.push(event);
    }

    assert.lengthOf(events, 3, "流应该产生3个事件");
    assert.equal((events[0] as Task).status.state, "submitted");
    assert.equal((events[1] as TaskStatusUpdateEvent).status.state, "working");
    assert.equal(
      (events[2] as TaskStatusUpdateEvent).status.state,
      "completed"
    );
    assert.isTrue((events[2] as TaskStatusUpdateEvent).final);
  });

  it("sendMessage: should reject if task is in a terminal state", async () => {
    const taskId = "task-terminal-1";
    const terminalStates: TaskState[] = [
      "completed",
      "failed",
      "canceled",
      "rejected",
    ];

    for (const state of terminalStates) {
      const fakeTask: Task = {
        id: taskId,
        contextId: "ctx-terminal",
        status: { state: state as TaskState },
        kind: "task",
      };
      await mockTaskStore.save(fakeTask);

      const params: MessageSendParams = {
        message: { ...createTestMessage("msg-1", "test"), taskId: taskId },
      };

      try {
        await handler.sendMessage(params);
        assert.fail(`状态为${state}时应该抛出异常`);
      } catch (error: any) {
        expect(error.code).to.equal(-32600); // Invalid Request
        expect(error.message).to.contain(
          `Task ${taskId} is in a terminal state (${state}) and cannot be modified.`
        );
      }
    }
  });

  it("sendMessageStream: should reject if task is in a terminal state", async () => {
    const taskId = "task-terminal-2";
    const fakeTask: Task = {
      id: taskId,
      contextId: "ctx-terminal-stream",
      status: { state: "completed" },
      kind: "task",
    };
    await mockTaskStore.save(fakeTask);

    const params: MessageSendParams = {
      message: { ...createTestMessage("msg-1", "test"), taskId: taskId },
    };

    const generator = handler.sendMessageStream(params);

    try {
      await generator.next();
      assert.fail("sendMessageStream应该抛出错误");
    } catch (error: any) {
      expect(error.code).to.equal(-32600);
      expect(error.message).to.contain(
        `Task ${taskId} is in a terminal state (completed) and cannot be modified.`
      );
    }
  });

  it("sendMessageStream: should stop at input-required state", async () => {
    const params: MessageSendParams = {
      message: createTestMessage("msg-4", "I need input"),
    };
    const taskId = "task-input";
    const contextId = "ctx-input";

    (mockAgentExecutor as MockAgentExecutor).execute.callsFake(
      async (ctx, bus) => {
        bus.publish({
          id: taskId,
          contextId,
          status: { state: "submitted" },
          kind: "task",
        });
        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "input-required" },
          final: true,
        });
        bus.finished();
      }
    );

    const eventGenerator = handler.sendMessageStream(params);
    const events: any[] = [];
    for await (const event of eventGenerator) {
      events.push(event);
    }

    assert.lengthOf(events, 2);
    const lastEvent = events[1] as TaskStatusUpdateEvent;
    assert.equal(lastEvent.status.state, "input-required");
    assert.isTrue(lastEvent.final);
  });

  it("resubscribe: should allow multiple clients to receive events for the same task", async () => {
    const saveSpy = sinon.spy(mockTaskStore, "save");
    clock = sinon.useFakeTimers();
    const params: MessageSendParams = {
      message: createTestMessage("msg-5", "Long running task"),
    };

    let taskId;
    let contextId;

    (mockAgentExecutor as MockAgentExecutor).execute.callsFake(
      async (ctx, bus) => {
        taskId = ctx.taskId;
        contextId = ctx.contextId;

        bus.publish({
          id: taskId,
          contextId,
          status: { state: "submitted" },
          kind: "task",
        });
        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "working" },
          final: false,
        });
        await clock.tickAsync(100);
        bus.publish({
          taskId,
          contextId,
          kind: "status-update",
          status: { state: "completed" },
          final: true,
        });
        bus.finished();
      }
    );

    const stream1_generator = handler.sendMessageStream(params);
    const stream1_iterator = stream1_generator[Symbol.asyncIterator]();

    const firstEventResult = await stream1_iterator.next();
    const firstEvent = firstEventResult.value as Task;
    assert.equal(firstEvent.id, taskId, "应该首先获得任务事件");

    const secondEventResult = await stream1_iterator.next();
    const secondEvent = secondEventResult.value as TaskStatusUpdateEvent;
    assert.equal(secondEvent.taskId, taskId, "应该第二个获得任务状态更新事件");

    const stream2_generator = handler.resubscribe({ id: taskId });

    const results1: any[] = [firstEvent, secondEvent];
    const results2: any[] = [];

    const collect = async (iterator: AsyncGenerator<any>, results: any[]) => {
      for await (const res of iterator) {
        results.push(res);
      }
    };

    const p1 = collect(stream1_iterator, results1);
    const p2 = collect(stream2_generator, results2);

    await clock.runAllAsync();
    await Promise.all([p1, p2]);

    assert.equal(
      (results1[0] as TaskStatusUpdateEvent).status.state,
      "submitted"
    );
    assert.equal(
      (results1[1] as TaskStatusUpdateEvent).status.state,
      "working"
    );
    assert.equal(
      (results1[2] as TaskStatusUpdateEvent).status.state,
      "completed"
    );

    // 重新订阅的第一个事件总是任务。
    assert.equal((results2[0] as Task).status.state, "working");
    assert.equal(
      (results2[1] as TaskStatusUpdateEvent).status.state,
      "completed"
    );

    assert.isTrue(saveSpy.calledThrice, "TaskStore.save应该被调用3次");
    const lastSaveCall = saveSpy.lastCall.args[0];
    assert.equal(lastSaveCall.id, taskId);
    assert.equal(lastSaveCall.status.state, "completed");
  });

  it("getTask: should return an existing task from the store", async () => {
    const fakeTask: Task = {
      id: "task-exist",
      contextId: "ctx-exist",
      status: { state: "working" },
      kind: "task",
      history: [],
    };
    await mockTaskStore.save(fakeTask);

    const result = await handler.getTask({ id: "task-exist" });
    assert.deepEqual(result, fakeTask);
  });

  it("set/getTaskPushNotificationConfig: should save and retrieve config", async () => {
    const taskId = "task-push-config";
    const fakeTask: Task = {
      id: taskId,
      contextId: "ctx-push",
      status: { state: "working" },
      kind: "task",
    };
    await mockTaskStore.save(fakeTask);

    const pushConfig: PushNotificationConfig = {
      url: "https://example.com/notify",
      token: "secret-token",
    };

    const setParams: TaskPushNotificationConfig = {
      taskId,
      pushNotificationConfig: pushConfig,
    };
    const setResponse = await handler.setTaskPushNotificationConfig(setParams);
    assert.deepEqual(
      setResponse.pushNotificationConfig,
      pushConfig,
      "设置响应应该返回配置"
    );

    const getParams: TaskIdParams = { id: taskId };
    const getResponse = await handler.getTaskPushNotificationConfig(getParams);
    assert.deepEqual(
      getResponse.pushNotificationConfig,
      pushConfig,
      "获取响应应该返回保存的配置"
    );
  });

  it("cancelTask: should cancel a running task and notify listeners", async () => {
    clock = sinon.useFakeTimers();
    // 为此特定测试使用更高级的模拟
    const cancellableExecutor = new CancellableMockAgentExecutor(clock);
    handler = new DefaultRequestHandler(
      testAgentCard,
      mockTaskStore,
      cancellableExecutor,
      executionEventBusManager
    );

    const streamParams: MessageSendParams = {
      message: createTestMessage("msg-9", "Start and cancel"),
    };
    const streamGenerator = handler.sendMessageStream(streamParams);

    const streamEvents: any[] = [];
    const streamingPromise = (async () => {
      for await (const event of streamGenerator) {
        streamEvents.push(event);
      }
    })();

    // 允许任务被创建并进入'working'状态
    await clock.tickAsync(150);

    const createdTask = streamEvents.find((e) => e.kind === "task") as Task;
    assert.isDefined(createdTask, "应该收到任务创建事件");
    const taskId = createdTask.id;

    // 现在，发出取消请求
    const cancelResponse = await handler.cancelTask({ id: taskId });

    // 让执行器的循环运行完成以检测取消
    await clock.runAllAsync();
    await streamingPromise;

    assert.isTrue(
      cancellableExecutor.cancelTaskSpy.calledOnceWith(taskId, sinon.match.any)
    );

    const lastEvent = streamEvents[
      streamEvents.length - 1
    ] as TaskStatusUpdateEvent;
    assert.equal(lastEvent.status.state, "canceled");

    const finalTask = await handler.getTask({ id: taskId });
    assert.equal(finalTask.status.state, "canceled");

    // 取消的API向执行器发出取消请求并返回最新的任务状态。
    // 在这种情况下，执行器正在等待时钟检测任务已被取消。
    // 虽然取消API已返回最新任务状态 => Working。
    assert.equal(cancelResponse.status.state, "working");
  });

  it("cancelTask: should fail for tasks in a terminal state", async () => {
    const taskId = "task-terminal";
    const fakeTask: Task = {
      id: taskId,
      contextId: "ctx-terminal",
      status: { state: "completed" },
      kind: "task",
    };
    await mockTaskStore.save(fakeTask);

    try {
      await handler.cancelTask({ id: taskId });
      assert.fail("应该抛出TaskNotCancelableError");
    } catch (error: any) {
      assert.equal(error.code, -32002);
      expect(error.message).to.contain("Task not cancelable");
    }
    assert.isFalse((mockAgentExecutor as MockAgentExecutor).cancelTask.called);
  });
});
