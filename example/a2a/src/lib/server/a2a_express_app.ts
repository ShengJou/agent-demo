import express, { Request, Response, Express } from "express";

import { A2AError } from "./error.js";
import {
  A2AResponse,
  JSONRPCErrorResponse,
  JSONRPCSuccessResponse,
} from "../index.js";
import { A2ARequestHandler } from "./request_handler/a2a_request_handler.js";
import { JsonRpcTransportHandler } from "./transports/jsonrpc_transport_handler.js";

/**
 * A2A Express应用类，用于设置A2A协议的HTTP路由。
 */
export class A2AExpressApp {
  private requestHandler: A2ARequestHandler; // 保留以用于getAgentCard
  private jsonRpcTransportHandler: JsonRpcTransportHandler;

  constructor(requestHandler: A2ARequestHandler) {
    this.requestHandler = requestHandler; // DefaultRequestHandler实例
    this.jsonRpcTransportHandler = new JsonRpcTransportHandler(requestHandler);
  }

  /**
   * 向现有的Express应用添加A2A路由。
   * @param app 可选的现有Express应用。
   * @param baseUrl A2A端点的基础URL（例如"/a2a/api"）。
   * @returns 带有A2A路由的Express应用。
   */
  public setupRoutes(app: Express, baseUrl: string = ""): Express {
    app.use(express.json());

    // 代理卡片端点
    app.get(
      `${baseUrl}/.well-known/agent.json`,
      async (req: Request, res: Response) => {
        try {
          // getAgentCard在A2ARequestHandler上，DefaultRequestHandler实现了它
          const agentCard = await this.requestHandler.getAgentCard();
          res.json(agentCard);
        } catch (error: any) {
          console.error("Error fetching agent card:", error);
          res.status(500).json({ error: "Failed to retrieve agent card" });
        }
      }
    );

    // 主要的JSON-RPC端点
    app.post(baseUrl, async (req: Request, res: Response) => {
      try {
        const rpcResponseOrStream = await this.jsonRpcTransportHandler.handle(
          req.body
        );

        // 检查是否为AsyncGenerator（流）
        if (
          typeof (rpcResponseOrStream as any)?.[Symbol.asyncIterator] ===
          "function"
        ) {
          const stream = rpcResponseOrStream as AsyncGenerator<
            JSONRPCSuccessResponse,
            void,
            undefined
          >;

          // 设置服务器发送事件(SSE)头
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();

          try {
            for await (const event of stream) {
              // 流中的每个事件都已经是JSONRPCResult
              res.write(`id: ${new Date().getTime()}\n`);
              res.write(`data: ${JSON.stringify(event)}\n\n`);
            }
          } catch (streamError: any) {
            console.error(
              `Error during SSE streaming (request ${req.body?.id}):`,
              streamError
            );
            // 如果流本身抛出错误，发送最终的JSONRPCErrorResponse
            const a2aError =
              streamError instanceof A2AError
                ? streamError
                : A2AError.internalError(
                    streamError.message || "Streaming error."
                  );
            const errorResponse: JSONRPCErrorResponse = {
              jsonrpc: "2.0",
              id: req.body?.id || null, // 如果可用，使用原始请求ID
              error: a2aError.toJSONRPCError(),
            };
            if (!res.headersSent) {
              // 如果flushHeaders工作正常，这不应该发生
              res.status(500).json(errorResponse); // 这里应该是JSON，而不是SSE
            } else {
              // 如果可能，尝试作为最后一个SSE事件发送，尽管客户端可能已断开连接
              res.write(`id: ${new Date().getTime()}\n`);
              res.write(`event: error\n`); // 用于客户端处理的自定义事件类型
              res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
            }
          } finally {
            if (!res.writableEnded) {
              res.end();
            }
          }
        } else {
          // 单个JSON-RPC响应
          const rpcResponse = rpcResponseOrStream as A2AResponse;
          res.status(200).json(rpcResponse);
        }
      } catch (error: any) {
        // 捕获jsonRpcTransportHandler.handle本身的错误（例如初始解析错误）
        console.error("Unhandled error in A2AExpressApp POST handler:", error);
        const a2aError =
          error instanceof A2AError
            ? error
            : A2AError.internalError("General processing error.");
        const errorResponse: JSONRPCErrorResponse = {
          jsonrpc: "2.0",
          id: req.body?.id || null,
          error: a2aError.toJSONRPCError(),
        };
        if (!res.headersSent) {
          res.status(500).json(errorResponse);
        } else if (!res.writableEnded) {
          // 如果头部已发送（可能在早期失败的流尝试期间），尝试优雅地结束
          res.end();
        }
      }
    });
    // 不再需要单独的/stream端点。
    return app;
  }
}
