import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getWeather = tool(
  async ({ query }) => {
    console.log("正在调用获取天气工具", query);
    if (query.toLowerCase().includes("旧金山")) {
      return "当前温度 15°C，有雾。";
    }
    return "当前温度 32°C，晴朗。";
  },
  {
    name: "getWeather",
    description: "获取天气信息的工具。",
    schema: z.object({
      query: z.string().describe("查询关键词，如：北京"),
    }),
  }
);
