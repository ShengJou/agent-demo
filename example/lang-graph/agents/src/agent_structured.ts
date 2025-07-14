import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import type { BaseMessage } from "@langchain/core/messages";
import { AgentExecutor } from "langchain/agents";
import type { FunctionsAgentAction } from "langchain/agents/openai/output_parser";

import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { DynamicTool } from "@langchain/core/tools";
import { AgentFinish, AgentStep } from "@langchain/core/agents";
import llm from "../llm";

const searchTool = new DynamicTool({
  name: "web-search-tool",
  description: "用于从网络获取最新信息的工具",
  func: async (searchQuery: string, runManager) => {
    console.log("📝 [TOOL EXECUTION] 开始执行搜索工具，搜索查询:", searchQuery);

    const retriever = new TavilySearchAPIRetriever();
    const docs = await retriever.invoke(searchQuery, runManager?.getChild());
    const result = docs.map((doc) => doc.pageContent).join("\n-----\n");
    console.log(
      "📝 [TOOL EXECUTION] 搜索工具执行完成，返回结果:",
      JSON.stringify(result, null, 2)
    );
    return result;
  },
});

// ChatPromptTemplate 被用来创建包含系统消息、用户输入和代理记录的提示模板
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个有用的助手。你必须始终调用提供的工具之一。"],
  ["user", "{input}"],
  // MessagesPlaceholder 负责在特定位置插入消息数组 。它的核心功能是允许您将消息数组动态插入到提示模板的特定位置。
  // 这里定义了agent_scratchpad的插入位置，MessagesPlaceholder("agent_scratchpad") 用于插入代理的执行历史。
  new MessagesPlaceholder("agent_scratchpad"),
]);

const responseSchema = z.object({
  answer: z.string().describe("返回给用户的最终答案"),
  sources: z
    .array(z.string())
    .describe("包含问题答案的页面块列表。仅当页面块包含相关信息时才将其纳入。"),
});

const responseOpenAIFunction = {
  type: "function",
  function: {
    name: "response",
    description: "将响应返回给用户",
    parameters: zodToJsonSchema(responseSchema),
  },
};

const structuredOutputParser = (
  message: AIMessage
): FunctionsAgentAction | AgentFinish => {
  console.log("🔧 [OUTPUT PARSER] 开始解析LLM输出");
  console.log("📨 [OUTPUT PARSER] 消息内容:", message.content);
  console.log(
    "🛠️ [OUTPUT PARSER] 附加参数:",
    JSON.stringify(message.additional_kwargs, null, 2)
  );

  if (message.content && typeof message.content !== "string") {
    throw new Error("此代理无法解析非字符串模型响应。");
  }
  if (message.additional_kwargs.tool_calls) {
    const { tool_calls } = message.additional_kwargs;
    const toolCall = tool_calls[0];
    const function_call = toolCall.function;

    console.log(
      "🎯 [OUTPUT PARSER] 检测到工具调用，函数名:",
      function_call.name,
      "工具参数:",
      JSON.stringify(function_call.arguments, null, 2)
    );

    try {
      const toolInput = function_call.arguments
        ? JSON.parse(function_call.arguments)
        : {};
      // 如果函数调用名称为 `response`，则我们知道它使用的是我们的最终响应函数，并且可以返回 `AgentFinish` 的实例。
      if (function_call.name === "response") {
        console.log("🏁 [OUTPUT PARSER] 检测到最终响应函数 - 即将结束");
        console.log("📋 [OUTPUT PARSER] 最终返回值:", toolInput);
        return {
          returnValues: { ...toolInput },
          log: message.content as string,
        };
      }
      console.log("⚡ [OUTPUT PARSER] 返回工具调用动作:", function_call.name);

      const functionAgentAction: FunctionsAgentAction = {
        tool: function_call.name,
        toolInput,
        log: `Invoking "${function_call.name}" with ${
          function_call.arguments ?? "{}"
        }\n${message.content}`,
        messageLog: [message],
      };
      console.log(
        "💬 [FunctionsAgentAction] 返回工具调用动作，继续循环执行",
        JSON.stringify(functionAgentAction, null, 2)
      );
      return functionAgentAction;
    } catch (error) {
      throw new Error(
        `无法从聊天模型响应中解析函数参数。文本："${function_call.arguments}"。${error}`
      );
    }
  } else {
    const agentFinish: AgentFinish = {
      returnValues: { output: message.content },
      log: message.content as string,
    };
    console.log(
      "💬 [AgentFinish] 代理已完成任务并准备返回最终结果",
      JSON.stringify(agentFinish, null, 2)
    );
    return agentFinish;
  }
};

const formatAgentSteps = (steps: AgentStep[]): BaseMessage[] => {
  const result = steps.flatMap(({ action, observation }, index) => {
    if ("messageLog" in action && action.messageLog !== undefined) {
      const log = action.messageLog as BaseMessage[];
      // 从 messageLog 中提取工具调用ID
      const lastMessage = log[log.length - 1] as AIMessage;
      const toolCallId =
        lastMessage.additional_kwargs.tool_calls?.[0]?.id || action.tool;

      const toolMessage = new ToolMessage({
        content: observation,
        tool_call_id: toolCallId,
      });

      return log.concat(toolMessage);
    } else {
      return [new AIMessage(action.log)];
    }
  });

  return result;
};

const llmWithTools = llm.bindTools([searchTool, responseOpenAIFunction]);

/**
 * RunnableSequence.from 方法是 LangChain.js 中用于创建可运行序列的静态工厂方法。
 * 该方法接受一个数组作为参数，数组中的每个元素都会被转换为 Runnable 对象，然后按顺序执行，
 * 其中每个步骤的输出会成为下一个步骤的输入。
 * 该方法的核心逻辑是：
 * - 接受一个数组，第一个元素作为 first，最后一个元素作为 last，中间的元素作为 middle
 * - 使用 _coerceToRunnable 函数将每个元素转换为 Runnable 对象
 * - 创建一个新的 RunnableSequence 实例
 *
 */
const runnableAgent = RunnableSequence.from<{
  input: string;
  steps: Array<AgentStep>;
}>([
  {
    input: (i) => {
      console.log("💭 [RUNNABLE] 用户输入:", i.input);
      return i.input;
    },
    // 将steps转换为消息格式填充到agent_scratchpad中
    agent_scratchpad: (i) => {
      const scratchpad = formatAgentSteps(i.steps);
      console.log(
        "🧠 [RUNNABLE] 准备agent_scratchpad",
        JSON.stringify(scratchpad, null, 2)
      );
      return scratchpad;
    },
  },
  prompt,
  RunnableLambda.from((promptValue) => {
    promptValue.toChatMessages().forEach((msg, index) => {
      console.log(
        `  ${index + 1}. [${msg._getType()}]: ${
          typeof msg.content === "string"
            ? msg.content.substring(0, 100) +
              (msg.content.length > 100 ? "..." : "")
            : JSON.stringify(msg.content).substring(0, 100) + "..."
        }`
      );
    });
    return promptValue;
  }),
  llmWithTools,
  RunnableLambda.from((llmOutput) => {
    console.log(
      "📤 [LLM] 模型输出:",
      llmOutput.constructor.name,
      llmOutput.content
    );

    return llmOutput;
  }),
  structuredOutputParser,
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools: [searchTool],
});
/** 在代理上调用invoke */
async function main() {
  console.log("🎬 [MAIN] ========== 开始执行Agent ==========");

  try {
    const res = await executor.invoke({
      input: "北京现在的天气如何？",
    });

    console.log("🎉 [MAIN] ========== 执行完成 ==========");
    console.log("🎯 [MAIN] 最终结果:", res);
  } catch (error) {
    console.error("❌ [MAIN] 执行失败:", error);
    throw error;
  }
}

main();
/*
  {
    res: {
      answer: 'The current weather in Honolulu is 71 \bF with light rain and broken clouds.',
      sources: [
        'Currently: 71 \bF. Light rain. Broken clouds. (Weather station: Honolulu International Airport, USA). See more current weather'
      ]
    }
  }
*/
