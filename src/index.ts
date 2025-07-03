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

export interface PluginOptions {
  apiKey?: string;
  baseURL?: string;
  configSchema?: typeof DeepSeekConfigSchema;
}
export { deepseekChat, deepseekReasoner };

/**
 * 初始化 Genkit 的 DeepSeek 插件。
 *
 * 此函数创建一个名为 "deepseek" 的 Genkit 插件，该插件与 OpenAI API 集成。
 * 它定义了 DeepSeek 支持的模型并设置了它们的配置和运行器。
 *
 * @param options - 插件的可选配置，包括：
 *  - `apiKey`: 访问 OpenAI 服务的 API 密钥。
 *  - `baseURL`: OpenAI API 的基础 URL。
 *
 * @returns 配置了 DeepSeek 模型的 Genkit 插件实例。
 *
 * @module
 * @exports deepseekChat - DeepSeek 聊天模型的函数。
 * @exports deepseekReasoner - DeepSeek 推理模型的函数。
 * @exports deepseek - 初始化 DeepSeek 插件的主函数。
 */
export const deepseek = (options?: PluginOptions) =>
  genkitPlugin("deepseek", async (ai: Genkit) => {
    const apiKey = options?.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        "需要 DeepSeek API 密钥。请通过插件选项传递或设置 DEEPSEEK_API_KEY 环境变量。"
      );
    }

    const baseURL =
      options?.baseURL ||
      process.env.DEEPSEEK_API_URL ||
      "https://api.deepseek.com";

    const client = new OpenAI({ apiKey, baseURL });
    for (const name of Object.keys(SUPPORTED_DEEPSEEK_MODELS)) {
      const model = SUPPORTED_DEEPSEEK_MODELS[name];
      // 定义模型选项
      const opts: DefineModelOptions<typeof DeepSeekConfigSchema> = {
        name: model.name,
        supports: model.info?.supports,
        configSchema: _.merge(model.configSchema, options?.configSchema),
      };
      // 定义流式回调
      const streamingCallback: (
        request: GenerateRequest<typeof DeepSeekConfigSchema>,
        streamingCallback?: StreamingCallback<GenerateResponseChunkData>
      ) => Promise<GenerateResponseData> = deepseekRunner(name, client);
      // 定义新模型并将其添加到注册表中。
      ai.defineModel(opts, streamingCallback);
    }
  });

export default deepseek;
