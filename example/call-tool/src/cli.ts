#!/usr/bin/env node

import readline from 'node:readline';
import { ai } from './genkit';
import { searchMovies, searchPeople } from './tools';
import { GenerateOptions, ToolResponsePart } from 'genkit';

// --- ANSI Colors ---
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// --- Readline Setup ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: colorize('cyan', 'You: '),
});

// --- Main Loop ---
async function main() {
  console.log(colorize('blue', `🤖 DeepSeek Agent`));
  console.log(colorize('dim', `Type /help for help, /exit to quit\n`));

  rl.setPrompt(colorize('cyan', `You: `));
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input.toLowerCase() === '/help') {
      console.log(colorize('blue', '\nCommands:'));
      console.log(colorize('dim', '  /exit - Quit\n'));
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === '/exit') {
      console.log(colorize('yellow', 'Bye!'));
      rl.close();
      return;
    }

    // Process user message with AI
    try {
      const generateOptions: GenerateOptions = {
        system: '你是一个乐于助人的助手，能够查找娱乐行业的电影和人物信息。',
        prompt: input,
        messages: [],
        tools: [searchMovies, searchPeople],
        toolChoice: 'auto',
        returnToolRequests: true, // When true, return tool calls for manual processing instead of automatically resolving them.
        config: {
          temperature: 1.0,
          topP: 1.0,
          truncation: 'disabled',
          presence_penalty: 0.0,
          frequency_penalty: 0.0,
        },
      };

      while (true) {
        const { response, stream } = await ai.generateStream(generateOptions);

        // Process stream for real-time output
        for await (const chunk of stream) {
          if (chunk.text) {
            process.stdout.write(chunk.text);
          }
        }
        console.log('/n');

        const llmResponse = await response;
        const toolRequests = llmResponse.toolRequests;
        if (toolRequests.length < 1) {
          break;
        }
        const toolResponses: ToolResponsePart[] = await Promise.all(
          toolRequests.map(async (part) => {
            switch (part.toolRequest.name) {
              case 'searchMovies':
                return {
                  toolResponse: {
                    name: part.toolRequest.name,
                    ref: part.toolRequest.ref,
                    output: await searchMovies(
                      JSON.parse(part.toolRequest.input as string)
                    ),
                  },
                };
              case 'searchPeople':
                return {
                  toolResponse: {
                    name: part.toolRequest.name,
                    ref: part.toolRequest.ref,
                    output: await searchPeople(
                      JSON.parse(part.toolRequest.input as string)
                    ),
                  },
                };
              default:
                throw Error('Tool not found');
            }
          })
        );
        // 更新历史消息
        generateOptions.messages = llmResponse.messages;
        // 更新提示语
        generateOptions.prompt = toolResponses;
      }
    } catch (error: any) {
      console.error(colorize('red', 'Error:'), error.message);

      if (error.message?.includes('API key')) {
        console.error(colorize('yellow', 'Check .env file'));
      }
    } finally {
      rl.prompt();
    }
  }).on('close', () => {
    console.log(colorize('yellow', 'Bye!'));
    process.exit(0);
  });
}

// --- Start ---
main().catch((err) => {
  console.error(colorize('red', 'Unhandled error in main:'), err);
  process.exit(1);
});
