import readline from "node:readline";
import { v4 as uuidv4 } from "uuid";
import {
  A2AClient,
  JSONRPCErrorResponse,
  MessageSendParams,
  SendMessageSuccessResponse,
} from "./src/lib/index.js";

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
 */
async function main() {
  // 显示欢迎信息
  console.log(colorize("blue", `🤖 DeepSeek Agent`));
  console.log(colorize("dim", `输入 /help 获取帮助，/exit 退出\n`));

  rl.setPrompt(colorize("cyan", `You: `));
  rl.prompt();

  // 创建A2AClient
  const client = new A2AClient("http://localhost:41241");

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
      const messageParams: MessageSendParams = {
        message: {
          messageId: uuidv4(),
          role: "user",
          parts: [{ kind: "text", text: input }],
          kind: "message",
        },
        configuration: {
          blocking: true,
          acceptedOutputModes: ["text/plain"],
        },
      };
      const response = await client.sendMessage(messageParams);
      if ((response as JSONRPCErrorResponse).error) {
        throw new Error((response as JSONRPCErrorResponse).error.message);
      }
      console.log(
        "A2A JS response:",
        (response as SendMessageSuccessResponse).result
      );
    } catch (error: any) {
      console.error(colorize("red", "错误:"), error.message);
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
