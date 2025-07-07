![Firebase Genkit + DeepSeek](https://github.com/oddbit/genkitx-deepseek/raw/main/assets/genkit-deepseek.png)

# Firebase Genkit DeepSeek 插件

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202%2E0-lightgrey.svg)](https://github.com/oddbit/genkitx-deepseek/blob/main/LICENSE)
![NPM version](https://img.shields.io/npm/v/genkitx-deepseek.svg)
![NPM Weekly Downloads](https://img.shields.io/npm/dw/genkitx-deepseek)

**genkitx-deepseek** 是一个社区插件，用于在 [Firebase Genkit](https://github.com/firebase/genkit) 中使用 DeepSeek API。该插件通过 Genkit 插件系统为 DeepSeek 的聊天和推理模型提供了简单易用的接口。

> **注意：** 此插件基于 [The Fire Company](https://github.com/TheFireCo/genkit-plugins) 的 OpenAI 插件代码，并在 [Apache 2.0 许可证](https://github.com/oddbit/genkitx-deepseek/blob/main/LICENSE) 下分发。

## 功能特性

- 🚀 **简单易用** - 与 Firebase Genkit 无缝集成
- 🤖 **多模型支持** - 支持 DeepSeek Chat 和 DeepSeek Reasoner 模型
- ⚡ **流式响应** - 支持实时流式文本生成
- 🛠️ **工具调用** - 支持函数调用和工具集成
- 📝 **TypeScript** - 完整的 TypeScript 类型支持
- 🔧 **灵活配置** - 支持自定义配置和参数调整

## 支持的模型

| 模型名称              | 描述                         | 适用场景                         |
| --------------------- | ---------------------------- | -------------------------------- |
| **DeepSeek Chat**     | 主要聊天模型，适用于对话场景 | 日常对话、内容生成、问答系统     |
| **DeepSeek Reasoner** | 推理模型，具有更强的分析能力 | 逻辑推理、复杂问题解决、工具调用 |

## 安装

使用您喜欢的包管理器在项目中安装插件：

```bash
# 使用 npm
npm install genkitx-deepseek

# 使用 yarn
yarn add genkitx-deepseek

# 使用 pnpm
pnpm add genkitx-deepseek
```

## 快速开始

### 1. 获取 API 密钥

首先，您需要从 [DeepSeek 平台](https://platform.deepseek.com/api_keys) 获取 API 密钥。

### 2. 设置环境变量

在项目根目录创建 `.env` 文件：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 3. 初始化插件

```typescript
import { genkit } from "genkit";
import { deepseek, deepseekChat, deepseekReasoner } from "genkitx-deepseek";

const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekChat, // 或者使用 deepseekReasoner
});
```

## 使用示例

### 基础文本生成

```typescript
// 简单的文本生成
const response = await ai.generate({
  model: deepseekChat,
  prompt: "请给我讲一个有趣的科技笑话",
});

console.log(response.text);
```

### 流式响应

```typescript
// 流式文本生成，实时输出
const { response, stream } = await ai.generateStream({
  model: deepseekChat,
  prompt: "请用300字描述人工智能的发展历程",
});

// 实时处理流式响应
for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}

// 获取完整响应
const fullResponse = await response;
console.log("\n完整响应:", fullResponse.text);
```

### 使用推理模型

```typescript
// 使用推理模型进行复杂分析
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner,
});

const response = await ai.generate({
  prompt: "分析一下区块链技术在金融领域的应用前景",
  config: {
    temperature: 0.7,
    maxOutputTokens: 1000,
  },
});
```

### 工具调用

```typescript
// 定义工具
const calculatorTool = ai.defineTool(
  {
    name: "calculator",
    description: "执行基础数学计算",
    inputSchema: z.object({
      operation: z.string(),
      a: z.number(),
      b: z.number(),
    }),
  },
  async ({ operation, a, b }) => {
    switch (operation) {
      case "add":
        return a + b;
      case "subtract":
        return a - b;
      case "multiply":
        return a * b;
      case "divide":
        return a / b;
      default:
        throw new Error("不支持的操作");
    }
  }
);

// 使用工具
const response = await ai.generate({
  model: deepseekReasoner, // 推理模型更适合工具调用
  prompt: "请计算 15 + 27 的结果",
  tools: [calculatorTool],
  config: {
    toolChoice: "auto",
  },
});
```

## 配置选项

### 插件配置

```typescript
deepseek({
  apiKey: "your-api-key", // API 密钥
  baseURL: "https://api.deepseek.com", // 自定义 API 基础 URL（可选）
});
```

### 生成配置

```typescript
const response = await ai.generate({
  model: deepseekChat,
  prompt: "您的提示词",
  config: {
    temperature: 0.7, // 创造性控制 (0-2)
    maxOutputTokens: 1000, // 最大输出长度
    topP: 0.9, // 核采样参数
    frequencyPenalty: 0.1, // 频率惩罚 (-2 到 2)
    presencePenalty: 0.1, // 存在惩罚 (-2 到 2)
    stopSequences: ["停止"], // 停止序列
  },
});
```

## 示例项目

我们提供了多个示例项目来帮助您快速上手：

### 1. 基础示例

- **[非流式响应](./example/non-streaming/)** - 基础文本生成示例
- **[流式响应](./example/streaming/)** - 实时流式生成示例

### 2. 高级示例

- **[工具调用](./example/call-tool/)** - 包含 TMDB 电影搜索工具的交互式 CLI

### 运行示例

```bash
# 进入示例目录
cd example/streaming

# 安装依赖
npm install

# 设置环境变量（创建 .env 文件）
echo "DEEPSEEK_API_KEY=your_api_key_here" > .env

# 运行示例
npm start
```

## 最佳实践

### 1. 模型选择

- **DeepSeek Chat**: 适用于一般对话、内容创作、简单问答
- **DeepSeek Reasoner**: 适用于复杂推理、工具调用、分析任务

### 2. 参数调优

```typescript
// 创意写作 - 高创造性
const creativeConfig = {
  temperature: 1.0,
  topP: 0.9,
  frequencyPenalty: 0.5,
};

// 事实性回答 - 低创造性
const factualConfig = {
  temperature: 0.2,
  topP: 0.5,
  presencePenalty: 0.0,
};
```

### 3. 错误处理

```typescript
try {
  const response = await ai.generate({
    model: deepseekChat,
    prompt: "您的提示词",
  });
  console.log(response.text);
} catch (error) {
  if (error.message.includes("API key")) {
    console.error("API 密钥错误，请检查配置");
  } else if (error.message.includes("rate limit")) {
    console.error("请求频率超限，请稍后重试");
  } else {
    console.error("生成失败:", error.message);
  }
}
```

## 环境变量

| 变量名             | 描述                | 必需 | 默认值                     |
| ------------------ | ------------------- | ---- | -------------------------- |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥   | 是   | -                          |
| `DEEPSEEK_API_URL` | 自定义 API 基础 URL | 否   | `https://api.deepseek.com` |

## 故障排除

### 常见问题

1. **API 密钥错误**

   ```bash
   Error: 需要 DeepSeek API 密钥
   ```

   解决方案：确保设置了正确的 `DEEPSEEK_API_KEY` 环境变量

2. **网络连接问题**

   ```bash
   Error: 网络请求失败
   ```

   解决方案：检查网络连接和 DeepSeek API 服务状态

3. **工具调用不工作**
   - 确保使用 `deepseekReasoner` 模型
   - 检查工具定义的格式是否正确
   - 确保设置了 `toolChoice: "auto"`

### 获取帮助

- 查看 [示例项目](./example/)
- 阅读 [DeepSeek API 文档](https://platform.deepseek.com/api-docs)
- 参考 [Firebase Genkit 文档](https://firebase.google.com/docs/genkit)
- 提交 [Issue](https://github.com/oddbit/genkitx-deepseek/issues)

## 贡献

欢迎贡献代码！请查看我们的 [贡献指南](CONTRIBUTING.md) 了解详细信息。

## 许可证

本项目采用 [Apache 2.0 许可证](https://github.com/oddbit/genkitx-deepseek/blob/main/LICENSE)。

## 致谢

- 感谢 [Firebase Genkit](https://github.com/firebase/genkit) 团队提供的优秀框架
- 感谢 [The Fire Company](https://github.com/TheFireCo/genkit-plugins) 提供的 OpenAI 插件代码基础
- 感谢 [DeepSeek](https://platform.deepseek.com/) 提供的强大 AI 模型

---

如果这个项目对您有帮助，请给我们一个 ⭐️！
