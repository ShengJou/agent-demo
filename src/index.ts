/**
 * genkitx-deepseek 插件主入口文件
 *
 * 此文件是 Firebase Genkit 的 DeepSeek 插件的主要入口点。
 * 它提供了与 DeepSeek AI 模型集成的完整功能，包括：
 * - 聊天模型 (deepseek-chat)
 * - 推理模型 (deepseek-reasoner)
 * - 工具调用支持
 * - 流式响应支持
 * - 多轮对话支持
 *
 * 主要功能：
 * - 初始化 DeepSeek 插件
 * - 配置模型和运行器
 * - 处理 API 认证
 * - 设置默认配置
 *
 * 使用示例：
 * ```typescript
 * import { deepseek, deepseekReasoner } from "genkitx-deepseek";
 * import { genkit } from "genkit";
 *
 * const ai = genkit({
 *   plugins: [deepseek({ apiKey: "your-api-key" })],
 *   model: deepseekReasoner,
 * });
 * ```
 *
 * @version 1.0.0
 * @author genkitx-deepseek
 * @see https://api-docs.deepseek.com/
 */

import {
  GenerateRequest,
  GenerateResponseChunkData,
  GenerateResponseData,
  Genkit,
  StreamingCallback,
} from "genkit";
import { genkitPlugin } from "genkit/plugin";
import { OpenAI } from "openai";
import {
  deepseekChat,
  DeepSeekConfigSchema,
  deepseekReasoner,
  SUPPORTED_DEEPSEEK_MODELS,
} from "./models";
import { deepseekRunner } from "./runner";
import { DefineModelOptions } from "genkit/model";
import _ from "lodash";

/**
 * DeepSeek 插件的配置选项接口
 *
 * @interface PluginOptions
 * @property {string} [apiKey] - DeepSeek API 密钥，如果未提供则使用环境变量 DEEPSEEK_API_KEY
 * @property {string} [baseURL] - DeepSeek API 的基础 URL，默认为 https://api.deepseek.com
 * @property {typeof DeepSeekConfigSchema} [configSchema] - 自定义配置模式，用于扩展默认配置
 *
 * @example
 * ```typescript
 * const options: PluginOptions = {
 *   apiKey: "your-api-key",
 *   baseURL: "https://api.deepseek.com",
 * };
 * ```
 */
export interface PluginOptions {
  apiKey?: string;
  baseURL?: string;
  configSchema?: typeof DeepSeekConfigSchema;
}

// 导出模型引用，便于外部使用
export { deepseekChat, deepseekReasoner };

/**
 * 初始化 Genkit 的 DeepSeek 插件
 *
 * 此函数创建一个名为 "deepseek" 的 Genkit 插件，该插件与 DeepSeek API 集成。
 * 它定义了 DeepSeek 支持的模型并设置了它们的配置和运行器。
 *
 * 插件初始化过程：
 * 1. 验证 API 密钥（优先使用参数，其次使用环境变量）
 * 2. 配置 OpenAI 兼容的客户端
 * 3. 遍历所有支持的 DeepSeek 模型
 * 4. 为每个模型设置配置和运行器
 * 5. 注册模型到 Genkit 框架
 *
 * @param options - 插件的可选配置选项
 * @param options.apiKey - DeepSeek API 密钥，如果未提供则使用 DEEPSEEK_API_KEY 环境变量
 * @param options.baseURL - DeepSeek API 的基础 URL，默认为 https://api.deepseek.com
 * @param options.configSchema - 自定义配置模式，用于扩展默认配置
 *
 * @returns 配置了 DeepSeek 模型的 Genkit 插件实例
 *
 * @throws {Error} 当 API 密钥未提供且环境变量未设置时抛出错误
 *
 * @example
 * ```typescript
 * // 使用 API 密钥初始化
 * const ai = genkit({
 *   plugins: [deepseek({ apiKey: "your-api-key" })],
 *   model: deepseekReasoner,
 * });
 *
 * // 使用环境变量初始化
 * process.env.DEEPSEEK_API_KEY = "your-api-key";
 * const ai = genkit({
 *   plugins: [deepseek()],
 *   model: deepseekChat,
 * });
 * ```
 */
export const deepseek = (options?: PluginOptions) =>
  genkitPlugin("deepseek", async (ai: Genkit) => {
    // 获取 API 密钥，优先使用参数，其次使用环境变量
    const apiKey = options?.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        "需要 DeepSeek API 密钥。请通过插件选项传递或设置 DEEPSEEK_API_KEY 环境变量。"
      );
    }

    // 配置 API 基础 URL
    const baseURL =
      options?.baseURL ||
      process.env.DEEPSEEK_API_URL ||
      "https://api.deepseek.com";

    // 创建 OpenAI 兼容的客户端
    const client = new OpenAI({ apiKey, baseURL });

    // 遍历所有支持的 DeepSeek 模型并注册
    for (const name of Object.keys(SUPPORTED_DEEPSEEK_MODELS)) {
      const model = SUPPORTED_DEEPSEEK_MODELS[name];

      // 定义模型配置选项
      const opts: DefineModelOptions<typeof DeepSeekConfigSchema> = {
        name: model.name,
        supports: model.info?.supports, // 模型支持的功能（工具调用、流式等）
        configSchema: _.merge(model.configSchema, options?.configSchema), // 合并自定义配置
      };

      // 创建模型运行器（处理请求和响应的核心逻辑）
      const streamingCallback: (
        request: GenerateRequest<typeof DeepSeekConfigSchema>,
        streamingCallback?: StreamingCallback<GenerateResponseChunkData>
      ) => Promise<GenerateResponseData> = deepseekRunner(name, client);

      // 注册模型到 Genkit 框架
      ai.defineModel(opts, streamingCallback);
    }
  });

// 默认导出主插件函数
export default deepseek;
