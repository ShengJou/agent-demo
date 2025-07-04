import { deepseek, deepseekReasoner } from "../../../src/index";
import { genkit, MessageData } from "genkit";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

// 配置 Genkit 实例
export const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner,
  // 存储点提示的目录。
  promptDir: path.join(__dirname, "../prompts"),
});

export { z } from "genkit";
