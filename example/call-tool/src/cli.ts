#!/usr/bin/env node

/**
 * 交互式 DeepSeek Agent CLI 工具
 *
 * 此工具提供了一个交互式的命令行界面，用于与 DeepSeek 模型进行对话。
 * 主要功能包括：
 * - 支持与 DeepSeek 模型的实时对话
 * - 自动调用 TMDB 工具搜索电影和人物信息
 * - 彩色输出和用户友好的界面
 * - 支持多轮对话和工具调用
 *
 * 使用方法：
 * 1. 确保已设置环境变量：DEEPSEEK_API_KEY 和 TMDB_API_KEY
 * 2. 运行 npm run cli 启动交互式界面
 * 3. 输入消息与 AI 对话，输入 /help 查看帮助，输入 /exit 退出
 *
 * 支持的命令：
 * - /help：显示帮助信息
 * - /exit：退出程序
 */

import readline from "node:readline";
import { ai } from "./genkit";
import { searchMovies, searchPeople } from "./tools";
import { GenerateOptions, ToolResponsePart } from "genkit";

// --- ANSI 颜色定义 ---
/**
 * 定义终端输出的颜色代码
 * 用于美化输出，提供更好的用户体验
 */
const colors = {
  reset: "\x1b[0m", // 重置颜色
  green: "\x1b[32m", // 绿色
  yellow: "\x1b[33m", // 黄色
  blue: "\x1b[34m", // 蓝色
  cyan: "\x1b[36m", // 青色
  red: "\x1b[31m", // 红色
  dim: "\x1b[2m", // 暗淡
};

/**
 * 给文本添加颜色的工具函数
 * @param color 颜色名称
 * @param text 要着色的文本
 * @returns 带有颜色代码的文本
 */
function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// --- Readline 设置 ---
/**
 * 创建 readline 接口用于处理用户输入
 * 配置了输入/输出流和提示符样式
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: colorize("cyan", "You: "),
});

// --- 主循环 ---
/**
 * 主函数：启动交互式 CLI 界面
 *
 * 此函数实现了：
 * 1. 初始化用户界面
 * 2. 处理用户输入和命令
 * 3. 与 AI 模型交互
 * 4. 处理工具调用
 * 5. 错误处理和用户反馈
 */
async function main() {
  // 显示欢迎信息
  console.log(colorize("blue", `🤖 DeepSeek Agent`));
  console.log(colorize("dim", `输入 /help 获取帮助，/exit 退出\n`));

  rl.setPrompt(colorize("cyan", `You: `));
  rl.prompt();

  // 监听用户输入
  rl.on("line", async (line) => {
    const input = line.trim();

    // 跳过空输入
    if (!input) {
      rl.prompt();
      return;
    }

    // 处理系统命令
    if (input.toLowerCase() === "/help") {
      console.log(colorize("blue", "\n命令:"));
      console.log(colorize("dim", "  /exit - 退出\n"));
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "/exit") {
      console.log(colorize("yellow", "再见!"));
      rl.close();
      return;
    }

    // 使用 AI 处理用户消息
    try {
      /**
       * 配置 AI 生成选项
       * 包括系统提示词、工具、生成参数等
       */
      const generateOptions: GenerateOptions = {
        system: "你是一个乐于助人的助手，能够查找娱乐行业的电影和人物信息。",
        prompt: input,
        messages: [], // 对话历史消息
        tools: [searchMovies, searchPeople], // 可用的工具
        toolChoice: "auto", // 自动选择是否使用工具
        maxTurns: 5, // 最大对话轮数
        // returnToolRequests: true, // 当为 true 时，返回工具调用以进行手动处理，而不是自动解析它们。
        config: {
          temperature: 0.7, // 创造性参数：0(确定) - 2(创造)
          /**
           * **top_p采样**（也称为nucleus sampling）是另一种采样策略。
           * 它不再固定保留的token数量（k），而是**动态选择概率累积和达到阈值p的最小token集合**
           * （即累积概率从高到低直到超过p），然后重新归一化这些token的概率并采样。
           *
           * 工作步骤：
           * 1. 模型输出原始logits，计算softmax概率分布。
           * 2. 将概率从大到小排序。
           * 3. 从概率最大的token开始累加概率，直到累积概率首次超过阈值p（例如0.9）。
           * 4. 将所涉及的所有token（这些token的累积概率≥p）作为一个集合。
           * 5. 将这些token的概率重新归一化。
           * 6. 从这个归一化后的概率分布中采样一个token。
           *
           * 参数设置：
           * - **p值选择**：通常设置在0.5到1.0之间（如0.9, 0.95）。常见值为0.9或0.95。
           *   - p值小（如0.5）：候选集合小，生成结果更确定。
           *   - p值大（如0.99）：候选集合大，生成结果更多样。
           */
          topP: 1.0,
          /**
           * **top_k采样**：在生成每个token时，模型会计算所有可能token的概率分布。
           * top_k采样的做法是：**只保留概率最高的k个token**，然后在这些token中进行
           * 重新归一化（使其概率之和为1），最后从这个新的分布中采样。
           *
           * 工作步骤：
           * 1. 模型输出原始logits，并计算softmax概率分布。
           * 2. 从概率分布中选取概率值最大的前k个token。
           * 3. 将这k个token的概率重新归一化（即这k个token的概率除以它们的概率之和）。
           * 4. 从这k个token的重新归一化后的概率分布中采样一个token作为输出。
           *
           * 参数设置：
           * - 通常设置为几十到几百之间（如20, 50, 100等）。具体值需要根据任务调整。
           * - k值过小（如k=1）：相当于贪心搜索（greedy search），生成结果确定性强但容易重复。
           * - k值过大（如k=整个词表大小）：相当于原始的多项式采样（multinomial sampling），随机性大。
           */
          topK: 1,
          truncation: "disabled", // 禁用截断
          presence_penalty: 0.0, // 存在惩罚：减少重复主题
          frequency_penalty: 0.0, // 频率惩罚：减少重复词汇
        },
      };

      /**
       * 主对话循环
       * 处理多轮对话和工具调用
       */
      while (true) {
        // 发起流式生成请求
        const { response, stream } = await ai.generateStream(generateOptions);

        // 处理流式输出，实时显示生成过程
        for await (const chunk of stream) {
          if (chunk.text) {
            process.stdout.write(chunk.text);
          }
        }

        // 获取完整响应
        const llmResponse = await response;
        const toolRequests = llmResponse.toolRequests;

        // 如果没有工具调用请求，结束对话
        if (toolRequests.length < 1) {
          break;
        }

        /**
         * 处理工具调用请求
         * 遍历所有工具调用，执行相应的工具函数
         */
        const toolResponses: ToolResponsePart[] = await Promise.all(
          toolRequests.map(async (part) => {
            // 解析工具名称并调用对应的工具
            switch (part.toolRequest.name) {
              case "searchMovies":
                return {
                  toolResponse: {
                    name: part.toolRequest.name,
                    ref: part.toolRequest.ref,
                    output: await searchMovies(
                      JSON.parse(part.toolRequest.input as string)
                    ),
                  },
                };
              case "searchPeople":
                return {
                  toolResponse: {
                    name: part.toolRequest.name,
                    ref: part.toolRequest.ref,
                    output: await searchPeople(
                      JSON.parse(part.toolRequest.input as string)
                    ),
                  },
                };
              default:
                throw Error("未找到工具");
            }
          })
        );

        // 更新对话历史和下一轮的输入
        generateOptions.messages = llmResponse.messages;
        generateOptions.prompt = toolResponses;
      }
    } catch (error: any) {
      // 错误处理和用户反馈
      console.error(colorize("red", "错误:"), error.message);

      // 根据错误类型提供相应的帮助信息
      if (error.message?.includes("API key")) {
        console.error(
          colorize("yellow", "提示: 请检查 .env 文件中的 API 密钥配置")
        );
      } else if (error.message?.includes("network")) {
        console.error(colorize("yellow", "提示: 请检查网络连接"));
      } else if (error.message?.includes("rate limit")) {
        console.error(colorize("yellow", "提示: 请求频率过高，请稍后重试"));
      }
    } finally {
      // 确保始终显示下一个提示符
      rl.prompt();
    }
  }).on("close", () => {
    // 处理程序关闭
    console.log(colorize("yellow", "再见!"));
    process.exit(0);
  });
}

// --- 启动程序 ---
/**
 * 启动主函数并处理未捕获的错误
 */
main().catch((err) => {
  console.error(colorize("red", "主函数中的未处理错误:"), err);
  process.exit(1);
});
