import { TaskStatusUpdateEvent } from "../../types.js";
import {
  ExecutionEventBus,
  AgentExecutionEvent,
} from "./execution_event_bus.js";

/**
 * 一个异步队列，订阅ExecutionEventBus的事件
 * 并提供异步生成器来消费这些事件。
 */
export class ExecutionEventQueue {
  private eventBus: ExecutionEventBus;
  private eventQueue: AgentExecutionEvent[] = [];
  private resolvePromise?: (value: void | PromiseLike<void>) => void;
  private stopped: boolean = false;
  private boundHandleEvent: (event: AgentExecutionEvent) => void;

  constructor(eventBus: ExecutionEventBus) {
    this.eventBus = eventBus;
    this.eventBus.on("event", this.handleEvent);
    this.eventBus.on("finished", this.handleFinished);
  }

  private handleEvent = (event: AgentExecutionEvent) => {
    if (this.stopped) return;
    this.eventQueue.push(event);
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = undefined;
    }
  };

  private handleFinished = () => {
    this.stop();
  };

  /**
   * 提供一个异步生成器，从事件总线中产生事件。
   * 当接收到Message事件或final=true的TaskStatusUpdateEvent时停止。
   */
  public async *events(): AsyncGenerator<AgentExecutionEvent, void, undefined> {
    while (!this.stopped || this.eventQueue.length > 0) {
      if (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        yield event;
        if (
          event.kind === "message" ||
          (event.kind === "status-update" &&
            (event as TaskStatusUpdateEvent).final)
        ) {
          this.handleFinished();
          break;
        }
      } else if (!this.stopped) {
        await new Promise<void>((resolve) => {
          this.resolvePromise = resolve;
        });
      }
    }
  }

  /**
   * 停止事件队列处理更多事件。
   */
  public stop(): void {
    this.stopped = true;
    if (this.resolvePromise) {
      this.resolvePromise(); // Unblock any pending await
      this.resolvePromise = undefined;
    }

    this.eventBus.off("event", this.handleEvent);
    this.eventBus.off("finished", this.handleFinished);
  }
}
