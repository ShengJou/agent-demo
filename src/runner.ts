/**
 * Genkit 的 DeepSeek 运行器
 *
 * 此模块将 Genkit GenerateRequest 转换为 DeepSeek API 请求，
 * 然后将响应处理为 Genkit GenerateResponseData 对象。
 *
 * DeepSeek API 文档：
 *   https://api-docs.deepseek.com/api/create-chat-completion
 */

import {
  GenerateRequest,
  GenerateResponseData,
  Message,
  StreamingCallback,
} from 'genkit';
import {
  GenerateResponseChunkData,
  GenerateResponseSchema,
} from 'genkit/model';
import OpenAI from 'openai';
import {
  ChatCompletion,
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionContentPartText,
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources/chat/completions';
import { DeepSeekConfigSchema, SUPPORTED_DEEPSEEK_MODELS } from './models';
import _ from 'lodash';
import z, { ZodString } from 'zod';

/**
 * @description 将 DeepSeek 角色转换为 Genkit 角色。
 * @param role - 要转换的 DeepSeek 角色。
 * @returns Genkit 角色。
 */
export function fromDeepSeekRole(
  role: string | undefined
): GenerateRequest<typeof DeepSeekConfigSchema>['messages'][number]['role'] {
  if (role === 'assistant') return 'model';
  if (role === 'system') return 'system';
  if (role === 'user') return 'user';
  if (role === 'tool') return 'tool';
  return 'model';
}

/**
 * 将 DeepSeek 的 finish_reason 转换为 Genkit 的 finishReason。
 * @param finishReason - DeepSeek 的 finish_reason。
 * @returns Genkit 的 finishReason。
 */
export function fromDeepSeekFinishReason(
  finishReason: ChatCompletion.Choice['finish_reason']
): GenerateResponseData['finishReason'] {
  if (finishReason === 'stop') return 'stop';
  if (finishReason === 'length') return 'length';
  if (finishReason === 'tool_calls') return 'stop';
  if (finishReason === 'content_filter') return 'stop';
  if (finishReason === 'function_call') return 'stop';
  return 'other';
}
/**
 * 将 DeepSeek API 响应的块数据转换为 Genkit 的 GenerateResponseChunkData。
 *
 * @param choice - DeepSeek API 响应的块数据。
 * @returns Genkit 的 GenerateResponseChunkData 对象。
 */
export function fromDeepSeekChunkChoice(
  choice: ChatCompletionChunk.Choice
): GenerateResponseChunkData {
  return {
    role: fromDeepSeekRole(choice.delta.role),
    index: choice.index,
    content: [
      {
        text: choice.delta.content || '',
        media: undefined,
        toolRequest: undefined,
        toolResponse: undefined,
        data: undefined,
        metadata: undefined,
      },
    ],
  };
}

/**
 * 将用户输入消息和历史消息的数组转换为符合 DeepSeek 消息类型的数组。
 *
 * 每个消息的处理过程如下：
 * - 为每个提供的消息创建一个新的 Message 实例。
 * - 通过 toDeepSeekRole 函数确定消息角色，确保它是 "system"、"assistant"、"user" 或 "tool" 之一。
 * - 对于任何其他角色的消息，结果对象仅包含角色和内容。
 *
 * @param messages - 要转换的原始消息对象数组。
 * @returns 格式化用于 DeepSeek 处理的 ChatCompletionMessageParam 对象数组。
 */

function toDeepSeekMessages(
  messages: GenerateRequest<typeof DeepSeekConfigSchema>['messages']
): Array<ChatCompletionMessageParam> {
  const deepSeekMessages = messages.map((msg) => {
    const m = new Message(msg);
    switch (m.role) {
      case 'system':
        const chatCompletionSystemMessageParam: ChatCompletionSystemMessageParam =
          {
            role: 'system' as const,
            content: m.text,
          };
        return chatCompletionSystemMessageParam;
      case 'user':
        const chatCompletionUserMessageParam: ChatCompletionUserMessageParam = {
          role: 'user' as const,
          content: m.text,
        };
        return chatCompletionUserMessageParam;
      case 'model':
        const chatCompletionAssistantMessageParam: ChatCompletionAssistantMessageParam =
          {
            role: 'assistant' as const,
            content: m.text,
            /** @see https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/ */
            tool_calls: m.toolRequests.map((part) => {
              return {
                id: part.toolRequest.ref || '',
                type: 'function' as const,
                function: {
                  name: part.toolRequest.name || '',
                  arguments: JSON.stringify(part.toolRequest.input) || '',
                },
              };
            }),
          };
        return chatCompletionAssistantMessageParam;
      case 'tool':
        const parts = m.toolResponseParts();
        const chatCompletionToolMessageParam: ChatCompletionToolMessageParam = {
          role: 'tool' as const,
          // NOTE: content 应该为 string
          content: z
            .string({ invalid_type_error: '必须是字符串' })
            .parse(parts.at(0)?.toolResponse?.output) as never,
          // NOTE: 多个工具调用时，此消息如何处理？
          tool_call_id: parts.at(0)?.toolResponse?.ref || '',
        };
        return chatCompletionToolMessageParam;
      default:
        throw new Error(`不支持的角色: ${m.role}`);
    }
  });
  return deepSeekMessages;
}

/**
 * 将给定的工具对象转换为 DeepSeek 工具格式。
 *
 * @param tool - 要转换的工具对象。它应该至少有一个 `name` 属性，可选地有一个 `inputSchema` 属性。
 * @returns 以 DeepSeek 格式表示工具的对象，类型为 'function'，function 属性包含工具的名称和参数。
 */
function toDeepSeekTool(
  tool: NonNullable<
    GenerateRequest<typeof DeepSeekConfigSchema>['tools']
  >[number]
) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.inputSchema?.type || 'object',
        required: tool.inputSchema?.required || [],
        properties: tool.inputSchema?.properties || {},
        additionalProperties: tool.inputSchema?.additionalProperties || false,
      },
    },
  };
}

/**
 * 将带有 DeepSeek 配置和消息的 GenerateRequest 转换为
 * DeepSeek 的 ChatCompletionCreateParamsNonStreaming 请求体。
 *
 * 此函数使用 toDeepSeekMessages 函数处理提供的消息，并
 * 应用 DeepSeek API 所需的配置设置。在返回之前，它从
 * 最终请求对象中删除任何空键。如果请求中缺少配置，
 * 则抛出错误。
 *
 * @param modelName 要使用的 DeepSeek 模型名称。
 * @param request - 包含消息和 DeepSeek 特定配置的生成请求。
 *                  配置必须符合 DeepSeekConfigSchema。
 *
 * @returns 为进行 DeepSeek API 调用而定制的格式化 ChatCompletionCreateParamsNonStreaming 对象。
 *
 * @throws {Error} 如果请求中未提供配置，则抛出错误。
 */
export function toDeepSeekRequestBody(
  modelName: string,
  request: GenerateRequest<typeof DeepSeekConfigSchema>
): ChatCompletionCreateParamsBase {
  const model = SUPPORTED_DEEPSEEK_MODELS[modelName];
  if (!model) throw new Error(`不支持的模型: ${modelName}`);

  const config = request.config;
  if (!config) {
    throw new Error('请求中缺少配置');
  }

  const body: ChatCompletionCreateParamsBase = {
    model: modelName,
    messages: toDeepSeekMessages(request.messages),
    temperature: config.temperature,
    max_tokens: config.maxOutputTokens,
    top_p: config.topP,
    stop: config.stopSequences,
    frequency_penalty: config.frequencyPenalty,
    presence_penalty: config.presencePenalty,
    logprobs: config.logProbs,
    top_logprobs: config.topLogProbs,
    tools: request.tools?.map(toDeepSeekTool),
    tool_choice:
      request.toolChoice ??
      (request.tools && request.tools.length > 0 ? 'auto' : 'none'),
    response_format: { type: 'text' }, // DeepSeek 只支持文本响应
    stream: false, // 如果提供流式回调，将切换为 true
    stream_options: null,
  };

  return body;
}

/**
 * 创建 Genkit 用于与 DeepSeek 模型交互的运行器。
 *
 * 此运行器将 Genkit GenerateRequest（使用 DeepSeekConfigSchema）
 * 转换为 DeepSeek API 请求体，然后将 API 响应处理为
 * Genkit GenerateResponseData 对象。
 *
 * @param name - DeepSeek 模型的名称（例如 "deepseek-chat" 或 "deepseek-reasoner"）。
 * @param client - 为 DeepSeek 配置的 OpenAI 兼容客户端实例。
 * @returns Genkit 将调用以生成完成的函数。
 */
export function deepseekRunner(name: string, client: OpenAI) {
  return async (
    request: GenerateRequest<typeof DeepSeekConfigSchema>,
    streamingCallback?: StreamingCallback<GenerateResponseChunkData>
  ): Promise<GenerateResponseData> => {
    let response: ChatCompletion;
    // 调用 DeepSeek API 的请求体
    const body: ChatCompletionCreateParamsBase = toDeepSeekRequestBody(
      name,
      request
    );

    if (streamingCallback) {
      // 启用流式响应
      const stream = client.beta.chat.completions.stream({
        ...body,
        stream: true,
      });
      for await (const chunk of stream) {
        chunk.choices?.forEach((chunkChoice: ChatCompletionChunk.Choice) => {
          const generateResponseChunkData =
            fromDeepSeekChunkChoice(chunkChoice);
          streamingCallback(generateResponseChunkData);
        });
      }
      response = await stream.finalChatCompletion();
    } else {
      // 非流式响应
      response = (await client.chat.completions.create(body)) as ChatCompletion;
    }

    const generateResponseData: GenerateResponseData = {
      candidates: response.choices.map<
        NonNullable<GenerateResponseData['candidates']>[number]
      >((choice: ChatCompletion.Choice) => {
        const tool_calls = choice.message?.tool_calls;
        return {
          index: choice.index,
          message: {
            role: fromDeepSeekRole(choice.message.role),
            content: [
              ...(choice.message.content
                ? [
                    {
                      text: choice.message.content,
                      media: undefined,
                      toolRequest: undefined,
                      toolResponse: undefined,
                      data: undefined,
                      metadata: undefined,
                      custom: undefined,
                      reasoning: undefined,
                      resource: undefined,
                    },
                  ]
                : []),
              ...(!_.isEmpty(tool_calls) &&
              tool_calls?.[0]?.function?.name &&
              tool_calls?.[0]?.id &&
              tool_calls?.[0]?.function?.arguments
                ? [
                    {
                      text: undefined,
                      media: undefined,
                      toolRequest: {
                        name: z.string().parse(tool_calls[0].function.name),
                        ref: z.string().parse(tool_calls[0].id),
                        input: JSON.parse(
                          z
                            .string({
                              invalid_type_error: '工具调用参数必须是字符串',
                            })
                            .parse(tool_calls[0].function.arguments)
                        ),
                      },
                      toolResponse: undefined,
                      data: undefined,
                      metadata: undefined,
                      custom: undefined,
                      reasoning: undefined,
                      resource: undefined,
                    },
                  ]
                : []),
            ],
            metadata: undefined,
          },
          finishReason: fromDeepSeekFinishReason(
            choice.finish_reason
          ) as Exclude<GenerateResponseData['finishReason'], undefined>,
          finishMessage: '',
          custom: undefined,
          usage: {
            inputTokens: response.usage?.prompt_tokens,
            outputTokens: response.usage?.completion_tokens,
            totalTokens: response.usage?.total_tokens,
          },
        };
      }),
      finishReason: fromDeepSeekFinishReason(response.choices[0].finish_reason),
      finishMessage: '',
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
      custom: response,
    };

    return generateResponseData;
  };
}
