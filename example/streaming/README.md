# genkitx-deepseek Non-Streaming Example

This example demonstrates how to use the `genkitx-deepseek` plugin with Firebase Genkit for non-streaming AI text generation using DeepSeek models.

## Overview

This project showcases a simple implementation of the genkitx-deepseek plugin that:

- Integrates DeepSeek AI models with Firebase Genkit
- Performs non-streaming text generation
- Uses environment variables for secure API key management
- Demonstrates basic chat functionality

## Prerequisites

- Node.js 16+
- npm, yarn, or pnpm
- A DeepSeek API key ([Get one here](https://platform.deepseek.com/api_keys))

## Installation

1. Navigate to the example directory:

   ```bash
   cd example/non-streaming
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and add your DeepSeek API key:

   ```env
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   ```

## Usage

### Running the Example

To run the basic example:

```bash
npm start
```

This will execute the sample code that generates a joke using the DeepSeek chat model.

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

| Variable           | Description                    | Required |
| ------------------ | ------------------------------ | -------- |
| `DEEPSEEK_API_KEY` | Your DeepSeek API key          | Yes      |
| `DEEPSEEK_API_URL` | Custom API base URL (optional) | No       |

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
2. **Network Issues**: Check your internet connection and DeepSeek API status
3. **TypeScript Errors**: Run `npm run build` to check for compilation errors

### Getting Help

- Check the [main plugin documentation](../../README.md)
- Visit the [DeepSeek API documentation](https://platform.deepseek.com/api-docs)
- Review the [Firebase Genkit documentation](https://genkit.dev/)

## License

This example is part of the genkitx-deepseek project and is licensed under the [Apache 2.0 License](../../LICENSE).
