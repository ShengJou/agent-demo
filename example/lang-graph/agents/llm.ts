// import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAI } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

// const llm = new ChatDeepSeek({
//   apiKey: process.env.DEEPSEEK_API_KEY,
//   model: "deepseek-reasoner",
//   streaming: true,
//   temperature: 0.5,
// });

// export default llm;

const llm = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: "deepseek-reasoner",
  streaming: true,
  temperature: 0.5,
  configuration: {
    baseURL: "https://api.deepseek.com",
  },
});

export default llm;
