/**
 * DeepSeek 模型定义和配置模块
 *
 * 此文件定义了 DeepSeek 插件中可用的模型和配置模式。
 * 包含了模型的基本信息、支持的功能、配置选项等。
 *
 * 支持的模型：
 * - deepseek-chat: 通用聊天模型，适用于大多数对话场景
 * - deepseek-reasoner: 推理模型，具有更强的逻辑推理能力
 *
 * 模型功能特性：
 * - 多轮对话支持
 * - 工具调用支持
 * - 流式响应支持
 * - 系统角色支持
 * - JSON 输出支持
 *
 * @see [DeepSeek 创建聊天完成 API](https://api-docs.deepseek.com/api/create-chat-completion)
 * @see [DeepSeek 推理模型](https://api-docs.deepseek.com/guides/reasoning_model)
 * @version 1.0.0
 */
import { GenerationCommonConfigSchema, ModelReference } from "genkit";
import { modelRef } from "genkit/model";
import { z } from "zod";

/**
 * DeepSeek 模型的配置模式
 *
 * 此模式扩展了 Genkit 的通用配置模式，添加了 DeepSeek 特有的配置选项。
 * 所有配置项都是可选的，如果未提供将使用默认值。
 *
 * @extends GenerationCommonConfigSchema
 */
export const DeepSeekConfigSchema = GenerationCommonConfigSchema.extend({
  /**
   * 频率惩罚参数
   * 用于减少重复内容的生成，范围为 -2.0 到 2.0
   * 正值会根据新 token 在文本中的现有频率对其进行惩罚，降低模型重复同一行的可能性
   * @default 0.0
   */
  frequencyPenalty: z.number().min(-2).max(2).optional(),

  /**
   * 是否返回 log 概率
   * 如果为 true，则返回消息中每个输出 token 的对数概率
   * @default false
   */
  logProbs: z.boolean().optional(),

  /**
   * 存在惩罚参数
   * 用于鼓励模型谈论新话题，范围为 -2.0 到 2.0
   * 正值会根据新 token 是否出现在文本中对其进行惩罚，增加模型谈论新话题的可能性
   * @default 0.0
   */
  presencePenalty: z.number().min(-2).max(2).optional(),

  /**
   * 随机种子
   * 用于确保生成结果的可重复性。相同的种子会产生相同的结果
   * @default undefined
   */
  seed: z.number().int().optional(),

  /**
   * 返回的顶部 log 概率数量
   * 指定要返回的最有可能的 token 数量，范围为 0 到 20
   * 仅在 logProbs 为 true 时有效
   * @default undefined
   */
  topLogProbs: z.number().int().min(0).max(20).optional(),

  /**
   * 用户标识符
   * 用于跟踪和监控用户的唯一字符串，有助于检测滥用行为
   * @default undefined
   */
  user: z.string().optional(),
});

/**
 * DeepSeek Chat 模型引用
 *
 * 通用聊天模型，适用于大多数对话场景。
 * 特点：
 * - 响应速度快
 * - 适合一般对话和文本生成
 * - 支持多轮对话
 * - 支持工具调用
 *
 * 适用场景：
 * - 日常对话
 * - 文本生成
 * - 内容创作
 * - 问答系统
 */
export const deepseekChat = modelRef({
  name: "deepseek/deepseek-chat",
  info: {
    label: "DeepSeek - Chat",
    supports: {
      media: false, // 模型是否可以处理媒体作为提示的一部分（多模态输入）
      output: ["text", "json"], // 模型可以输出的数据类型
      multiturn: true, // 模型是否可以处理随提示传递的历史消息
      systemRole: true, // 模型是否可以接受角色为 "system" 的消息
      tools: true, // 模型是否可以执行工具调用
      toolChoice: true, // 模型是否支持控制工具选择，例如强制工具调用
      context: true, // 模型是否可以原生支持基于文档的上下文基础
    },
  },
  configSchema: DeepSeekConfigSchema,
});

/**
 * DeepSeek Reasoner 模型引用
 *
 * 推理模型，具有更强的逻辑推理和分析能力。
 * 特点：
 * - 推理能力强
 * - 逻辑分析准确
 * - 适合复杂问题解决
 * - 支持高级工具调用
 *
 * 适用场景：
 * - 复杂问题解决
 * - 逻辑推理
 * - 数据分析
 * - 工具调用场景
 * - 需要深度思考的任务
 */
export const deepseekReasoner = modelRef({
  name: "deepseek/deepseek-reasoner",
  info: {
    label: "DeepSeek - Reasoner",
    supports: {
      media: false, // 模型是否可以处理媒体作为提示的一部分（多模态输入）
      output: ["text", "json"], // 模型可以输出的数据类型
      multiturn: true, // 模型是否可以处理随提示传递的历史消息
      systemRole: true, // 模型是否可以接受角色为 "system" 的消息
      tools: true, // 模型是否可以执行工具调用
      toolChoice: true, // 模型是否支持控制工具选择，例如强制工具调用
      context: true, // 模型是否可以原生支持基于文档的上下文基础
    },
  },
  configSchema: DeepSeekConfigSchema,
});

/**
 * 支持的 DeepSeek 模型映射表
 *
 * 此对象包含了所有支持的 DeepSeek 模型的引用，
 * 用于在插件初始化时注册模型。
 *
 * @constant
 * @type {Record<string, ModelReference<typeof DeepSeekConfigSchema>>}
 */
export const SUPPORTED_DEEPSEEK_MODELS: Record<
  string,
  ModelReference<typeof DeepSeekConfigSchema>
> = {
  "deepseek-chat": deepseekChat,
  "deepseek-reasoner": deepseekReasoner,
};
