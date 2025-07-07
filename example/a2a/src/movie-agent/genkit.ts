import { deepseek, deepseekReasoner } from "genkitx-deepseek";
import { genkit } from "genkit";

/**
 * Genkit AI配置 - 使用Google AI模型
 */
export const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner, // 使用 DeepSeek Chat 模型
  promptDir: __dirname, // 提示词目录
});

// 导出z用于schema验证
export { z } from "genkit";
