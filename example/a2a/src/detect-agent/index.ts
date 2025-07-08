import express from "express";
import { v4 as uuidv4 } from "uuid"; // 用于生成唯一ID

import {
  InMemoryTaskStore,
  TaskStore,
  A2AExpressApp,
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  AgentCard,
  Task,
  TaskState,
  TaskStatusUpdateEvent,
  TextPart,
  Message,
} from "../lib/index.js";
import { MessageData } from "genkit";
import { ai } from "./genkit.js";
import { detectObjects } from "./tools.js";
import * as dotenv from "dotenv";

// 加载环境变量配置
dotenv.config();

if (!process.env.DEEPSEEK_API_KEY) {
  console.error("需要 DEEPSEEK_API_KEY 环境变量");
  process.exit(1);
}

// 上下文的简单存储
const contexts: Map<string, Message[]> = new Map();

// 加载Genkit提示
const detectAgentPrompt = ai.prompt("detect_agent");

/**
 * DetectAgentExecutor实现物体检测代理的核心逻辑。
 */
class DetectAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // execute循环负责发布最终状态
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    // 确定任务和上下文的ID
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(
      `[DetectAgentExecutor] 正在处理消息 ${userMessage.messageId}，任务 ${taskId} (上下文: ${contextId})`
    );

    // 1. 如果是新任务，发布初始Task事件
    if (!existingTask) {
      const initialTask: Task = {
        kind: "task",
        id: taskId,
        contextId: contextId,
        status: {
          state: "submitted",
          timestamp: new Date().toISOString(),
        },
        history: [userMessage], // 使用当前用户消息开始历史记录
        metadata: userMessage.metadata, // 如果有的话，从消息中继承元数据
      };
      eventBus.publish(initialTask);
    }

    // 2. 发布"工作中"状态更新
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: "正在处理您的问题，请稍等！" }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    // 3. 为Genkit提示准备消息
    const historyForGenkit = contexts.get(contextId) || [];
    if (!historyForGenkit.find((m) => m.messageId === userMessage.messageId)) {
      historyForGenkit.push(userMessage);
    }
    contexts.set(contextId, historyForGenkit);

    const messages: MessageData[] = historyForGenkit
      .map((m) => ({
        role: (m.role === "agent" ? "model" : "user") as "user" | "model",
        content: m.parts
          .filter(
            (p): p is TextPart => p.kind === "text" && !!(p as TextPart).text
          )
          .map((p) => ({
            text: (p as TextPart).text,
          })),
      }))
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[DetectAgentExecutor] 任务 ${taskId} 的历史记录中未找到有效的文本消息。`
      );
      const failureUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: "未找到要处理的消息。" }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
      return;
    }

    const goal =
      (existingTask?.metadata?.goal as string | undefined) ||
      (userMessage.metadata?.goal as string | undefined);

    try {
      // 4. 运行Genkit提示
      const response = await detectAgentPrompt(
        { goal: goal, now: new Date().toISOString() },
        {
          messages,
          tools: [detectObjects],
        }
      );

      // 检查请求是否已被取消
      if (this.cancelledTasks.has(taskId)) {
        console.log(`[DetectAgentExecutor] 任务 ${taskId} 已被取消`);

        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: "status-update",
          taskId: taskId,
          contextId: contextId,
          status: {
            state: "canceled",
            timestamp: new Date().toISOString(),
          },
          final: true, // 取消是最终状态
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      const responseText = response.text; // 使用.text()访问text属性
      console.info(`[DetectAgentExecutor] 提示响应: ${responseText}`);
      const lines = responseText.trim().split("\n");
      const finalStateLine = lines.at(-1)?.trim().toUpperCase();
      const agentReplyText = lines
        .slice(0, lines.length - 1)
        .join("\n")
        .trim();

      let finalA2AState: TaskState = "unknown";

      if (finalStateLine === "COMPLETED") {
        finalA2AState = "completed";
      } else if (finalStateLine === "AWAITING_USER_INPUT") {
        finalA2AState = "input-required";
      } else {
        console.warn(
          `[DetectAgentExecutor] 提示返回的最终状态行异常: ${finalStateLine}，默认设为 'completed'。`
        );
        finalA2AState = "completed"; // 如果LLM偏离则默认
      }

      // 5. 发布最终任务状态更新
      const agentMessage: Message = {
        kind: "message",
        role: "agent",
        messageId: uuidv4(),
        parts: [{ kind: "text", text: agentReplyText || "Completed." }], // 确保有一些文本
        taskId: taskId,
        contextId: contextId,
      };
      historyForGenkit.push(agentMessage);
      contexts.set(contextId, historyForGenkit);

      const finalUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: finalA2AState,
          message: agentMessage,
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);

      console.log(
        `[DetectAgentExecutor] 任务 ${taskId} 已完成，状态: ${finalA2AState}`
      );
    } catch (error: any) {
      console.error(`[DetectAgentExecutor] 处理任务 ${taskId} 时出错:`, error);
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: `代理错误: ${error.message}` }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }
}

// --- 服务器设置 ---
const detectAgentCard: AgentCard = {
  name: "物体检测助手",
  description:
    "一个可以分析图像并检测其中物体的智能AI助手，支持80种常见物体类别识别。",
  // 根据需要调整基础URL和端口。/a2a是A2AExpressApp中的默认基础
  url: "http://localhost:41242/", // 示例：如果A2AExpressApp中的baseUrl
  provider: {
    organization: "A2A 示例",
    url: "https://example.com/a2a-samples", // 添加提供者URL
  },
  version: "0.1.0", // 物体检测版本
  capabilities: {
    streaming: true, // 新框架支持流式传输
    pushNotifications: false, // 假设此代理尚未实现
    stateTransitionHistory: true, // 代理使用历史记录
  },
  // authentication: null, // Property 'authentication' does not exist on type 'AgentCard'.
  securitySchemes: undefined, // 或者如果有的话定义实际的安全方案
  security: undefined,
  defaultInputModes: ["text", "image"],
  defaultOutputModes: ["text", "task-status", "image"], // 支持图像输出
  skills: [
    {
      id: "object_detection",
      name: "物体检测与分析",
      description:
        "使用YOLOv8模型检测图像中的物体，识别位置、类别和置信度，支持边界框绘制。",
      tags: ["物体检测", "图像分析", "计算机视觉", "YOLOv8"],
      examples: [
        "请分析这张图片中有什么物体",
        "检测图像中的所有人物和车辆",
        "识别照片里的动物种类",
        "帮我标记出图片中的所有物品",
        "分析这张街景图片中的交通元素",
        "检测并绘制边界框显示所有检测到的物体",
      ],
      inputModes: ["text", "image"], // 支持文本和图像输入
      outputModes: ["text", "task-status", "image"], // 支持图像输出
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  // 1. 创建TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. 创建AgentExecutor
  const agentExecutor: AgentExecutor = new DetectAgentExecutor();

  // 3. 创建DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    detectAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. 创建并设置A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express());

  // 5. 启动服务器
  const PORT = process.env.PORT || 41242;
  expressApp.listen(PORT, () => {
    console.log(
      `[DetectAgent] 物体检测代理服务器已启动: http://localhost:${PORT}`
    );
    console.log(
      `[DetectAgent] 代理卡片信息: http://localhost:${PORT}/.well-known/agent.json`
    );
    console.log("[DetectAgent] 按 Ctrl+C 停止服务器");
  });
}

main().catch(console.error);
