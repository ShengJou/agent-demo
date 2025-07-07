import {
  SendMessageResponse,
  SendStreamingMessageResponse,
  GetTaskResponse,
  CancelTaskResponse,
  SetTaskPushNotificationConfigResponse,
  GetTaskPushNotificationConfigResponse,
  JSONRPCErrorResponse,
} from "./types.js";

/**
 * 表示在A2A协议中定义的任何有效JSON-RPC响应。
 */
export type A2AResponse =
  | SendMessageResponse
  | SendStreamingMessageResponse
  | GetTaskResponse
  | CancelTaskResponse
  | SetTaskPushNotificationConfigResponse
  | GetTaskPushNotificationConfigResponse
  | JSONRPCErrorResponse; // 用于其他错误响应的兜底类型
