import {
  DefaultExecutionEventBus,
  ExecutionEventBus,
} from "./execution_event_bus.js";

export interface ExecutionEventBusManager {
  createOrGetByTaskId(taskId: string): ExecutionEventBus;
  getByTaskId(taskId: string): ExecutionEventBus | undefined;
  cleanupByTaskId(taskId: string): void;
}

export class DefaultExecutionEventBusManager
  implements ExecutionEventBusManager
{
  private taskIdToBus: Map<string, ExecutionEventBus> = new Map();

  /**
   * 根据taskId创建或检索现有的ExecutionEventBus。
   * @param taskId 任务的ID。
   * @returns ExecutionEventBus的实例。
   */
  public createOrGetByTaskId(taskId: string): ExecutionEventBus {
    if (!this.taskIdToBus.has(taskId)) {
      this.taskIdToBus.set(taskId, new DefaultExecutionEventBus());
    }
    return this.taskIdToBus.get(taskId)!;
  }

  /**
   * 根据taskId检索现有的ExecutionEventBus。
   * @param taskId 任务的ID。
   * @returns ExecutionEventBus的实例，如果未找到则返回undefined。
   */
  public getByTaskId(taskId: string): ExecutionEventBus | undefined {
    return this.taskIdToBus.get(taskId);
  }

  /**
   * 移除给定taskId的事件总线。
   * 当执行流程完成时应调用此方法来释放资源。
   * @param taskId 任务的ID。
   */
  public cleanupByTaskId(taskId: string): void {
    const bus = this.taskIdToBus.get(taskId);
    if (bus) {
      bus.removeAllListeners();
    }
    this.taskIdToBus.delete(taskId);
  }
}
