/**
 * 基础工具调用示例
 *
 * 此示例展示了如何使用 Genkit 和 DeepSeek 模型进行工具调用。
 * 它将：
 * 1. 配置 AI 实例使用 TMDB 搜索工具
 * 2. 发送一个关于搜索《泰坦尼克号》的请求
 * 3. 流式处理 AI 响应并输出到控制台
 *
 * 运行此示例前，请确保已设置以下环境变量：
 * - DEEPSEEK_API_KEY：DeepSeek API 密钥
 * - TMDB_API_KEY：TMDB API 密钥
 */

import { ai } from "./genkit";
import { searchMovies, searchPeople } from "./tools";

/**
 * 主函数：执行工具调用示例
 *
 * 此函数演示了如何：
 * 1. 使用 ai.generateStream 方法进行流式生成
 * 2. 传递工具供 AI 使用
 * 3. 设置系统提示词指导 AI 行为
 * 4. 处理流式响应数据
 */
(async () => {
  // 发起生成请求，配置工具和提示词
  const { response, stream } = await ai.generateStream({
    tools: [searchMovies, searchPeople], // 提供给 AI 使用的工具
    prompt: [
      {
        text: "请使用 searchMovies 工具查找有关电影《泰坦尼克号》的信息。",
      },
    ],
    system:
      "你是一个有用的助手，可以在 TMDB 数据库中搜索电影和人物。当被要求搜索电影或人物时，你必须使用提供的工具来搜索信息。总是在被要求搜索电影或人物时调用适当的工具。",
  });

  // 流式处理响应以实时查看生成过程
  for await (const chunk of stream) {
    if (chunk.text) {
      process.stdout.write(chunk.text); // 实时输出生成的文本
    }
  }
})();
