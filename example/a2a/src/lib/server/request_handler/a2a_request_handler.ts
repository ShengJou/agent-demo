import {
  Message,
  AgentCard,
  MessageSendParams,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TaskQueryParams,
  TaskIdParams,
  TaskPushNotificationConfig,
} from "../../types.js";

/**
 * A2A请求处理器接口，定义了处理A2A协议各种请求的方法。
 */
export interface A2ARequestHandler {
  /**
   * 获取代理卡片信息。
   * @returns 包含代理信息的AgentCard
   */
  getAgentCard(): Promise<AgentCard>;

  /**
   * 发送消息给代理。
   * @param params 消息发送参数
   * @returns 返回的消息或任务
   */
  sendMessage(params: MessageSendParams): Promise<Message | Task>;

  /**
   * 以流的方式发送消息给代理。
   * @param params 消息发送参数
   * @returns 异步生成器，产生消息、任务或更新事件
   */
  sendMessageStream(
    params: MessageSendParams
  ): AsyncGenerator<
    Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent,
    void,
    undefined
  >;

  /**
   * 获取指定的任务。
   * @param params 任务查询参数
   * @returns 任务对象
   */
  getTask(params: TaskQueryParams): Promise<Task>;

  /**
   * 取消指定的任务。
   * @param params 任务ID参数
   * @returns 被取消的任务对象
   */
  cancelTask(params: TaskIdParams): Promise<Task>;

  /**
   * 设置任务的推送通知配置。
   * @param params 推送通知配置
   * @returns 设置后的配置
   */
  setTaskPushNotificationConfig(
    params: TaskPushNotificationConfig
  ): Promise<TaskPushNotificationConfig>;

  /**
   * 获取任务的推送通知配置。
   * @param params 任务ID参数
   * @returns 推送通知配置
   */
  getTaskPushNotificationConfig(
    params: TaskIdParams
  ): Promise<TaskPushNotificationConfig>;

  /**
   * 重新订阅任务事件流。
   * @param params 任务ID参数
   * @returns 异步生成器，产生任务或更新事件
   */
  resubscribe(
    params: TaskIdParams
  ): AsyncGenerator<
    Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent,
    void,
    undefined
  >;
}
