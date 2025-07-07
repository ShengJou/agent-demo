import {
  AgentCard,
  AgentCapabilities,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCSuccessResponse,
  JSONRPCError,
  JSONRPCErrorResponse,
  Message,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  MessageSendParams,
  SendMessageResponse,
  SendStreamingMessageResponse,
  SendStreamingMessageSuccessResponse,
  TaskQueryParams,
  GetTaskResponse,
  GetTaskSuccessResponse,
  TaskIdParams,
  CancelTaskResponse,
  CancelTaskSuccessResponse,
  TaskPushNotificationConfig, // 从PushNotificationConfigParams重命名以便直接对齐schema
  SetTaskPushNotificationConfigRequest,
  SetTaskPushNotificationConfigResponse,
  SetTaskPushNotificationConfigSuccessResponse,
  GetTaskPushNotificationConfigRequest,
  GetTaskPushNotificationConfigResponse,
  GetTaskPushNotificationConfigSuccessResponse,
  TaskResubscriptionRequest,
  A2AError,
  SendMessageSuccessResponse,
} from "../types.js"; // 假设schema.ts在同一目录或适当的路径

// 流式方法产生的数据的辅助类型
type A2AStreamEventData =
  | Message
  | Task
  | TaskStatusUpdateEvent
  | TaskArtifactUpdateEvent;

/**
 * A2AClient是用于与符合A2A规范的代理进行交互的TypeScript HTTP客户端。
 */
export class A2AClient {
  private agentBaseUrl: string;
  private agentCardPromise: Promise<AgentCard>;
  private requestIdCounter: number = 1;
  private serviceEndpointUrl?: string; // 从获取的AgentCard中填充

  /**
   * 构造A2AClient实例。
   * 它开始从提供的代理baseUrl获取代理卡片。
   * 代理卡片预期位于 `${agentBaseUrl}/.well-known/agent.json`。
   * 来自代理卡片的 `url` 字段将用作RPC服务端点。
   * @param agentBaseUrl A2A代理的基础URL（例如，https://agent.example.com）。
   */
  constructor(agentBaseUrl: string) {
    this.agentBaseUrl = agentBaseUrl.replace(/\/$/, ""); // 如果有的话，删除尾随斜杠
    this.agentCardPromise = this._fetchAndCacheAgentCard();
  }

  /**
   * 从代理的已知URI获取代理卡片并缓存其服务端点URL。
   * 此方法由构造函数调用。
   * @returns 解析为AgentCard的Promise。
   */
  private async _fetchAndCacheAgentCard(): Promise<AgentCard> {
    const agentCardUrl = `${this.agentBaseUrl}/.well-known/agent.json`;
    try {
      const response = await fetch(agentCardUrl, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch Agent Card from ${agentCardUrl}: ${response.status} ${response.statusText}`
        );
      }
      const agentCard: AgentCard = await response.json();
      if (!agentCard.url) {
        throw new Error(
          "Fetched Agent Card does not contain a valid 'url' for the service endpoint."
        );
      }
      this.serviceEndpointUrl = agentCard.url; // 从代理卡片缓存服务端点URL
      return agentCard;
    } catch (error) {
      console.error("Error fetching or parsing Agent Card:");
      // 允许promise拒绝，以便agentCardPromise的用户可以处理它。
      throw error;
    }
  }

  /**
   * 检索代理卡片。
   * 如果提供了 `agentBaseUrl`，它会从该特定URL获取卡片。
   * 否则，它返回在客户端构造期间获取和缓存的卡片。
   * @param agentBaseUrl 可选。要从中获取卡片的代理的基础URL。
   * 如果提供，这将获取新卡片，而不是使用构造函数URL中的缓存卡片。
   * @returns 解析为AgentCard的Promise。
   */
  public async getAgentCard(agentBaseUrl?: string): Promise<AgentCard> {
    if (agentBaseUrl) {
      const specificAgentBaseUrl = agentBaseUrl.replace(/\/$/, "");
      const agentCardUrl = `${specificAgentBaseUrl}/.well-known/agent.json`;
      const response = await fetch(agentCardUrl, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch Agent Card from ${agentCardUrl}: ${response.status} ${response.statusText}`
        );
      }
      return (await response.json()) as AgentCard;
    }
    // 如果没有给出特定URL，返回最初配置的代理卡片的promise。
    return this.agentCardPromise;
  }

  /**
   * 获取RPC服务端点URL。确保首先获取代理卡片。
   * @returns 解析为服务端点URL字符串的Promise。
   */
  private async _getServiceEndpoint(): Promise<string> {
    if (this.serviceEndpointUrl) {
      return this.serviceEndpointUrl;
    }
    // 如果serviceEndpointUrl未设置，意味着代理卡片获取正在进行或失败。
    // 等待agentCardPromise将解析它或在获取失败时抛出异常。
    await this.agentCardPromise;
    if (!this.serviceEndpointUrl) {
      // 这种情况理想情况下应该由_fetchAndCacheAgentCard中的错误处理覆盖
      throw new Error(
        "Agent Card URL for RPC endpoint is not available. Fetching might have failed."
      );
    }
    return this.serviceEndpointUrl;
  }

  /**
   * 用于发起通用JSON-RPC POST请求的辅助方法。
   * @param method RPC方法名称。
   * @param params RPC方法的参数。
   * @returns 解析为RPC响应的Promise。
   */
  private async _postRpcRequest<TParams, TResponse extends JSONRPCResponse>(
    method: string,
    params: TParams
  ): Promise<TResponse> {
    const endpoint = await this._getServiceEndpoint();
    const requestId = this.requestIdCounter++;
    const rpcRequest: JSONRPCRequest = {
      jsonrpc: "2.0",
      method,
      params: params as { [key: string]: any }, // 转换因为TParams结构因方法而异
      id: requestId,
    };

    const httpResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json", // 对于非流式请求期望JSON响应
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!httpResponse.ok) {
      let errorBodyText = "(empty or non-JSON response)";
      try {
        errorBodyText = await httpResponse.text();
        const errorJson = JSON.parse(errorBodyText);
        // 如果正文是有效的JSON-RPC错误响应，让它由下面的标准解析处理。
        // 但是，如果它甚至不是JSON-RPC结构但仍然是错误，则基于HTTP状态抛出。
        if (!errorJson.jsonrpc && errorJson.error) {
          // 检查是否为JSON-RPC错误结构
          throw new Error(
            `RPC error for ${method}: ${errorJson.error.message} (Code: ${
              errorJson.error.code
            }, HTTP Status: ${httpResponse.status}) Data: ${JSON.stringify(
              errorJson.error.data
            )}`
          );
        } else if (!errorJson.jsonrpc) {
          throw new Error(
            `HTTP error for ${method}! Status: ${httpResponse.status} ${httpResponse.statusText}. Response: ${errorBodyText}`
          );
        }
      } catch (e: any) {
        // 如果解析错误正文失败或它不是JSON-RPC错误，抛出通用HTTP错误。
        // 如果它已经是从try块内抛出的错误，重新抛出它。
        if (
          e.message.startsWith("RPC error for") ||
          e.message.startsWith("HTTP error for")
        )
          throw e;
        throw new Error(
          `HTTP error for ${method}! Status: ${httpResponse.status} ${httpResponse.statusText}. Response: ${errorBodyText}`
        );
      }
    }

    const rpcResponse = await httpResponse.json();

    if (rpcResponse.id !== requestId) {
      // 这对于请求-响应匹配是一个重大问题。
      console.error(
        `CRITICAL: RPC response ID mismatch for method ${method}. Expected ${requestId}, got ${rpcResponse.id}. This may lead to incorrect response handling.`
      );
      // 根据严格性，可能会在这里抛出错误。
      // throw new Error(`RPC response ID mismatch for method ${method}. Expected ${requestId}, got ${rpcResponse.id}`);
    }

    return rpcResponse as TResponse;
  }

  /**
   * 向代理发送消息。
   * 行为（阻塞/非阻塞）和推送通知配置
   * 在 `params.configuration` 对象中指定。
   * 可选地，可以提供 `params.message.contextId` 或 `params.message.taskId`。
   * @param params 发送消息的参数，包括消息内容和配置。
   * @returns 解析为SendMessageResponse的Promise，可以是Message、Task或错误。
   */
  public async sendMessage(
    params: MessageSendParams
  ): Promise<SendMessageResponse> {
    return this._postRpcRequest<MessageSendParams, SendMessageResponse>(
      "message/send",
      params
    );
  }

  /**
   * 向代理发送消息并使用服务器发送事件（SSE）流回响应。
   * 推送通知配置可以在 `params.configuration` 中指定。
   * 可选地，可以提供 `params.message.contextId` 或 `params.message.taskId`。
   * 需要代理支持流式传输（AgentCard中的 `capabilities.streaming: true`）。
   * @param params 发送消息的参数。
   * @returns 产生A2AStreamEventData（Message、Task、TaskStatusUpdateEvent或TaskArtifactUpdateEvent）的AsyncGenerator。
   * 如果不支持流式传输或发生HTTP/SSE错误，生成器会抛出错误。
   */
  public async *sendMessageStream(
    params: MessageSendParams
  ): AsyncGenerator<A2AStreamEventData, void, undefined> {
    const agentCard = await this.agentCardPromise; // 确保获取代理卡片
    if (!agentCard.capabilities?.streaming) {
      throw new Error(
        "Agent does not support streaming (AgentCard.capabilities.streaming is not true)."
      );
    }

    const endpoint = await this._getServiceEndpoint();
    const clientRequestId = this.requestIdCounter++; // 为此流请求使用唯一ID
    const rpcRequest: JSONRPCRequest = {
      // 这是建立流的初始JSON-RPC请求
      jsonrpc: "2.0",
      method: "message/stream",
      params: params as { [key: string]: any },
      id: clientRequestId,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream", // 对SSE至关重要
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      // 尝试读取错误正文以获取更多详细信息
      let errorBody = "";
      try {
        errorBody = await response.text();
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          throw new Error(
            `HTTP error establishing stream for message/stream: ${response.status} ${response.statusText}. RPC Error: ${errorJson.error.message} (Code: ${errorJson.error.code})`
          );
        }
      } catch (e: any) {
        if (e.message.startsWith("HTTP error establishing stream")) throw e;
        // 如果正文不是JSON或解析失败的回退
        throw new Error(
          `HTTP error establishing stream for message/stream: ${
            response.status
          } ${response.statusText}. Response: ${errorBody || "(empty)"}`
        );
      }
      throw new Error(
        `HTTP error establishing stream for message/stream: ${response.status} ${response.statusText}`
      );
    }
    if (
      !response.headers.get("Content-Type")?.startsWith("text/event-stream")
    ) {
      // 服务器应明确设置此内容类型用于SSE。
      throw new Error(
        "Invalid response Content-Type for SSE stream. Expected 'text/event-stream'."
      );
    }

    // 从解析的SSE流中产生事件。
    // 每个事件的'data'字段都是JSON-RPC响应。
    yield* this._parseA2ASseStream<A2AStreamEventData>(
      response,
      clientRequestId
    );
  }

  /**
   * 设置或更新给定任务的推送通知配置。
   * 需要代理支持推送通知（AgentCard中的 `capabilities.pushNotifications: true`）。
   * @param params 包含taskId和TaskPushNotificationConfig的参数。
   * @returns 解析为SetTaskPushNotificationConfigResponse的Promise。
   */
  public async setTaskPushNotificationConfig(
    params: TaskPushNotificationConfig
  ): Promise<SetTaskPushNotificationConfigResponse> {
    const agentCard = await this.agentCardPromise;
    if (!agentCard.capabilities?.pushNotifications) {
      throw new Error(
        "Agent does not support push notifications (AgentCard.capabilities.pushNotifications is not true)."
      );
    }
    // 'params' 直接匹配RPC方法期望的结构。
    return this._postRpcRequest<
      TaskPushNotificationConfig,
      SetTaskPushNotificationConfigResponse
    >("tasks/pushNotificationConfig/set", params);
  }

  /**
   * 获取给定任务的推送通知配置。
   * @param params 包含taskId的参数。
   * @returns 解析为GetTaskPushNotificationConfigResponse的Promise。
   */
  public async getTaskPushNotificationConfig(
    params: TaskIdParams
  ): Promise<GetTaskPushNotificationConfigResponse> {
    // 'params'（TaskIdParams）直接匹配RPC方法期望的结构。
    return this._postRpcRequest<
      TaskIdParams,
      GetTaskPushNotificationConfigResponse
    >("tasks/pushNotificationConfig/get", params);
  }

  /**
   * 通过其ID检索任务。
   * @param params 包含taskId和可选historyLength的参数。
   * @returns 解析为GetTaskResponse的Promise，其中包含Task对象或错误。
   */
  public async getTask(params: TaskQueryParams): Promise<GetTaskResponse> {
    return this._postRpcRequest<TaskQueryParams, GetTaskResponse>(
      "tasks/get",
      params
    );
  }

  /**
   * 通过其ID取消任务。
   * @param params 包含taskId的参数。
   * @returns 解析为CancelTaskResponse的Promise，其中包含更新的Task对象或错误。
   */
  public async cancelTask(params: TaskIdParams): Promise<CancelTaskResponse> {
    return this._postRpcRequest<TaskIdParams, CancelTaskResponse>(
      "tasks/cancel",
      params
    );
  }

  /**
   * 使用服务器发送事件（SSE）重新订阅任务的事件流。
   * 如果活动任务的先前SSE连接中断，则使用此方法。
   * 需要代理支持流式传输（AgentCard中的 `capabilities.streaming: true`）。
   * @param params 包含taskId的参数。
   * @returns 产生A2AStreamEventData（Message、Task、TaskStatusUpdateEvent或TaskArtifactUpdateEvent）的AsyncGenerator。
   */
  public async *resubscribeTask(
    params: TaskIdParams
  ): AsyncGenerator<A2AStreamEventData, void, undefined> {
    const agentCard = await this.agentCardPromise;
    if (!agentCard.capabilities?.streaming) {
      throw new Error(
        "Agent does not support streaming (required for tasks/resubscribe)."
      );
    }

    const endpoint = await this._getServiceEndpoint();
    const clientRequestId = this.requestIdCounter++; // 此重新订阅请求的唯一ID
    const rpcRequest: JSONRPCRequest = {
      // 建立流的初始JSON-RPC请求
      jsonrpc: "2.0",
      method: "tasks/resubscribe",
      params: params as { [key: string]: any },
      id: clientRequestId,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          throw new Error(
            `HTTP error establishing stream for tasks/resubscribe: ${response.status} ${response.statusText}. RPC Error: ${errorJson.error.message} (Code: ${errorJson.error.code})`
          );
        }
      } catch (e: any) {
        if (e.message.startsWith("HTTP error establishing stream")) throw e;
        throw new Error(
          `HTTP error establishing stream for tasks/resubscribe: ${
            response.status
          } ${response.statusText}. Response: ${errorBody || "(empty)"}`
        );
      }
      throw new Error(
        `HTTP error establishing stream for tasks/resubscribe: ${response.status} ${response.statusText}`
      );
    }
    if (
      !response.headers.get("Content-Type")?.startsWith("text/event-stream")
    ) {
      throw new Error(
        "Invalid response Content-Type for SSE stream on resubscribe. Expected 'text/event-stream'."
      );
    }

    // 重新订阅的事件结构假设与message/stream相同。
    // 每个事件的'data'字段都是JSON-RPC响应。
    yield* this._parseA2ASseStream<A2AStreamEventData>(
      response,
      clientRequestId
    );
  }

  /**
   * 将HTTP响应正文解析为A2A服务器发送事件流。
   * SSE事件的每个'data'字段预期是JSON-RPC 2.0响应对象，
   * 特别是SendStreamingMessageResponse（或重新订阅的类似结构）。
   * @param response HTTP响应对象，其正文是SSE流。
   * @param originalRequestId 发起此流的客户端JSON-RPC请求的ID。
   * 用于验证流式JSON-RPC响应中的 `id`。
   * @returns 产生来自流的每个有效JSON-RPC成功响应的 `result` 字段的AsyncGenerator。
   */
  private async *_parseA2ASseStream<TStreamItem>(
    response: Response,
    originalRequestId: number | string | null
  ): AsyncGenerator<TStreamItem, void, undefined> {
    if (!response.body) {
      throw new Error("SSE response body is undefined. Cannot read stream.");
    }
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = ""; // 保存来自流的不完整行
    let eventDataBuffer = ""; // 保存当前事件累积的'data:'行

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // 如果流在'data:'行后突然结束，处理任何最终缓冲的事件数据
          if (eventDataBuffer.trim()) {
            const result = this._processSseEventData<TStreamItem>(
              eventDataBuffer,
              originalRequestId
            );
            yield result;
          }
          break; // 流结束
        }

        buffer += value; // 将新块追加到缓冲区
        let lineEndIndex;
        // 处理缓冲区中的所有完整行
        while ((lineEndIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.substring(0, lineEndIndex).trim(); // 获取并修剪行
          buffer = buffer.substring(lineEndIndex + 1); // 从缓冲区中删除已处理的行

          if (line === "") {
            // 空行：表示事件的结束
            if (eventDataBuffer) {
              // 如果我们为事件累积了数据
              const result = this._processSseEventData<TStreamItem>(
                eventDataBuffer,
                originalRequestId
              );
              yield result;
              eventDataBuffer = ""; // 为下一个事件重置缓冲区
            }
          } else if (line.startsWith("data:")) {
            eventDataBuffer += line.substring(5).trimStart() + "\n"; // 追加数据（多行数据是可能的）
          } else if (line.startsWith(":")) {
            // 这是SSE中的注释行，忽略它。
          } else if (line.includes(":")) {
            // 其他SSE字段，如'event:'、'id:'、'retry:'。
            // A2A规范主要关注JSON-RPC负载的'data'字段。
            // 现在，我们不专门处理这些其他SSE字段，除非规范要求。
          }
        }
      }
    } catch (error: any) {
      // 记录并重新抛出流处理过程中遇到的错误
      console.error("Error reading or parsing SSE stream:", error.message);
      throw error;
    } finally {
      reader.releaseLock(); // 确保释放读取器锁
    }
  }

  /**
   * 处理单个SSE事件的数据字符串，期望它是JSON-RPC响应。
   * @param jsonData 来自SSE事件的一个或多个'data:'行的字符串内容。
   * @param originalRequestId 发起流的客户端请求的ID。
   * @returns 解析的JSON-RPC成功响应的 `result` 字段。
   * @throws 如果数据不是有效JSON、不是有效JSON-RPC响应、错误响应或ID不匹配，则抛出错误。
   */
  private _processSseEventData<TStreamItem>(
    jsonData: string,
    originalRequestId: number | string | null
  ): TStreamItem {
    if (!jsonData.trim()) {
      throw new Error("Attempted to process empty SSE event data.");
    }
    try {
      // SSE数据可以是多行的，确保它被视为单个JSON字符串。
      const sseJsonRpcResponse = JSON.parse(jsonData.replace(/\n$/, "")); // 如果有的话，删除尾随换行符

      // 类型断言为SendStreamingMessageResponse，因为这是A2A流的预期结构。
      const a2aStreamResponse: SendStreamingMessageResponse =
        sseJsonRpcResponse as SendStreamingMessageResponse;

      if (a2aStreamResponse.id !== originalRequestId) {
        // 根据JSON-RPC规范，通知（SSE事件可以被视为）可能没有ID，
        // 或者如果有，它应该匹配。A2A规范暗示流式事件与初始请求相关联。
        console.warn(
          `SSE Event's JSON-RPC response ID mismatch. Client request ID: ${originalRequestId}, event response ID: ${a2aStreamResponse.id}.`
        );
        // 根据严格性，这可能是一个错误。现在，这是一个警告。
      }

      if (this.isErrorResponse(a2aStreamResponse)) {
        const err = a2aStreamResponse.error as JSONRPCError | A2AError;
        throw new Error(
          `SSE event contained an error: ${err.message} (Code: ${
            err.code
          }) Data: ${JSON.stringify(err.data)}`
        );
      }

      // 检查'result'是否存在，因为它对于成功的JSON-RPC响应是必需的
      if (
        !("result" in a2aStreamResponse) ||
        typeof (a2aStreamResponse as SendStreamingMessageSuccessResponse)
          .result === "undefined"
      ) {
        throw new Error(
          `SSE event JSON-RPC response is missing 'result' field. Data: ${jsonData}`
        );
      }

      const successResponse =
        a2aStreamResponse as SendStreamingMessageSuccessResponse;
      return successResponse.result as TStreamItem;
    } catch (e: any) {
      // 捕获来自JSON.parse的错误或是否是此函数抛出的错误响应
      if (
        e.message.startsWith("SSE event contained an error") ||
        e.message.startsWith(
          "SSE event JSON-RPC response is missing 'result' field"
        )
      ) {
        throw e; // 重新抛出已由此函数处理/识别的错误
      }
      // 对于其他解析错误或意外结构：
      console.error(
        "Failed to parse SSE event data string or unexpected JSON-RPC structure:",
        jsonData,
        e
      );
      throw new Error(
        `Failed to parse SSE event data: "${jsonData.substring(
          0,
          100
        )}...". Original error: ${e.message}`
      );
    }
  }

  /**
   * 检查响应是否为错误响应。
   * @param response JSON-RPC响应
   * @returns 如果是错误响应则为true
   */
  isErrorResponse(response: JSONRPCResponse): response is JSONRPCErrorResponse {
    return "error" in response;
  }
}
