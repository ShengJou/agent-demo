import { Message, Task } from "../../types.js";

/**
 * 请求上下文类，封装了处理请求所需的所有信息。
 */
export class RequestContext {
  public readonly userMessage: Message; // 用户消息
  public readonly task?: Task; // 关联的任务（可选）
  public readonly referenceTasks?: Task[]; // 引用的任务列表（可选）
  public readonly taskId: string; // 任务ID
  public readonly contextId: string; // 上下文ID

  constructor(
    userMessage: Message,
    taskId: string,
    contextId: string,
    task?: Task,
    referenceTasks?: Task[]
  ) {
    this.userMessage = userMessage;
    this.taskId = taskId;
    this.contextId = contextId;
    this.task = task;
    this.referenceTasks = referenceTasks;
  }
}
