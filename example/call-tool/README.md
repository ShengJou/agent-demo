# genkitx-deepseek Tool Calling Example

This example demonstrates how to use the `genkitx-deepseek` plugin with Firebase Genkit for AI tool calling using DeepSeek models.

## Overview

This project showcases tool calling implementation with the genkitx-deepseek plugin that:

- Integrates DeepSeek AI models with Firebase Genkit for tool calling
- Demonstrates how to define and use custom tools
- Includes movie/people search tools using TMDB API
- Provides an interactive CLI for testing tool calls
- Uses the DeepSeek Reasoner model which supports function calling

## Prerequisites

- Node.js 16+
- npm, yarn, or pnpm
- A DeepSeek API key ([Get one here](https://platform.deepseek.com/api_keys))
- A TMDB API key for movie search tools ([Get one here](https://www.themoviedb.org/settings/api))

## Installation

1. Navigate to the example directory:

   ```bash
   cd example/call-tool
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and add your API keys:

   ```env
   # DeepSeek API Configuration
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   DEEPSEEK_API_URL=https://api.deepseek.com

   # TMDB API Configuration (for movie search tools)
   TMDB_API_KEY=your_tmdb_api_key_here
   ```

## Usage

### Testing Tool Calling (Recommended First Step)

To test tool calling functionality with simple built-in tools:

```bash
npm test
```

This will run automated tests using calculator and greeter tools to verify that tool calling works correctly.

### Running the Interactive CLI

To start the interactive CLI with movie/people search tools:

```bash
npm run cli
```

This will start an interactive session where you can ask questions and the AI will use tools when appropriate.

### Running the Basic Example

To run the basic TMDB example:

```bash
npm start
```

This will execute a pre-defined example that searches for movie information using tools.

### Code Structure

The main application code is located in `src/index.ts`:

```typescript
import { deepseek, deepseekChat } from "genkitx-deepseek";
import { genkit } from "genkit";
import * as dotenv from "dotenv";

dotenv.config();

// Configure a Genkit instance
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekChat,
});

(async () => {
  // Make a generation request
  const { text } = await ai.generate("Tell me a joke!");
  console.log(text);
})();
```

### Available Models

This example uses the following DeepSeek models:

- **deepseekChat**: Primary chat model for conversations
- **deepseekReasoner**: Reasoning model for analytical responses

### Customizing the Example

You can modify the generation request in `src/index.ts`:

```typescript
// Change the prompt
const { text } = await ai.generate("Your custom prompt here");

// Or use the reasoning model
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner, // Use reasoning model instead
});
```

## Scripts

- `npm start`: Run the example application
- `npm run build`: Compile TypeScript to JavaScript
- `npm test`: Run tests (currently no tests specified)

## Configuration

### Environment Variables

| Variable           | Description                       | Required | Default                  |
| ------------------ | --------------------------------- | -------- | ------------------------ |
| `DEEPSEEK_API_KEY` | Your DeepSeek API key             | Yes      | -                        |
| `DEEPSEEK_API_URL` | Custom API base URL (optional)    | No       | https://api.deepseek.com |
| `TMDB_API_KEY`     | Your TMDB API key for movie tools | No\*     | -                        |

\*Required only for movie/people search functionality. Not needed for basic tool testing.

### Plugin Options

The DeepSeek plugin accepts the following options:

```typescript
deepseek({
  apiKey: "your_api_key", // API key (can also use env var)
  baseURL: "custom_base_url", // Custom base URL (optional)
});
```

## Error Handling

Make sure to handle potential errors in your implementation:

```typescript
try {
  const { text } = await ai.generate("Tell me a joke!");
  console.log(text);
} catch (error) {
  console.error("Generation failed:", error);
}
```

## Dependencies

- **genkit**: Firebase Genkit framework
- **genkitx-deepseek**: DeepSeek plugin for Genkit
- **dotenv**: Environment variable management
- **tsx**: TypeScript execution for Node.js

## Troubleshooting

### Common Issues

1. **API Key Missing**: Ensure `DEEPSEEK_API_KEY` is set in your `.env` file
2. **Tools Not Being Called**:
   - Make sure you're using the `deepseekReasoner` model (not `deepseekChat`)
   - Check that tools are properly passed to the `generateStream` call
   - Verify that your prompts clearly indicate when tools should be used
3. **TMDB API Errors**: Ensure `TMDB_API_KEY` is set correctly in your `.env` file
4. **Network Issues**: Check your internet connection and DeepSeek API status
5. **TypeScript Errors**: Run `npm run build` to check for compilation errors

### Debugging Tool Calls

If tools aren't being called as expected:

1. **Run the test suite first**: `npm test` to verify basic tool calling works
2. **Check console output**: Look for tool call logs in yellow and green colors
3. **Verify model usage**: Only `deepseekReasoner` supports tools, not `deepseekChat`
4. **Review your prompts**: Make them more explicit about when to use tools

### Example Prompts That Should Trigger Tool Calls

- "Search for the movie Titanic" (should call searchMovies)
- "Find information about Tom Hanks" (should call searchPeople)
- "Calculate 15 + 27" (in test mode, should call calculator)

### Getting Help

- Check the [main plugin documentation](../../README.md)
- Visit the [DeepSeek API documentation](https://platform.deepseek.com/api-docs)
- Review the [Firebase Genkit documentation](https://genkit.dev/)

## License

This example is part of the genkitx-deepseek project and is licensed under the [Apache 2.0 License](../../LICENSE).
