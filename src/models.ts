/**
 * 此文件定义了 DeepSeek 插件中可用的模型。
 *
 * @see [DeepSeek 创建聊天完成 API](https://api-docs.deepseek.com/api/create-chat-completion)
 * @see [DeepSeek 推理模型](https://api-docs.deepseek.com/guides/reasoning_model)
 */
import { GenerationCommonConfigSchema, ModelReference } from "genkit";
import { modelRef } from "genkit/model";
import { z } from "zod";

export const DeepSeekConfigSchema = GenerationCommonConfigSchema.extend({
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  logProbs: z.boolean().optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  seed: z.number().int().optional(),
  topLogProbs: z.number().int().min(0).max(20).optional(),
  user: z.string().optional(),
});

export const deepseekChat = modelRef({
  name: "deepseek/deepseek-chat",
  info: {
    label: "DeepSeek - Chat",
    supports: {
      media: false, // 模型是否可以处理媒体作为提示的一部分（多模态输入）。
      output: ["text"], // 模型可以输出的数据类型。
      multiturn: true, // 模型是否可以处理随提示传递的历史消息。
      systemRole: true, // 模型是否可以接受角色为 "system" 的消息。
      tools: true, // 模型是否可以执行工具调用。
      toolChoice: true, // 模型是否支持控制工具选择，例如强制工具调用。
      context: true, // 模型是否可以原生支持基于文档的上下文基础。
    },
  },
  configSchema: DeepSeekConfigSchema,
});

export const deepseekReasoner = modelRef({
  name: "deepseek/deepseek-reasoner",
  info: {
    label: "DeepSeek - Reasoner",
    supports: {
      media: false, // 模型是否可以处理媒体作为提示的一部分（多模态输入）。
      output: ["text"], // 模型可以输出的数据类型。
      multiturn: true, // 模型是否可以处理随提示传递的历史消息。
      systemRole: true, // 模型是否可以接受角色为 "system" 的消息。
      tools: true, // 模型是否可以执行工具调用。
      toolChoice: true, // 模型是否支持控制工具选择，例如强制工具调用。
      context: true, // 模型是否可以原生支持基于文档的上下文基础。
    },
  },
  configSchema: DeepSeekConfigSchema,
});

export const SUPPORTED_DEEPSEEK_MODELS: Record<
  string,
  ModelReference<typeof DeepSeekConfigSchema>
> = {
  "deepseek-chat": deepseekChat,
  "deepseek-reasoner": deepseekReasoner,
};
