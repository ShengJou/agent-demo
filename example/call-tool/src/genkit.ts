import { deepseek, deepseekReasoner } from "../../../src/index";
import { genkit, MessageData } from "genkit";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

// configure a Genkit instance
export const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner,
  // Directory where dotprompts are stored.
  promptDir: path.join(__dirname, "../prompts"),
});

export { z } from "genkit";
