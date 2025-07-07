# genkitx-deepseek 流式响应示例

此示例演示如何使用 `genkitx-deepseek` 插件与 Firebase Genkit 进行流式 AI 文本生成。

## 概述

此项目展示了 genkitx-deepseek 插件的流式实现：

- 集成 DeepSeek AI 模型与 Firebase Genkit
- 执行流式文本生成，实时输出内容
- 使用环境变量进行安全的 API 密钥管理
- 演示实时聊天功能和流式响应处理

## 流式响应的优势

- **实时反馈**：用户可以立即看到 AI 开始生成内容
- **更好的用户体验**：减少用户等待时间，提供即时反馈
- **逐步输出**：内容逐字逐句地显示，就像真人打字一样
- **可中断性**：可以在生成过程中停止或修改
- **内存效率**：不需要等待完整内容生成，降低内存使用

## 前置要求

- Node.js 16+
- npm、yarn 或 pnpm
- DeepSeek API 密钥 ([在此获取](https://platform.deepseek.com/api_keys))

## 安装

1. 导航到示例目录：

   ```bash
   cd example/streaming
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

运行流式响应示例：

```bash
npm start
```

这将执行示例代码，使用 DeepSeek 聊天模型生成内容并实时显示。

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
  // 发起流式生成请求
  const { response, stream } = await ai.generateStream(
    "请用不少于100字描述人工智能的发展历程"
  );

  // 实时处理流式响应
  for await (const chunk of stream) {
    process.stdout.write(chunk.text); // 实时输出
  }

  // 可选：获取完整响应
  console.log("\n--- 完整响应 ---");
  console.log((await response).text);
})();
```

### 可用模型

此示例使用以下 DeepSeek 模型：

- **deepseekChat**：主要聊天模型，适用于对话场景
- **deepseekReasoner**：推理模型，适用于分析和推理任务

### 自定义示例

您可以修改 `src/index.ts` 中的生成请求：

```typescript
// 修改提示词
const { response, stream } = await ai.generateStream("您的自定义提示词");

// 或使用推理模型
const ai = genkit({
  plugins: [deepseek({ apiKey: process.env.DEEPSEEK_API_KEY })],
  model: deepseekReasoner, // 使用推理模型
});
```

### 流式响应处理技巧

```typescript
// 1. 基础流式处理
for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}

// 2. 添加进度指示
let totalChars = 0;
for await (const chunk of stream) {
  totalChars += chunk.text.length;
  process.stdout.write(chunk.text);
  // 可以在这里添加进度条或其他 UI 更新
}

// 3. 错误处理
try {
  for await (const chunk of stream) {
    process.stdout.write(chunk.text);
  }
} catch (error) {
  console.error("流式生成错误:", error);
}
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
  const { response, stream } = await ai.generateStream("您的提示词");
  for await (const chunk of stream) {
    process.stdout.write(chunk.text);
  }
} catch (error) {
  console.error("生成失败:", error);
}
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
4. **流式输出不正常**：确保使用 `process.stdout.write()` 而不是 `console.log()`

### 获取帮助

- 查看 [主插件文档](../../README.md)
- 访问 [DeepSeek API 文档](https://platform.deepseek.com/api-docs)
- 查阅 [Firebase Genkit 文档](https://genkit.dev/)

## 许可证

此示例是 genkitx-deepseek 项目的一部分，采用 [Apache 2.0 许可证](../../LICENSE)。
