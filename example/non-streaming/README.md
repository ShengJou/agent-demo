# genkitx-deepseek 非流式响应示例

此示例演示如何使用 `genkitx-deepseek` 插件与 Firebase Genkit 进行非流式 AI 文本生成。

## 概述

此项目展示了 genkitx-deepseek 插件的非流式实现：

- 集成 DeepSeek AI 模型与 Firebase Genkit
- 执行非流式文本生成，一次性返回完整结果
- 使用环境变量进行安全的 API 密钥管理
- 演示基础聊天功能和批量处理

## 非流式响应的特点

- **简单易用**：一次调用，完整返回，无需处理复杂的流式数据
- **完整性保证**：确保获得完整的生成内容，不会出现中断
- **适合批处理**：适用于不需要实时反馈的场景
- **内存友好**：不需要处理流式数据，内存使用相对稳定
- **错误处理简单**：只需要处理一次请求的成功或失败

## 适用场景

- **批量内容生成**：生成大量文章、摘要等
- **自动化脚本**：定时任务、数据处理等
- **简单问答系统**：FAQ、客服机器人等
- **文本分析**：情感分析、关键词提取等
- **不需要实时反馈的应用**

## 前置要求

- Node.js 16+
- npm、yarn 或 pnpm
- DeepSeek API 密钥 ([在此获取](https://platform.deepseek.com/api_keys))

## 安装

1. 导航到示例目录：

   ```bash
   cd example/non-streaming
   ```

2. 安装依赖：

   ```bash
   npm install
   ```

3. 在项目根目录创建 `.env` 文件并添加您的 DeepSeek API 密钥：

   ```env
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   ```

## 使用方法

### 运行示例

运行非流式响应示例：

```bash
npm start
```

这将执行示例代码，使用 DeepSeek 聊天模型生成笑话并一次性输出完整结果。

### 代码结构

主要应用代码位于 `src/index.ts`：

```typescript
import { deepseek, deepseekChat } from "genkitx-deepseek";
import { genkit } from "genkit";
import * as dotenv from "dotenv";

dotenv.config();

// 配置 Genkit 实例
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekChat,
});

(async () => {
  // 发起非流式生成请求
  const { text } = await ai.generate("请给我讲一个有趣的科技笑话！");

  // 输出完整的生成结果
  console.log("AI 生成的内容：");
  console.log(text);
})();
```

### 可用模型

此示例使用以下 DeepSeek 模型：

- **deepseekChat**：主要聊天模型，适用于对话和内容生成
- **deepseekReasoner**：推理模型，适用于分析、推理和复杂问题解决

### 自定义示例

您可以修改 `src/index.ts` 中的生成请求：

```typescript
// 修改提示词
const { text } = await ai.generate("您的自定义提示词");

// 使用推理模型进行复杂分析
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner, // 使用推理模型
});

// 批量生成示例
const prompts = [
  "解释什么是人工智能",
  "描述机器学习的应用",
  "分析深度学习的发展趋势",
];

for (const prompt of prompts) {
  const { text } = await ai.generate(prompt);
  console.log(`提示词: ${prompt}`);
  console.log(`回答: ${text}\n`);
}
```

### 高级配置选项

```typescript
// 使用配置参数控制生成
const { text } = await ai.generate({
  prompt: "您的提示词",
  config: {
    temperature: 0.7, // 控制创造性
    maxOutputTokens: 500, // 限制输出长度
    topP: 0.9, // 核采样参数
    frequencyPenalty: 0.1, // 频率惩罚
    presencePenalty: 0.1, // 存在惩罚
  },
});
```

## 脚本

- `npm start`：运行示例应用
- `npm run build`：编译 TypeScript 到 JavaScript
- `npm test`：运行测试（当前未指定测试）

## 配置

### 环境变量

| 变量名             | 描述                        | 必需 |
| ------------------ | --------------------------- | ---- |
| `DEEPSEEK_API_KEY` | 您的 DeepSeek API 密钥      | 是   |
| `DEEPSEEK_API_URL` | 自定义 API 基础 URL（可选） | 否   |

### 插件选项

DeepSeek 插件接受以下选项：

```typescript
deepseek({
  apiKey: "your_api_key", // API 密钥（也可以使用环境变量）
  baseURL: "custom_base_url", // 自定义基础 URL（可选）
});
```

## 错误处理

确保在您的实现中处理潜在错误：

```typescript
try {
  const { text } = await ai.generate("您的提示词");
  console.log("生成成功:", text);
} catch (error) {
  console.error("生成失败:", error);

  // 根据错误类型进行不同处理
  if (error.message.includes("API key")) {
    console.error("请检查 API 密钥配置");
  } else if (error.message.includes("network")) {
    console.error("请检查网络连接");
  }
}
```

### 批量处理错误处理

```typescript
const prompts = ["提示词1", "提示词2", "提示词3"];
const results = [];

for (const prompt of prompts) {
  try {
    const { text } = await ai.generate(prompt);
    results.push({ prompt, text, success: true });
  } catch (error) {
    results.push({ prompt, error: error.message, success: false });
  }
}

console.log("批量处理结果:", results);
```

## 依赖

- **genkit**：Firebase Genkit 框架
- **genkitx-deepseek**：用于 Genkit 的 DeepSeek 插件
- **dotenv**：环境变量管理
- **tsx**：Node.js 的 TypeScript 执行

## 故障排除

### 常见问题

1. **API 密钥缺失**：确保在 `.env` 文件中设置了 `DEEPSEEK_API_KEY`
2. **网络问题**：检查您的网络连接和 DeepSeek API 状态
3. **TypeScript 错误**：运行 `npm run build` 检查编译错误
4. **内容生成不理想**：尝试调整 temperature 和其他配置参数
5. **超时问题**：对于长文本生成，可能需要增加超时设置

### 性能优化建议

1. **批量处理**：对于多个请求，考虑使用并发控制
2. **缓存结果**：对于重复的提示词，可以缓存结果
3. **参数调优**：根据需求调整 temperature、maxOutputTokens 等参数

### 获取帮助

- 查看 [主插件文档](../../README.md)
- 访问 [DeepSeek API 文档](https://platform.deepseek.com/api-docs)
- 查阅 [Firebase Genkit 文档](https://genkit.dev/)

## 许可证

此示例是 genkitx-deepseek 项目的一部分，采用 [Apache 2.0 许可证](../../LICENSE)。
