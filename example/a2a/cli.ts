#!/usr/bin/env node

import readline from "node:readline";
import crypto from "node:crypto";

import {
  // CLI使用的特定参数/负载类型
  MessageSendParams, // 从TaskSendParams更改
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  Message,
  Task, // 为直接Task事件添加
  // 消息/部分处理所需的其他类型
  TaskState,
  FilePart,
  DataPart,
  // 代理卡片的类型
  AgentCard,
  Part, // 为显式Part类型添加
  A2AClient,
} from "./src/lib/index.js";

// --- ANSI颜色 ---
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// --- 辅助函数 ---
function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function generateId(): string {
  // 重命名以供更通用的使用
  return crypto.randomUUID();
}

// --- 状态 ---
let currentTaskId: string | undefined = undefined; // 初始化为undefined
let currentContextId: string | undefined = undefined; // 初始化为undefined
const serverUrl = process.argv[2] || "http://localhost:41241"; // 代理的基础URL
const client = new A2AClient(serverUrl);
let agentName = "Agent"; // 默认值，稍后尝试从代理卡片获取

// --- Readline设置 ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: colorize("cyan", "You: "),
});

// --- 响应处理 ---
// 函数现在直接接受解包的事件负载
function printAgentEvent(
  event: TaskStatusUpdateEvent | TaskArtifactUpdateEvent
) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = colorize("magenta", `\n${agentName} [${timestamp}]:`);

  // 检查是否为TaskStatusUpdateEvent
  if (event.kind === "status-update") {
    const update = event as TaskStatusUpdateEvent; // 为类型安全进行转换
    const state = update.status.state;
    let stateEmoji = "❓";
    let stateColor: keyof typeof colors = "yellow";

    switch (state) {
      case "working":
        stateEmoji = "⏳";
        stateColor = "blue";
        break;
      case "input-required":
        stateEmoji = "🤔";
        stateColor = "yellow";
        break;
      case "completed":
        stateEmoji = "✅";
        stateColor = "green";
        break;
      case "canceled":
        stateEmoji = "⏹️";
        stateColor = "gray";
        break;
      case "failed":
        stateEmoji = "❌";
        stateColor = "red";
        break;
      default:
        stateEmoji = "ℹ️"; // 对于其他状态，如已提交、已拒绝等。
        stateColor = "dim";
        break;
    }

    console.log(
      `${prefix} ${stateEmoji} Status: ${colorize(stateColor, state)} (Task: ${
        update.taskId
      }, Context: ${update.contextId}) ${
        update.final ? colorize("bright", "[FINAL]") : ""
      }`
    );

    if (update.status.message) {
      printMessageContent(update.status.message);
    }
  }
  // 检查是否为TaskArtifactUpdateEvent
  else if (event.kind === "artifact-update") {
    const update = event as TaskArtifactUpdateEvent; // 为类型安全进行转换
    console.log(
      `${prefix} 📄 Artifact Received: ${
        update.artifact.name || "(unnamed)"
      } (ID: ${update.artifact.artifactId}, Task: ${update.taskId}, Context: ${
        update.contextId
      })`
    );
    // 创建临时的类似消息的结构以重用printMessageContent
    printMessageContent({
      messageId: generateId(), // 虚拟messageId
      kind: "message", // 虚拟kind
      role: "agent", // 假设工件部分来自代理
      parts: update.artifact.parts,
      taskId: update.taskId,
      contextId: update.contextId,
    });
  } else {
    // 如果正确调用，这种情况理想情况下不应该达到
    console.log(
      prefix,
      colorize("yellow", "Received unknown event type in printAgentEvent:"),
      event
    );
  }
}

function printMessageContent(message: Message) {
  message.parts.forEach((part: Part, index: number) => {
    // 添加显式Part类型
    const partPrefix = colorize("red", `  Part ${index + 1}:`);
    if (part.kind === "text") {
      // 检查kind属性
      console.log(`${partPrefix} ${colorize("green", "📝 Text:")}`, part.text);
    } else if (part.kind === "file") {
      // 检查kind属性
      const filePart = part as FilePart;
      console.log(
        `${partPrefix} ${colorize("blue", "📄 File:")} Name: ${
          filePart.file.name || "N/A"
        }, Type: ${filePart.file.mimeType || "N/A"}, Source: ${
          "bytes" in filePart.file ? "Inline (bytes)" : filePart.file.uri
        }`
      );
    } else if (part.kind === "data") {
      // 检查kind属性
      const dataPart = part as DataPart;
      console.log(
        `${partPrefix} ${colorize("yellow", "📊 Data:")}`,
        JSON.stringify(dataPart.data, null, 2)
      );
    } else {
      console.log(
        `${partPrefix} ${colorize("yellow", "Unsupported part kind:")}`,
        part
      );
    }
  });
}

// --- 代理卡片获取 ---
async function fetchAndDisplayAgentCard() {
  // 使用客户端的getAgentCard方法。
  // 客户端使用serverUrl初始化，这是代理的基础URL。
  console.log(
    colorize(
      "dim",
      `Attempting to fetch agent card from agent at: ${serverUrl}`
    )
  );
  try {
    // client.getAgentCard()使用客户端构造期间提供的agentBaseUrl
    const card: AgentCard = await client.getAgentCard();
    agentName = card.name || "Agent"; // 更新全局代理名称
    console.log(colorize("green", `✓ Agent Card Found:`));
    console.log(`  Name:        ${colorize("bright", agentName)}`);
    if (card.description) {
      console.log(`  Description: ${card.description}`);
    }
    console.log(`  Version:     ${card.version || "N/A"}`);
    if (card.capabilities?.streaming) {
      console.log(`  Streaming:   ${colorize("green", "Supported")}`);
    } else {
      console.log(
        `  Streaming:   ${colorize(
          "yellow",
          "Not Supported (or not specified)"
        )}`
      );
    }
    // 更新提示前缀以使用获取的名称
    // 提示在主循环中每次rl.prompt()调用之前动态设置
    // 以反映当前的agentName（如果在初始获取后更改的话，尽管不太可能）。
  } catch (error: any) {
    console.log(colorize("yellow", `⚠️ Error fetching or parsing agent card`));
    throw error;
  }
}

// --- 主循环 ---
async function main() {
  console.log(colorize("bright", `A2A Terminal Client`));
  console.log(colorize("dim", `Agent Base URL: ${serverUrl}`));

  await fetchAndDisplayAgentCard(); // 在开始循环之前获取卡片

  console.log(
    colorize(
      "dim",
      `No active task or context initially. Use '/new' to start a fresh session or send a message.`
    )
  );
  console.log(
    colorize(
      "green",
      `Enter messages, or use '/new' to start a new session. '/exit' to quit.`
    )
  );

  rl.setPrompt(colorize("cyan", `${agentName} > You: `)); // 设置初始提示
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    rl.setPrompt(colorize("cyan", `${agentName} > You: `)); // 确保提示反映当前的agentName

    if (!input) {
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "/new") {
      currentTaskId = undefined;
      currentContextId = undefined; // 在/new时重置contextId
      console.log(
        colorize(
          "bright",
          `✨ Starting new session. Task and Context IDs are cleared.`
        )
      );
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "/exit") {
      rl.close();
      return;
    }

    // 为sendMessageStream构造参数
    const messageId = generateId(); // 生成唯一的消息ID

    const messagePayload: Message = {
      messageId: messageId,
      kind: "message", // Message接口要求
      role: "user",
      parts: [
        {
          kind: "text", // TextPart接口要求
          text: input,
        },
      ],
    };

    // 有条件地将taskId添加到消息负载
    if (currentTaskId) {
      messagePayload.taskId = currentTaskId;
    }
    // 有条件地将contextId添加到消息负载
    if (currentContextId) {
      messagePayload.contextId = currentContextId;
    }

    const params: MessageSendParams = {
      message: messagePayload,
      // 可选：流式传输、阻塞等的配置。
      // configuration: {
      //   acceptedOutputModes: ['text/plain', 'application/json'], // 示例
      //   blocking: false // 流式传输的默认值通常是非阻塞的
      // }
    };

    try {
      console.log(colorize("red", "Sending message..."));
      // 使用sendMessageStream
      const stream = client.sendMessageStream(params);

      // 迭代流中的事件
      for await (const event of stream) {
        const timestamp = new Date().toLocaleTimeString(); // 为每个事件获取新的时间戳
        const prefix = colorize("magenta", `\n${agentName} [${timestamp}]:`);

        if (
          event.kind === "status-update" ||
          event.kind === "artifact-update"
        ) {
          const typedEvent = event as
            | TaskStatusUpdateEvent
            | TaskArtifactUpdateEvent;
          printAgentEvent(typedEvent);

          // 如果事件是TaskStatusUpdateEvent且是最终的，重置currentTaskId
          if (
            typedEvent.kind === "status-update" &&
            (typedEvent as TaskStatusUpdateEvent).final &&
            (typedEvent as TaskStatusUpdateEvent).status.state !==
              "input-required"
          ) {
            console.log(
              colorize(
                "yellow",
                `   Task ${typedEvent.taskId} is final. Clearing current task ID.`
              )
            );
            currentTaskId = undefined;
            // 可选地，如果任务结束意味着上下文结束，您可能还想清除currentContextId。
            // currentContextId = undefined;
            // console.log(colorize("dim", `   Context ID also cleared as task is final.`));
          }
        } else if (event.kind === "message") {
          const msg = event as Message;
          console.log(
            `${prefix} ${colorize("green", "✉️ Message Stream Event:")}`
          );
          printMessageContent(msg);
          if (msg.taskId && msg.taskId !== currentTaskId) {
            console.log(
              colorize(
                "dim",
                `   Task ID context updated to ${msg.taskId} based on message event.`
              )
            );
            currentTaskId = msg.taskId;
          }
          if (msg.contextId && msg.contextId !== currentContextId) {
            console.log(
              colorize(
                "dim",
                `   Context ID updated to ${msg.contextId} based on message event.`
              )
            );
            currentContextId = msg.contextId;
          }
        } else if (event.kind === "task") {
          const task = event as Task;
          console.log(
            `${prefix} ${colorize("blue", "ℹ️ Task Stream Event:")} ID: ${
              task.id
            }, Context: ${task.contextId}, Status: ${task.status.state}`
          );
          if (task.id !== currentTaskId) {
            console.log(
              colorize(
                "dim",
                `   Task ID updated from ${currentTaskId || "N/A"} to ${
                  task.id
                }`
              )
            );
            currentTaskId = task.id;
          }
          if (task.contextId && task.contextId !== currentContextId) {
            console.log(
              colorize(
                "dim",
                `   Context ID updated from ${currentContextId || "N/A"} to ${
                  task.contextId
                }`
              )
            );
            currentContextId = task.contextId;
          }
          if (task.status.message) {
            console.log(colorize("gray", "   Task includes message:"));
            printMessageContent(task.status.message);
          }
          if (task.artifacts && task.artifacts.length > 0) {
            console.log(
              colorize(
                "gray",
                `   Task includes ${task.artifacts.length} artifact(s).`
              )
            );
          }
        } else {
          console.log(
            prefix,
            colorize("yellow", "Received unknown event structure from stream:"),
            event
          );
        }
      }
      console.log(
        colorize("dim", `--- End of response stream for this input ---`)
      );
    } catch (error: any) {
      const timestamp = new Date().toLocaleTimeString();
      const prefix = colorize("red", `\n${agentName} [${timestamp}] ERROR:`);
      console.error(
        prefix,
        `Error communicating with agent:`,
        error.message || error
      );
      if (error.code) {
        console.error(colorize("gray", `   Code: ${error.code}`));
      }
      if (error.data) {
        console.error(
          colorize("gray", `   Data: ${JSON.stringify(error.data)}`)
        );
      }
      if (!(error.code || error.data) && error.stack) {
        console.error(
          colorize("gray", error.stack.split("\n").slice(1, 3).join("\n"))
        );
      }
    } finally {
      rl.prompt();
    }
  }).on("close", () => {
    console.log(colorize("yellow", "\nExiting A2A Terminal Client. Goodbye!"));
    process.exit(0);
  });
}

// --- 启动 ---
main().catch((err) => {
  console.error(colorize("red", "Unhandled error in main:"), err);
  process.exit(1);
});
