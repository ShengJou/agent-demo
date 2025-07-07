import { ExecutionEventBus } from "../events/execution_event_bus.js";
import { RequestContext } from "./request_context.js";

export interface AgentExecutor {
  /**
   * 基于请求上下文执行代理逻辑并发布事件。
   * @param requestContext 当前请求的上下文。
   * @param eventBus 用于发布执行事件的事件总线。
   */
  execute: (
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ) => Promise<void>;

  /**
   * 明确取消正在运行的任务的方法。
   * 实现应处理停止执行的逻辑，
   * 并在提供的事件总线上发布最终的'canceled'状态事件。
   * @param taskId 要取消的任务ID。
   * @param eventBus 与任务执行关联的事件总线。
   */
  cancelTask: (taskId: string, eventBus: ExecutionEventBus) => Promise<void>;
}
