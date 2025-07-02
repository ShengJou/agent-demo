import { deepseek, deepseekChat } from "genkitx-deepseek";
import { genkit } from "genkit";
import * as dotenv from "dotenv";

dotenv.config();

// configure a Genkit instance
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekChat,
});

(async () => {
  // make a generation request
  const { response, stream } = await ai.generateStream(
    "Please describe Trump in no less than 100 words"
  );
  for await (const chunk of stream) {
    console.log(chunk.text);
  }
  console.log((await response).text);
})();
