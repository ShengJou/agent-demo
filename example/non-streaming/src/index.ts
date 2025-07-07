/**
 * DeepSeek 非流式响应示例
 *
 * 此示例展示了如何使用 genkitx-deepseek 插件进行基础的文本生成。
 * 非流式响应会等待 AI 完成全部内容生成后一次性返回结果。
 *
 * 非流式响应的特点：
 * - 简单易用：一次调用，完整返回
 * - 完整性保证：确保获得完整的生成内容
 * - 适合批处理：适用于不需要实时反馈的场景
 * - 内存友好：不需要处理流式数据
 *
 * 适用场景：
 * - 批量内容生成
 * - 简单的问答系统
 * - 文本摘要和分析
 * - 不需要实时反馈的应用
 * - 脚本和自动化任务
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

import { deepseek, deepseekReasoner } from "genkitx-deepseek";
import { genkit } from "genkit";
import * as dotenv from "dotenv";

// 加载环境变量配置
dotenv.config();

/**
 * 配置 Genkit 实例
 *
 * 使用 DeepSeek Chat 模型进行文本生成。
 * DeepSeek Chat 模型特点：
 * - 响应速度快
 * - 适合一般对话和内容生成
 * - 支持多种输出格式
 * - 成本效益好
 */
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner,
});

/**
 * 主函数：演示基础文本生成
 *
 * 此函数展示了如何：
 * 1. 使用 generate 方法进行非流式生成
 * 2. 等待完整的响应结果
 * 3. 处理生成的文本内容
 */
(async () => {
  // 发起非流式生成请求
  const { text } = await ai.generate("请给我讲一个有趣的科技笑话！");

  // 输出完整的生成结果
  console.log("AI 生成的内容：");
  console.log(text);
})();
