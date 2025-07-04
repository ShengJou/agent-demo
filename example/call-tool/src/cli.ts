#!/usr/bin/env node

import readline from "node:readline";
import { ai } from "./genkit";
import { searchMovies, searchPeople } from "./tools";
import { GenerateOptions, ToolResponsePart } from "genkit";

// --- ANSI 颜色 ---
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// --- Readline 设置 ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: colorize("cyan", "You: "),
});

// --- 主循环 ---
async function main() {
  console.log(colorize("blue", `🤖 DeepSeek Agent`));
  console.log(colorize("dim", `输入 /help 获取帮助，/exit 退出\n`));

  rl.setPrompt(colorize("cyan", `You: `));
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // 处理命令
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
      const generateOptions: GenerateOptions = {
        system: "你是一个乐于助人的助手，能够查找娱乐行业的电影和人物信息。",
        prompt: input,
        messages: [],
        tools: [searchMovies, searchPeople],
        toolChoice: "auto",
        maxTurns: 5,
        // returnToolRequests: true, // 当为 true 时，返回工具调用以进行手动处理，而不是自动解析它们。
        config: {
          temperature: 1.0,
          topP: 1.0,
          truncation: "disabled",
          presence_penalty: 0.0,
          frequency_penalty: 0.0,
        },
      };

      while (true) {
        const { response, stream } = await ai.generateStream(generateOptions);

        // 处理流以进行实时输出
        for await (const chunk of stream) {
          if (chunk.text) {
            process.stdout.write(chunk.text);
          }
        }

        const llmResponse = await response;
        const toolRequests = llmResponse.toolRequests;
        if (toolRequests.length < 1) {
          break;
        }
        const toolResponses: ToolResponsePart[] = await Promise.all(
          toolRequests.map(async (part) => {
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
        // 更新历史消息
        generateOptions.messages = llmResponse.messages;
        // 更新提示语
        generateOptions.prompt = toolResponses;
      }
    } catch (error: any) {
      console.error(colorize("red", "Error:"), error.message);

      if (error.message?.includes("API key")) {
        console.error(colorize("yellow", "检查 .env 文件"));
      }
    } finally {
      rl.prompt();
    }
  }).on("close", () => {
    console.log(colorize("yellow", "再见!"));
    process.exit(0);
  });
}

// --- 启动 ---
main().catch((err) => {
  console.error(colorize("red", "主函数中的未处理错误:"), err);
  process.exit(1);
});
