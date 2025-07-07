import * as schema from "../types.js";

/**
 * A2A服务器操作的自定义错误类，集成了JSON-RPC错误代码。
 */
export class A2AError extends Error {
  public code: number;
  public data?: Record<string, unknown>;
  public taskId?: string; // 可选的任务ID上下文

  constructor(
    code: number,
    message: string,
    data?: Record<string, unknown>,
    taskId?: string
  ) {
    super(message);
    this.name = "A2AError";
    this.code = code;
    this.data = data;
    this.taskId = taskId; // 如果提供了关联的任务ID，则存储它
  }

  /**
   * 将错误格式化为标准的JSON-RPC错误对象结构。
   */
  toJSONRPCError(): schema.JSONRPCError {
    const errorObject: schema.JSONRPCError = {
      code: this.code,
      message: this.message,
    };

    if (this.data !== undefined) {
      errorObject.data = this.data;
    }

    return errorObject;
  }

  // 常见错误的静态工厂方法

  static parseError(message: string, data?: Record<string, unknown>): A2AError {
    return new A2AError(-32700, message, data);
  }

  static invalidRequest(
    message: string,
    data?: Record<string, unknown>
  ): A2AError {
    return new A2AError(-32600, message, data);
  }

  static methodNotFound(method: string): A2AError {
    return new A2AError(-32601, `Method not found: ${method}`);
  }

  static invalidParams(
    message: string,
    data?: Record<string, unknown>
  ): A2AError {
    return new A2AError(-32602, message, data);
  }

  static internalError(
    message: string,
    data?: Record<string, unknown>
  ): A2AError {
    return new A2AError(-32603, message, data);
  }

  static taskNotFound(taskId: string): A2AError {
    return new A2AError(-32001, `Task not found: ${taskId}`, undefined, taskId);
  }

  static taskNotCancelable(taskId: string): A2AError {
    return new A2AError(
      -32002,
      `Task not cancelable: ${taskId}`,
      undefined,
      taskId
    );
  }

  static pushNotificationNotSupported(): A2AError {
    return new A2AError(-32003, "Push Notification is not supported");
  }

  static unsupportedOperation(operation: string): A2AError {
    return new A2AError(-32004, `Unsupported operation: ${operation}`);
  }
}
