import { EventEmitter } from "events";

import {
  Message,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
} from "../../types.js";

/**
 * 代理执行过程中可能产生的所有事件类型。
 */
export type AgentExecutionEvent =
  | Message
  | Task
  | TaskStatusUpdateEvent
  | TaskArtifactUpdateEvent;

/**
 * 执行事件总线接口，用于发布和监听代理执行事件。
 */
export interface ExecutionEventBus {
  publish(event: AgentExecutionEvent): void;
  on(
    eventName: "event" | "finished",
    listener: (event: AgentExecutionEvent) => void
  ): this;
  off(
    eventName: "event" | "finished",
    listener: (event: AgentExecutionEvent) => void
  ): this;
  once(
    eventName: "event" | "finished",
    listener: (event: AgentExecutionEvent) => void
  ): this;
  removeAllListeners(eventName?: "event" | "finished"): this;
  finished(): void;
}

/**
 * 默认的执行事件总线实现，基于Node.js的EventEmitter。
 */
export class DefaultExecutionEventBus
  extends EventEmitter
  implements ExecutionEventBus
{
  constructor() {
    super();
  }

  /**
   * 发布一个代理执行事件。
   * @param event 要发布的事件
   */
  publish(event: AgentExecutionEvent): void {
    this.emit("event", event);
  }

  /**
   * 标记事件总线执行完成。
   */
  finished(): void {
    this.emit("finished");
  }
}
