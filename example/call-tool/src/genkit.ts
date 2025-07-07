/**
 * Genkit 配置文件
 *
 * 此文件配置了 Genkit 实例以使用 DeepSeek 模型进行聊天和工具调用。
 * 主要配置包括：
 * - DeepSeek 插件初始化
 * - 默认模型设置
 * - 提示词目录配置
 * - 环境变量加载
 */

import { deepseek, deepseekReasoner } from "genkitx-deepseek";
import { genkit } from "genkit";
import * as dotenv from "dotenv";
import path from "path";

// 加载环境变量配置
dotenv.config();

/**
 * 配置 Genkit 实例
 *
 * 此配置将：
 * 1. 使用 DeepSeek 插件，从环境变量中获取 API 密钥
 * 2. 设置默认模型为 deepseekReasoner（推理模型）
 * 3. 配置提示词目录路径
 */
export const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner, // 使用 DeepSeek 推理模型作为默认模型
  // promptDir: path.join(__dirname, "../prompts"), // 存储提示词的目录
});

// 重新导出 zod 验证库，用于定义工具输入模式
export { z } from "genkit";
