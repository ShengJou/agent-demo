/**
 * Router Agent 的 Genkit 配置
 */

import { deepseek, deepseekReasoner } from "../../../../src/index.js";
import { genkit, z } from "genkit";
import { dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Genkit AI配置 - 使用DeepSeek AI模型进行路由决策
 */
export const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner, // 使用 DeepSeek Chat 模型
  promptDir: dirname(fileURLToPath(import.meta.url)), // 提示词目录
});

// 定义路由决策提示
export const routerPrompt = ai.prompt("router");
