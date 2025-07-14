// 演示颜色日志系统
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const colorLog = (color: keyof typeof colors, tag: string, message: string) => {
  console.log(`${colors[color]}${tag}${colors.reset} ${message}`);
};

// 不同模块的颜色日志
const toolLog = (msg: string) => colorLog("green", "🔍 [TOOL]", msg);
const parserLog = (msg: string) => colorLog("blue", "🔧 [PARSER]", msg);
const formatLog = (msg: string) => colorLog("cyan", "📝 [FORMAT]", msg);
const runnableLog = (msg: string) => colorLog("yellow", "🚀 [RUNNABLE]", msg);
const promptLog = (msg: string) => colorLog("magenta", "📋 [PROMPT]", msg);
const llmLog = (msg: string) => colorLog("red", "🤖 [LLM]", msg);
const mainLog = (msg: string) => colorLog("bright", "🎬 [MAIN]", msg);
const startupLog = (msg: string) => colorLog("gray", "🌟 [STARTUP]", msg);

// 演示所有颜色
function demonstrateColors() {
  console.log("\n🎨 颜色日志系统演示:");
  console.log("=".repeat(50));

  startupLog("应用启动");
  mainLog("开始处理请求");
  runnableLog("输入: 北京天气 (步骤数: 0)");
  promptLog("生成提示 (2 条消息)");
  llmLog("🛠️ 工具调用: web-search-tool");
  parserLog("检测到工具调用: web-search-tool");
  toolLog("搜索查询: 北京天气");
  toolLog("搜索完成，结果长度: 1234");
  formatLog("格式化 1 个步骤");
  formatLog("步骤 1: web-search-tool → 1234 字符");
  runnableLog("Scratchpad: 2 条消息");
  promptLog("生成提示 (4 条消息)");
  llmLog("🛠️ 工具调用: response");
  parserLog("🏁 最终响应 - 循环结束");
  mainLog("执行完成 (2500ms)");
  mainLog("答案: 北京今天天气晴朗，温度15-25°C，适合外出...");
  mainLog("信息源: 3 个");

  console.log("=".repeat(50));
  console.log("🎯 不同模块使用不同颜色，便于快速识别执行流程");
}

// 颜色说明
function explainColors() {
  console.log("\n🔍 各模块颜色说明:");
  console.log("=".repeat(40));

  startupLog("启动阶段 - 灰色");
  mainLog("主程序 - 亮白色");
  runnableLog("可运行序列 - 黄色");
  promptLog("提示生成 - 紫色");
  llmLog("LLM推理 - 红色");
  parserLog("输出解析 - 蓝色");
  formatLog("格式化 - 青色");
  toolLog("工具执行 - 绿色");

  console.log("=".repeat(40));
  console.log("💡 通过颜色可以快速定位不同环节的执行情况");
}

// 循环执行流程演示
function demonstrateLoopFlow() {
  console.log("\n🔄 循环执行流程演示:");
  console.log("=".repeat(50));

  startupLog("启动LangChain结构化代理");
  startupLog("可用工具: web-search-tool, response");

  console.log("\n第1轮迭代:");
  mainLog("开始执行Agent");
  runnableLog("输入: 北京现在的天气如何？ (步骤数: 0)");
  promptLog("生成提示 (2 条消息)");
  llmLog("🛠️ 工具调用: web-search-tool");
  parserLog("检测到工具调用: web-search-tool");
  parserLog("⚡ 继续工具调用: web-search-tool");
  toolLog("搜索查询: 北京天气");
  toolLog("搜索完成，结果长度: 1234");

  console.log("\n第2轮迭代:");
  formatLog("格式化 1 个步骤");
  formatLog("步骤 1: web-search-tool → 1234 字符");
  runnableLog("输入: 北京现在的天气如何？ (步骤数: 1)");
  runnableLog("Scratchpad: 2 条消息");
  promptLog("生成提示 (4 条消息)");
  llmLog("🛠️ 工具调用: response");
  parserLog("检测到工具调用: response");
  parserLog("🏁 最终响应 - 循环结束");

  console.log("\n最终结果:");
  mainLog("执行完成 (2500ms)");
  mainLog("答案: 北京今天天气晴朗，温度15-25°C...");
  mainLog("信息源: 3 个");

  console.log("=".repeat(50));
  console.log("🎯 完整的循环执行流程，颜色清晰区分各个环节");
}

// 运行演示
if (require.main === module) {
  demonstrateColors();
  explainColors();
  demonstrateLoopFlow();
}

export {
  colorLog,
  toolLog,
  parserLog,
  formatLog,
  runnableLog,
  promptLog,
  llmLog,
  mainLog,
  startupLog,
};
