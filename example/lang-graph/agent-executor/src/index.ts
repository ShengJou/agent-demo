#!/usr/bin/env node

import readline from "node:readline";
import { Calculator } from "@langchain/community/tools/calculator";
import model from "../llm";
import { getWeather } from "./tools";
import { BaseMessage } from "@langchain/core/messages";
import { match } from "ts-pattern";
import llm from "../llm";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";

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

    try {
      const prompt = await pull<ChatPromptTemplate>(
        "hwchase17/openai-tools-agent"
      );
      const agent = await createOpenAIToolsAgent({
        llm,
        tools: [getWeather],
        prompt: prompt,
      });
      const agentExecutor = new AgentExecutor({
        agent,
        tools: [getWeather],
      });
      const stream = await agentExecutor.stream({
        input: input,
      });
      for await (const chunk of stream) {
        // 工具调用结果
        // chunk.intermediateSteps?.forEach((step) => {
        //   console.log(step.observation);
        // });

        // 最终结果
        if (chunk.output) {
          console.log(chunk.output);
        }
      }

      // 发起非流式生成请求
      // const res = await model.invoke([
      //   {
      //     role: "user",
      //     content: input,
      //   },
      // ]);
      // 发起流式生成请求
      // const stream = await model
      //   .bindTools([getWeather], {
      //     tool_choice: "auto",
      //   })
      //   .stream(messages);
      // for await (const chunk of stream) {
      //   // 处理普通文本内容
      //   if (chunk.text) {
      //     process.stdout.write(chunk.text);
      //   }
      //   // 处理推理内容（如果有）
      //   if (chunk.additional_kwargs?.reasoning_content) {
      //     process.stdout.write(
      //       colorize(
      //         "dim",
      //         chunk.additional_kwargs.reasoning_content as string
      //       )
      //     );
      //   }
      //   // 检查是否有工具调用
      //   if (chunk.tool_calls && chunk.tool_calls.length > 0) {
      //     for (const toolCall of chunk.tool_calls) {
      //       // 执行工具调用
      //       const toolResponse = match(toolCall.name).with(
      //         "getWeather",
      //         async () => {
      //           return await getWeather.invoke(toolCall.args);
      //         }
      //       );
      //       // 创建工具消息继续对话
      //       messages = [
      //         ...messages,
      //         { role: "assistant", content: "", tool_calls: [toolCall] },
      //         {
      //           role: "tool" as const,
      //           content: JSON.stringify(toolResponse),
      //           tool_call_id: toolCall.id,
      //         },
      //       ];
      //     }
      //   }
      // }
    } catch (error: any) {
      console.error(colorize("red", "错误:"), error.message);
    } finally {
      // 确保始终显示下一个提示符
      rl.prompt();
    }
  }).on("close", () => {
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
