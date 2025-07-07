import express from 'express';
import { v4 as uuidv4 } from 'uuid'; // 用于生成唯一ID

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
} from '../lib/index.js';
import { MessageData } from 'genkit';
import { ai } from './genkit.js';
import { searchMovies, searchPeople } from './tools.js';
import * as dotenv from 'dotenv';

// 加载环境变量配置
dotenv.config();

if (!process.env.DEEPSEEK_API_KEY || !process.env.TMDB_API_KEY) {
  console.error('需要 DEEPSEEK_API_KEY 和 TMDB_API_KEY 环境变量');
  process.exit(1);
}

// 上下文的简单存储
const contexts: Map<string, Message[]> = new Map();

// 加载Genkit提示
const movieAgentPrompt = ai.prompt('movie_agent');

/**
 * MovieAgentExecutor实现代理的核心逻辑。
 */
class MovieAgentExecutor implements AgentExecutor {
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
      `[MovieAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    // 1. 如果是新任务，发布初始Task事件
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId: contextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage], // 使用当前用户消息开始历史记录
        metadata: userMessage.metadata, // 如果有的话，从消息中继承元数据
      };
      eventBus.publish(initialTask);
    }

    // 2. 发布"工作中"状态更新
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'working',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [
            { kind: 'text', text: 'Processing your question, hang tight!' },
          ],
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
        role: (m.role === 'agent' ? 'model' : 'user') as 'user' | 'model',
        content: m.parts
          .filter(
            (p): p is TextPart => p.kind === 'text' && !!(p as TextPart).text
          )
          .map((p) => ({
            text: (p as TextPart).text,
          })),
      }))
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[MovieAgentExecutor] No valid text messages found in history for task ${taskId}.`
      );
      const failureUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId: taskId,
        contextId: contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'No message found to process.' }],
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
      const response = await movieAgentPrompt(
        { goal: goal, now: new Date().toISOString() },
        {
          messages,
          tools: [searchMovies, searchPeople],
        }
      );

      // 检查请求是否已被取消
      if (this.cancelledTasks.has(taskId)) {
        console.log(
          `[MovieAgentExecutor] Request cancelled for task: ${taskId}`
        );

        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId: taskId,
          contextId: contextId,
          status: {
            state: 'canceled',
            timestamp: new Date().toISOString(),
          },
          final: true, // 取消是最终状态
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      const responseText = response.text; // 使用.text()访问text属性
      console.info(`[MovieAgentExecutor] Prompt response: ${responseText}`);
      const lines = responseText.trim().split('\n');
      const finalStateLine = lines.at(-1)?.trim().toUpperCase();
      const agentReplyText = lines
        .slice(0, lines.length - 1)
        .join('\n')
        .trim();

      let finalA2AState: TaskState = 'unknown';

      if (finalStateLine === 'COMPLETED') {
        finalA2AState = 'completed';
      } else if (finalStateLine === 'AWAITING_USER_INPUT') {
        finalA2AState = 'input-required';
      } else {
        console.warn(
          `[MovieAgentExecutor] Unexpected final state line from prompt: ${finalStateLine}. Defaulting to 'completed'.`
        );
        finalA2AState = 'completed'; // 如果LLM偏离则默认
      }

      // 5. 发布最终任务状态更新
      const agentMessage: Message = {
        kind: 'message',
        role: 'agent',
        messageId: uuidv4(),
        parts: [{ kind: 'text', text: agentReplyText || 'Completed.' }], // 确保有一些文本
        taskId: taskId,
        contextId: contextId,
      };
      historyForGenkit.push(agentMessage);
      contexts.set(contextId, historyForGenkit);

      const finalUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
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
        `[MovieAgentExecutor] Task ${taskId} finished with state: ${finalA2AState}`
      );
    } catch (error: any) {
      console.error(
        `[MovieAgentExecutor] Error processing task ${taskId}:`,
        error
      );
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId: taskId,
        contextId: contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: `Agent error: ${error.message}` }],
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
const movieAgentCard: AgentCard = {
  name: '电影助手',
  description: '一个可以使用TMDB回答关于电影和演员问题的智能助手。',
  // 根据需要调整基础URL和端口。/a2a是A2AExpressApp中的默认基础
  url: 'http://localhost:41241/', // 示例：如果A2AExpressApp中的baseUrl
  provider: {
    organization: 'A2A 示例',
    url: 'https://example.com/a2a-samples', // 添加提供者URL
  },
  version: '0.0.2', // 递增版本
  capabilities: {
    streaming: true, // 新框架支持流式传输
    pushNotifications: false, // 假设此代理尚未实现
    stateTransitionHistory: true, // 代理使用历史记录
  },
  // authentication: null, // Property 'authentication' does not exist on type 'AgentCard'.
  securitySchemes: undefined, // 或者如果有的话定义实际的安全方案
  security: undefined,
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'task-status'], // task-status是常见的输出模式
  skills: [
    {
      id: 'general_movie_chat',
      name: '电影聊天助手',
      description: '回答关于电影、演员、导演的一般问题或进行聊天。',
      tags: ['电影', '演员', '导演'],
      examples: [
        '告诉我《盗梦空间》的剧情。',
        '推荐一部好看的科幻电影。',
        '《黑客帝国》是谁导演的？',
        '斯嘉丽·约翰逊还演过哪些电影？',
        '找一些基努·里维斯主演的动作电影',
        '《侏罗纪公园》和《终结者2》哪个先上映？',
      ],
      inputModes: ['text'], // 为技能明确定义
      outputModes: ['text', 'task-status'], // 为技能明确定义
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  // 1. 创建TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. 创建AgentExecutor
  const agentExecutor: AgentExecutor = new MovieAgentExecutor();

  // 3. 创建DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    movieAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. 创建并设置A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express());

  // 5. 启动服务器
  const PORT = process.env.PORT || 41241;
  expressApp.listen(PORT, () => {
    console.log(
      `[MovieAgent] Server using new framework started on http://localhost:${PORT}`
    );
    console.log(
      `[MovieAgent] Agent Card: http://localhost:${PORT}/.well-known/agent.json`
    );
    console.log('[MovieAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);
