import { ai, z } from "./genkit";

// Define a simple calculator tool for testing
const calculator = ai.defineTool(
  {
    name: "calculator",
    description: "Perform basic arithmetic operations",
    inputSchema: z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      a: z.number(),
      b: z.number(),
    }),
  },
  async ({ operation, a, b }) => {
    console.log(`[calculator] ${operation}: ${a} and ${b}`);

    switch (operation) {
      case "add":
        return { result: a + b };
      case "subtract":
        return { result: a - b };
      case "multiply":
        return { result: a * b };
      case "divide":
        if (b === 0) {
          throw new Error("Division by zero is not allowed");
        }
        return { result: a / b };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
);

// Define a simple greeting tool
const greeter = ai.defineTool(
  {
    name: "greeter",
    description: "Generate a personalized greeting message",
    inputSchema: z.object({
      name: z.string(),
      timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
    }),
  },
  async ({ name, timeOfDay = "morning" }) => {
    console.log(`[greeter] Greeting ${name} for ${timeOfDay}`);

    const greetings = {
      morning: `Good morning, ${name}! Have a wonderful day ahead!`,
      afternoon: `Good afternoon, ${name}! Hope your day is going well!`,
      evening: `Good evening, ${name}! Time to relax and unwind!`,
    };

    return { message: greetings[timeOfDay] };
  }
);

(async () => {
  console.log("🧪 Testing tool calling functionality...\n");

  try {
    // Test 1: Calculator tool
    console.log("Test 1: Calculator tool");
    const { response: calcResponse, stream: calcStream } =
      await ai.generateStream({
        tools: [calculator],
        prompt: "Please calculate 15 + 27 using the calculator tool.",
        system:
          "You are a helpful assistant. When asked to perform calculations, you MUST use the calculator tool. Always call the tool when appropriate.",
      });

    console.log("Assistant: ");
    for await (const chunk of calcStream) {
      if (chunk.text) {
        process.stdout.write(chunk.text);
      }
    }
    console.log("\n");

    // Test 2: Greeter tool
    console.log("Test 2: Greeter tool");
    const { response: greetResponse, stream: greetStream } =
      await ai.generateStream({
        tools: [greeter],
        prompt: "Please use the greeter tool to say good morning to Alice.",
        system:
          "You are a helpful assistant. When asked to greet someone, you MUST use the greeter tool. Always call the tool when appropriate.",
      });

    console.log("Assistant: ");
    for await (const chunk of greetStream) {
      if (chunk.text) {
        process.stdout.write(chunk.text);
      }
    }
    console.log("\n");

    // Test 3: Combined tools
    console.log("Test 3: Multiple tools available");
    const { response: multiResponse, stream: multiStream } =
      await ai.generateStream({
        tools: [calculator, greeter],
        prompt:
          "First greet Bob for the evening, then calculate 100 divided by 4.",
        system:
          "You are a helpful assistant. Use the appropriate tools when needed. Always call tools when asked to perform their functions.",
      });

    console.log("Assistant: ");
    for await (const chunk of multiStream) {
      if (chunk.text) {
        process.stdout.write(chunk.text);
      }
    }
    console.log("\n");

    console.log("✅ Tool calling tests completed!");
  } catch (error: any) {
    console.error("❌ Error during testing:", error.message);

    if (error.message?.includes("API key")) {
      console.error(
        "Please make sure DEEPSEEK_API_KEY is set in your .env file"
      );
    }
  }
})();
