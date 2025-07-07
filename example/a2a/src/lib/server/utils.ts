import { TaskStatus, Artifact } from "../types.js";

/**
 * 生成ISO 8601格式的时间戳。
 * @returns 当前时间戳字符串。
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 检查值是否为普通对象（排除数组和null）。
 * @param value 要检查的值。
 * @returns 如果值是普通对象则为true，否则为false。
 */
export function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 类型守卫，检查对象是否为TaskStatus更新（缺少'parts'）。
 * 用于区分处理程序产生的更新。
 */
export function isTaskStatusUpdate(
  update: any // eslint-disable-line @typescript-eslint/no-explicit-any
): update is Omit<TaskStatus, "timestamp"> {
  // 检查是否有'state'但没有'parts'（Artifacts具有'parts'）
  return isObject(update) && "state" in update && !("parts" in update);
}

/**
 * 类型守卫，检查对象是否为Artifact更新（具有'parts'）。
 * 用于区分处理程序产生的更新。
 */
export function isArtifactUpdate(
  update: any // eslint-disable-line @typescript-eslint/no-explicit-any
): update is Artifact {
  // 检查是否有'parts'
  return isObject(update) && "parts" in update;
}
