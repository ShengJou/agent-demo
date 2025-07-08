import express from "express";
import { v4 as uuidv4 } from "uuid";

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
  A2AClient,
  Part,
} from "../lib/index.js";
import { MessageData } from "genkit";
import { ai, routerPrompt } from "./genkit.js";
import * as dotenv from "dotenv";

// 加载环境变量配置
dotenv.config();

if (!process.env.DEEPSEEK_API_KEY) {
  console.error("需要 DEEPSEEK_API_KEY 环境变量");
  process.exit(1);
}

// 代理配置
const AGENTS = {
  DETECT_AGENT: {
    url: "http://localhost:41242",
    name: "物体检测代理",
  },
  MOVIE_AGENT: {
    url: "http://localhost:41241",
    name: "电影代理",
  },
};

// 上下文的简单存储
const contexts: Map<string, Message[]> = new Map();

/**
 * RouterAgentExecutor实现路由代理的核心逻辑。
 */
class RouterAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private detectClient: A2AClient;
  private movieClient: A2AClient;
  private detectAgentCard: AgentCard | null = null;
  private movieAgentCard: AgentCard | null = null;
  private isInitialized = false;

  constructor() {
    // 初始化客户端实例
    this.detectClient = new A2AClient(AGENTS.DETECT_AGENT.url);
    this.movieClient = new A2AClient(AGENTS.MOVIE_AGENT.url);
  }

  /**
   * 初始化：获取各代理的AgentCard信息
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log(`[RouterAgent] 🔄 正在获取代理信息...`);

      // 获取检测代理的AgentCard
      try {
        this.detectAgentCard = await this.detectClient.getAgentCard();
        console.log(
          `[RouterAgent] ✅ 已获取物体检测代理信息: ${this.detectAgentCard.name}`
        );
      } catch (error) {
        console.warn(
          `[RouterAgent] ⚠️ 获取物体检测代理信息失败: ${error.message}`
        );
      }

      // 获取电影代理的AgentCard
      try {
        this.movieAgentCard = await this.movieClient.getAgentCard();
        console.log(
          `[RouterAgent] ✅ 已获取电影代理信息: ${this.movieAgentCard.name}`
        );
      } catch (error) {
        console.warn(`[RouterAgent] ⚠️ 获取电影代理信息失败: ${error.message}`);
      }

      this.isInitialized = true;
      console.log(`[RouterAgent] 🎉 路由代理初始化完成`);
    } catch (error) {
      console.error(`[RouterAgent] ❌ 初始化失败:`, error);
    }
  }

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
  };

  /**
   * 通过AI智能分析用户意图并决定路由到哪个代理
   */
  private async analyzeAndRoute(
    userInput: string,
    hasImage: boolean = false
  ): Promise<"DETECT_AGENT" | "MOVIE_AGENT" | "DEFAULT"> {
    try {
      console.log(`[RouterAgent] 🧠 开始AI智能路由分析`);
      console.log(`[RouterAgent] 📝 用户输入: "${userInput}"`);
      console.log(`[RouterAgent] 🖼️ 包含图像: ${hasImage}`);

      // 构建代理信息描述
      const agentDescriptions = this.buildAgentDescriptions();
      console.log(`[RouterAgent] 📋 可用代理: ${agentDescriptions.length} 个`);

      // 构建AI分析提示
      const contextualPrompt = this.buildContextualPrompt(
        userInput,
        hasImage,
        agentDescriptions
      );

      // 使用AI进行智能路由分析
      const response = await routerPrompt(
        {
          goal: "基于代理能力和用户需求进行智能路由决策",
          now: new Date().toISOString(),
        },
        {
          messages: [
            {
              role: "user",
              content: [{ text: contextualPrompt }],
            },
          ],
        }
      );

      const aiDecision = response.text.trim().toUpperCase();
      console.log(`[RouterAgent] 🎯 AI分析结果: "${aiDecision}"`);

      // 解析AI决策
      if (
        aiDecision.includes("DETECT_AGENT") ||
        aiDecision.includes("物体检测") ||
        aiDecision.includes("视觉")
      ) {
        console.log(`[RouterAgent] ✅ 路由到物体检测代理`);
        return "DETECT_AGENT";
      } else if (
        aiDecision.includes("MOVIE_AGENT") ||
        aiDecision.includes("电影") ||
        aiDecision.includes("娱乐")
      ) {
        console.log(`[RouterAgent] ✅ 路由到电影代理`);
        return "MOVIE_AGENT";
      } else {
        console.log(`[RouterAgent] 🎭 未命中特定代理，使用通用代理 (电影代理)`);
        return "DEFAULT";
      }
    } catch (error) {
      console.error(`[RouterAgent] ❌ AI路由分析失败:`, error);
      console.log(`[RouterAgent] 🎭 回退到通用代理 (电影代理)`);
      return "DEFAULT";
    }
  }

  /**
   * 构建代理描述信息
   */
  private buildAgentDescriptions(): string[] {
    const descriptions: string[] = [];

    if (this.detectAgentCard) {
      descriptions.push(`**物体检测代理 (DETECT_AGENT)**:
- 名称: ${this.detectAgentCard.name}
- 描述: ${this.detectAgentCard.description}
- 能力: ${
        this.detectAgentCard.skills?.map((skill) => skill.name).join(", ") ||
        "图像分析、物体检测"
      }
- 输入模式: ${
        this.detectAgentCard.defaultInputModes?.join(", ") || "text, image"
      }`);
    }

    if (this.movieAgentCard) {
      descriptions.push(`**电影代理 (MOVIE_AGENT)**:
- 名称: ${this.movieAgentCard.name}
- 描述: ${this.movieAgentCard.description}
- 能力: ${
        this.movieAgentCard.skills?.map((skill) => skill.name).join(", ") ||
        "电影查询、推荐"
      }
- 输入模式: ${this.movieAgentCard.defaultInputModes?.join(", ") || "text"}`);
    }

    return descriptions;
  }

  /**
   * 构建上下文提示信息
   */
  private buildContextualPrompt(
    userInput: string,
    hasImage: boolean,
    agentDescriptions: string[]
  ): string {
    let prompt = `# 智能路由分析

## 用户输入
- 文本: "${userInput}"
- 包含图像: ${hasImage ? "是" : "否"}

## 可用代理
${agentDescriptions.join("\n\n")}

## 路由规则
1. 如果用户需求与某个代理的能力高度匹配，返回对应的代理名称
2. 如果没有明确匹配，返回 DEFAULT 使用通用代理

请分析用户需求并选择最合适的代理。`;

    return prompt;
  }

  /**
   * 检测输入是否包含图像
   */
  private hasImageContent(message: Message): boolean {
    return message.parts.some(
      (part) =>
        part.kind === "file" ||
        part.kind === "data" ||
        (part.kind === "text" && part.text.includes("data:image/"))
    );
  }

  /**
   * 获取代理名称
   */
  private getAgentName(
    targetAgent: "DETECT_AGENT" | "MOVIE_AGENT" | "DEFAULT"
  ): string {
    switch (targetAgent) {
      case "DETECT_AGENT":
        return this.detectAgentCard?.name || "物体检测代理";
      case "MOVIE_AGENT":
        return this.movieAgentCard?.name || "电影代理";
      case "DEFAULT":
        return this.movieAgentCard?.name || "通用代理";
      default:
        return "未知代理";
    }
  }

  /**
   * 转发请求到目标代理
   */
  private async forwardToTargetAgent(
    targetAgent: "DETECT_AGENT" | "MOVIE_AGENT" | "DEFAULT",
    message: Message,
    taskId: string,
    contextId: string
  ): Promise<any> {
    let client: A2AClient;
    let agentName: string;

    // 选择对应的客户端
    switch (targetAgent) {
      case "DETECT_AGENT":
        client = this.detectClient;
        agentName = this.detectAgentCard?.name || "物体检测代理";
        break;
      case "MOVIE_AGENT":
      case "DEFAULT":
        client = this.movieClient;
        agentName = this.movieAgentCard?.name || "电影代理";
        break;
      default:
        throw new Error(`未知的代理类型: ${targetAgent}`);
    }

    console.log(`[RouterAgent] 🔄 转发请求到 ${agentName}`);

    try {
      // 构造转发消息 - 移除taskId让目标代理创建新任务
      const { taskId: _, ...messageWithoutTaskId } = message;
      const forwardMessage: Message = {
        ...messageWithoutTaskId,
        contextId: contextId, // 保持上下文一致性
      };

      console.log(
        `[RouterAgent] 📤 转发消息 (移除taskId): messageId=${forwardMessage.messageId}, contextId=${contextId}`
      );

      // 发送消息并获取流式响应
      const stream = client.sendMessageStream({
        message: forwardMessage,
      });

      return stream;
    } catch (error) {
      console.error(`[RouterAgent] ❌ 转发到 ${agentName} 失败:`, error);
      throw error;
    }
  }

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(
      `[RouterAgent] 处理消息 ${userMessage.messageId}，任务 ${taskId} (上下文: ${contextId})`
    );

    // 1. 发布初始任务状态
    if (!existingTask) {
      const initialTask: Task = {
        kind: "task",
        id: taskId,
        contextId: contextId,
        status: {
          state: "submitted",
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
      };
      eventBus.publish(initialTask);
    }

    // 2. 发布"分析中"状态
    const analyzingUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [
            {
              kind: "text",
              text: "🤔 正在分析您的请求，决定最佳的处理方式...",
            },
          ],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(analyzingUpdate);

    try {
      // 3. 确保初始化完成
      await this.initialize();

      // 4. 分析路由决策
      let targetAgent: "DETECT_AGENT" | "MOVIE_AGENT" | "DEFAULT";

      // 分析请求内容
      const textContent = userMessage.parts
        .filter((p): p is TextPart => p.kind === "text")
        .map((p) => p.text)
        .join(" ");

      const hasImage = this.hasImageContent(userMessage);

      // 使用AI进行智能路由分析
      targetAgent = await this.analyzeAndRoute(textContent, hasImage);

      // 5. 发布路由决策状态
      const agentName = this.getAgentName(targetAgent);
      const routingUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "working",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [
              {
                kind: "text",
                text: `🎯 已分析完成，将为您连接到${agentName}...`,
              },
            ],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(routingUpdate);

      // 6. 转发到目标代理并流式转发响应
      const stream = await this.forwardToTargetAgent(
        targetAgent,
        userMessage,
        taskId,
        contextId
      );

      // 7. 转发流式响应并映射taskId
      for await (const event of stream) {
        if (this.cancelledTasks.has(taskId)) {
          console.log(`[RouterAgent] 任务 ${taskId} 已被取消`);
          break;
        }

        // 将目标代理的事件映射为路由代理的taskId
        let mappedEvent = event;

        if (event.kind === "task") {
          mappedEvent = {
            ...event,
            id: taskId,
            contextId: contextId,
          };
        } else if (event.kind === "status-update") {
          mappedEvent = {
            ...event,
            taskId: taskId,
            contextId: contextId,
          };
        } else if (event.kind === "artifact-update") {
          mappedEvent = {
            ...event,
            taskId: taskId,
            contextId: contextId,
          };
        } else if (event.kind === "message") {
          mappedEvent = {
            ...event,
            taskId: taskId,
            contextId: contextId,
          };
        }

        console.log(
          `[RouterAgent] 📨 转发事件: ${mappedEvent.kind}, taskId: ${taskId}`
        );

        // 转发映射后的事件到客户端
        eventBus.publish(mappedEvent);
      }
    } catch (error: any) {
      console.error(`[RouterAgent] 处理任务 ${taskId} 时出错:`, error);

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
            parts: [{ kind: "text", text: `路由代理错误: ${error.message}` }],
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
const routerAgentCard: AgentCard = {
  name: "智能路由助手",
  description:
    "智能分析用户需求并自动路由到最合适的专门代理。支持物体检测和电影查询两大类服务。",
  url: "http://localhost:41240/",
  provider: {
    organization: "A2A 示例",
    url: "https://example.com/a2a-samples",
  },
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: undefined,
  security: undefined,
  defaultInputModes: ["text", "image"],
  defaultOutputModes: ["text", "task-status", "image"],
  skills: [
    {
      id: "intelligent_routing",
      name: "智能路由分析",
      description: "分析用户输入并自动路由到最合适的专门代理服务。",
      tags: ["路由", "智能分析", "代理调度"],
      examples: [
        "请帮我分析这张图片中的物体",
        "推荐一部好看的科幻电影",
        "检测图像中的汽车和行人",
        "告诉我《星际穿越》的剧情",
        "识别照片里有什么动物",
        "汤姆·汉克斯还演过哪些电影？",
      ],
      inputModes: ["text", "image"],
      outputModes: ["text", "task-status", "image"],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  // 1. 创建TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. 创建AgentExecutor
  const agentExecutor: AgentExecutor = new RouterAgentExecutor();

  // 3. 创建DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    routerAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. 创建并设置A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express());

  // 5. 启动服务器
  const PORT = process.env.PORT || 41240;
  expressApp.listen(PORT, () => {
    console.log(
      `[RouterAgent] 🚀 智能路由代理已启动: http://localhost:${PORT}`
    );
    console.log(
      `[RouterAgent] 📋 代理卡片信息: http://localhost:${PORT}/.well-known/agent.json`
    );
    console.log(`[RouterAgent] 🎯 可路由的代理:`);
    Object.entries(AGENTS).forEach(([key, agent]) => {
      console.log(`   - ${key}: ${agent.name} (${agent.url})`);
    });
    console.log("[RouterAgent] 按 Ctrl+C 停止服务器");
  });
}

main().catch(console.error);
