import { deepseek, deepseekReasoner } from "../../../../dist/index.js";
import { genkit } from "genkit";
import { dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Genkit AI配置 - 使用DeepSeek AI模型
 */
export const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner, // 使用 DeepSeek Chat 模型
  promptDir: dirname(fileURLToPath(import.meta.url)), // 提示词目录
});

// 导出z用于schema验证
export { z } from "genkit";
