/**
 * A2A Server V2 库的主入口点。
 * 导出服务器类、存储实现和核心类型。
 */

// 代理执行相关
export type { AgentExecutor } from "./server/agent_execution/agent_executor.js";
export { RequestContext } from "./server/agent_execution/request_context.js";

// 事件总线相关
export type { ExecutionEventBus } from "./server/events/execution_event_bus.js";
export { DefaultExecutionEventBus } from "./server/events/execution_event_bus.js";
export type { ExecutionEventBusManager } from "./server/events/execution_event_bus_manager.js";
export { DefaultExecutionEventBusManager } from "./server/events/execution_event_bus_manager.js";

// 请求处理相关
export type { A2ARequestHandler } from "./server/request_handler/a2a_request_handler.js";
export { DefaultRequestHandler } from "./server/request_handler/default_request_handler.js";

// 其他服务端组件
export { ResultManager } from "./server/result_manager.js";
export type { TaskStore } from "./server/store.js";
export { InMemoryTaskStore } from "./server/store.js";

// 传输层
export { JsonRpcTransportHandler } from "./server/transports/jsonrpc_transport_handler.js";
export { A2AExpressApp } from "./server/a2a_express_app.js";
export { A2AError } from "./server/error.js";

// 导出客户端
export { A2AClient } from "./client/client.js";

// 为方便使用，重新导出所有schema类型
export * from "./types.js";
export type { A2AResponse } from "./a2a_response.js";
