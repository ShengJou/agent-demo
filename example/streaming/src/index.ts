/**
 * DeepSeek 流式响应示例
 *
 * 此示例展示了如何使用 genkitx-deepseek 插件进行流式文本生成。
 * 流式响应允许实时接收 AI 生成的内容，提供更好的用户体验。
 *
 * 流式响应的优势：
 * - 实时反馈：用户可以立即看到 AI 开始生成内容
 * - 更好的交互性：减少用户等待时间
 * - 逐步输出：内容逐字逐句地显示
 * - 可中断性：可以在生成过程中停止
 *
 * 适用场景：
 * - 聊天应用
 * - 实时写作助手
 * - 内容创作工具
 * - 需要即时反馈的应用
 *
 * 使用前准备：
 * 1. 确保已设置环境变量 DEEPSEEK_API_KEY
 * 2. 安装必要的依赖包
 * 3. 配置 .env 文件
 *
 * @example
 * 运行此示例：
 * ```bash
 * npm start
 * ```
 */

import { deepseek, deepseekChat } from "genkitx-deepseek";
import { genkit } from "genkit";
import * as dotenv from "dotenv";

// 加载环境变量配置
dotenv.config();

/**
 * 配置 Genkit 实例
 *
 * 使用 DeepSeek Chat 模型进行流式文本生成。
 * DeepSeek Chat 模型特点：
 * - 响应速度快
 * - 适合一般对话场景
 * - 支持流式输出
 */
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekChat, // 使用 DeepSeek Chat 模型
});

/**
 * 主函数：演示流式文本生成
 *
 * 此函数展示了如何：
 * 1. 使用 generateStream 方法进行流式生成
 * 2. 实时处理生成的文本块
 * 3. 获取完整的响应结果
 */
(async () => {
  // 发起流式生成请求
  const { response, stream } = await ai.generateStream(
    "请用不少于100字描述人工智能的发展历程"
  );

  // 实时处理流式响应，逐块输出生成的内容
  for await (const chunk of stream) {
    process.stdout.write(chunk.text); // 实时输出，不换行
  }

  // 输出完整的响应结果（可选，用于验证完整性）
  console.log("\n\n--- 完整响应 ---");
  console.log((await response).text);
})();
