#!/usr/bin/env node

import readline from "node:readline";
import { ai } from "./genkit";
import { searchMovies, searchPeople } from "./tools";

// --- ANSI Colors ---
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// --- Readline Setup ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: colorize("cyan", "You: "),
});

// --- State ---
let conversation: Array<any> = [
  {
    role: "system",
    content: [
      {
        type: "text",
        text: "You are a helpful assistant that can search for movies and people in the entertainment industry. Use the available tools when needed to provide accurate and detailed responses.",
      },
    ],
  },
];

// --- Main Loop ---
async function main() {
  console.log(colorize("blue", `🤖 DeepSeek Agent`));
  console.log(colorize("dim", `Type /help for help, /exit to quit\n`));

  rl.setPrompt(colorize("cyan", `You: `));
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input.toLowerCase() === "/help") {
      console.log(colorize("blue", "\nCommands:"));
      console.log(colorize("dim", "  /clear - Clear history"));
      console.log(colorize("dim", "  /history - Show recent messages"));
      console.log(colorize("dim", "  /exit - Quit\n"));
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "/clear") {
      conversation = [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: "You are a helpful assistant that can search for movies and people in the entertainment industry. Use the available tools when needed to provide accurate and detailed responses.",
            },
          ],
        },
      ];
      console.log(colorize("yellow", "Cleared\n"));
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "/history") {
      const userMessages = conversation.filter(
        (msg) => msg.role === "user"
      ).length;
      const modelMessages = conversation.filter(
        (msg) => msg.role === "model"
      ).length;

      // Get recent messages (excluding system message)
      const recentMessages = conversation
        .filter((msg) => msg.role !== "system")
        .slice(-3); // Last 3 messages

      console.log(
        colorize("blue", `\nTotal: ${userMessages}/${modelMessages}`)
      );

      if (recentMessages.length > 0) {
        console.log(colorize("dim", "Recent:"));
        recentMessages.forEach((msg, index) => {
          const text = msg.content[0]?.text || "";
          const truncated =
            text.length > 60 ? text.substring(0, 60) + "..." : text;
          const prefix = msg.role === "user" ? ">" : "<";
          console.log(colorize("dim", `  ${prefix} ${truncated}`));
        });
      }

      console.log();
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "/exit") {
      console.log(colorize("yellow", "Bye!"));
      rl.close();
      return;
    }

    // Process user message with AI
    try {
      // Add user message to conversation
      conversation.push({
        role: "user",
        content: [{ type: "text", text: input }],
      });

      const { response, stream } = await ai.generateStream({
        messages: conversation,
        tools: [searchMovies, searchPeople],
      });

      // Print assistant label
      process.stdout.write(colorize("green", "Assistant: "));

      // Process stream for real-time output
      for await (const chunk of stream) {
        if (chunk.text) {
          process.stdout.write(chunk.text);
        }

        // Log tool calls - check for content with toolRequest
        if (chunk.content) {
          chunk.content.forEach((content: any) => {
            if (content.toolRequest) {
              console.log(
                colorize(
                  "yellow",
                  `\n🔧 Calling tool: ${content.toolRequest.name}`
                )
              );
              console.log(
                colorize(
                  "dim",
                  `   Arguments: ${JSON.stringify(content.toolRequest.input)}`
                )
              );
            }
          });
        }

        // Also check for legacy tool call format
        if (
          "type" in chunk &&
          chunk.type === "tool-call" &&
          "toolName" in chunk
        ) {
          console.log(
            colorize("yellow", `\n🔧 Calling tool: ${(chunk as any).toolName}`)
          );
        }

        // Log tool results
        if (
          "type" in chunk &&
          chunk.type === "tool-result" &&
          "toolName" in chunk
        ) {
          console.log(
            colorize("green", `✅ Tool ${(chunk as any).toolName} completed`)
          );
        }
      }

      // Wait for complete response and add to conversation history
      const finalResponse = await response;
      if (finalResponse.text?.trim()) {
        conversation.push({
          role: "model",
          content: [{ type: "text", text: finalResponse.text }],
        });
      }

      console.log("\n");
    } catch (error: any) {
      console.error(colorize("red", "Error:"), error.message);

      if (error.message?.includes("API key")) {
        console.error(colorize("yellow", "Check .env file"));
      }
      console.log();
    } finally {
      rl.prompt();
    }
  }).on("close", () => {
    console.log(colorize("yellow", "Bye!"));
    process.exit(0);
  });
}

// --- Start ---
main().catch((err) => {
  console.error(colorize("red", "Unhandled error in main:"), err);
  process.exit(1);
});
