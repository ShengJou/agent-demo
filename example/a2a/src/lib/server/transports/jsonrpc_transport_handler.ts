import { A2AResponse } from "../../a2a_response.js";
import {
  JSONRPCRequest,
  JSONRPCErrorResponse,
  MessageSendParams,
  TaskQueryParams,
  TaskIdParams,
  TaskPushNotificationConfig,
  JSONRPCSuccessResponse,
  SendStreamingMessageSuccessResponse,
  A2ARequest,
} from "../../types.js";
import { A2AError } from "../error.js";
import { A2ARequestHandler } from "../request_handler/a2a_request_handler.js";

/**
 * 处理JSON-RPC传输层，将请求路由到A2ARequestHandler。
 */
export class JsonRpcTransportHandler {
  private requestHandler: A2ARequestHandler;

  constructor(requestHandler: A2ARequestHandler) {
    this.requestHandler = requestHandler;
  }

  /**
   * 处理传入的JSON-RPC请求。
   * 对于流式方法，它返回JSONRPCResult的AsyncGenerator。
   * 对于非流式方法，它返回单个JSONRPCMessage（Result或ErrorResponse）的Promise。
   */
  public async handle(
    requestBody: any
  ): Promise<A2AResponse | AsyncGenerator<A2AResponse, void, undefined>> {
    let rpcRequest: A2ARequest;

    try {
      if (typeof requestBody === "string") {
        rpcRequest = JSON.parse(requestBody);
      } else if (typeof requestBody === "object" && requestBody !== null) {
        rpcRequest = requestBody as A2ARequest;
      } else {
        throw A2AError.parseError("Invalid request body type.");
      }

      if (
        rpcRequest.jsonrpc !== "2.0" ||
        !rpcRequest.method ||
        typeof rpcRequest.method !== "string"
      ) {
        throw A2AError.invalidRequest("Invalid JSON-RPC request structure.");
      }
    } catch (error: any) {
      const a2aError =
        error instanceof A2AError
          ? error
          : A2AError.parseError(
              error.message || "Failed to parse JSON request."
            );
      return {
        jsonrpc: "2.0",
        id: typeof rpcRequest!?.id !== "undefined" ? rpcRequest!.id : null,
        error: a2aError.toJSONRPCError(),
      } as JSONRPCErrorResponse;
    }

    const { method, params = {}, id: requestId = null } = rpcRequest;

    try {
      if (method === "message/stream" || method === "tasks/resubscribe") {
        const agentCard = await this.requestHandler.getAgentCard();
        if (!agentCard.capabilities.streaming) {
          throw A2AError.unsupportedOperation(
            `Method ${method} requires streaming capability.`
          );
        }
        const agentEventStream =
          method === "message/stream"
            ? this.requestHandler.sendMessageStream(params as MessageSendParams)
            : this.requestHandler.resubscribe(params as TaskIdParams);

        // 将代理事件流包装为JSON-RPC结果流
        return (async function* jsonRpcEventStream(): AsyncGenerator<
          A2AResponse,
          void,
          undefined
        > {
          try {
            for await (const event of agentEventStream) {
              yield {
                jsonrpc: "2.0",
                id: requestId, // 对所有流式响应使用原始请求ID
                result: event,
              };
            }
          } catch (streamError: any) {
            // 如果底层代理流抛出错误，我们需要产生一个JSONRPCErrorResponse。
            // 但是，AsyncGenerator期望产生JSONRPCResult。
            // 这表明代理流中的错误传播方式存在问题。
            // 现在，记录它。Express层将处理生成器的结束。
            console.error(
              `Error in agent event stream for ${method} (request ${requestId}):`,
              streamError
            );
            // 理想情况下，Express层应该捕获此错误，如果流中断，则向客户端发送最终错误。
            // 或者，agentEventStream本身应该产生一个被包装的最终错误事件。
            // 现在，我们重新抛出，以便A2AExpressApp的流处理可以捕获它。
            throw streamError;
          }
        })();
      } else {
        // 处理非流式方法
        let result: any;
        switch (method) {
          case "message/send":
            result = await this.requestHandler.sendMessage(
              params as MessageSendParams
            );
            break;
          case "tasks/get":
            result = await this.requestHandler.getTask(
              params as TaskQueryParams
            );
            break;
          case "tasks/cancel":
            result = await this.requestHandler.cancelTask(
              params as TaskIdParams
            );
            break;
          case "tasks/pushNotificationConfig/set":
            result = await this.requestHandler.setTaskPushNotificationConfig(
              params as TaskPushNotificationConfig
            );
            break;
          case "tasks/pushNotificationConfig/get":
            result = await this.requestHandler.getTaskPushNotificationConfig(
              params as TaskIdParams
            );
            break;
          default:
            throw A2AError.methodNotFound(method);
        }
        return {
          jsonrpc: "2.0",
          id: requestId,
          result: result,
        } as A2AResponse;
      }
    } catch (error: any) {
      const a2aError =
        error instanceof A2AError
          ? error
          : A2AError.internalError(
              error.message || "An unexpected error occurred."
            );
      return {
        jsonrpc: "2.0",
        id: requestId,
        error: a2aError.toJSONRPCError(),
      } as JSONRPCErrorResponse;
    }
  }
}
