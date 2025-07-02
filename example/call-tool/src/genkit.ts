import { deepseek, deepseekReasoner } from "../../../src/index";
import { genkit, MessageData } from "genkit";
import * as dotenv from "dotenv";

dotenv.config();

// configure a Genkit instance
export const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner,
});

export { z } from "genkit";
