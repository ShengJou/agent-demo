import fs from "fs/promises";
import path from "path";
import { Task } from "../types.js";
import { A2AError } from "./error.js";
import {
  getCurrentTimestamp,
  isArtifactUpdate,
  isTaskStatusUpdate,
} from "./utils.js";

/**
 * 任务存储提供程序的简化接口。
 * 存储和检索任务。
 */
export interface TaskStore {
  /**
   * 保存任务。
   * 如果任务ID已存在，则覆盖现有数据。
   * @param data 包含任务的对象。
   * @returns 保存操作完成时解析的Promise。
   */
  save(task: Task): Promise<void>;

  /**
   * 通过任务ID加载任务。
   * @param taskId 要加载的任务ID。
   * @returns 解析为包含Task的对象的Promise，如果未找到则为undefined。
   */
  load(taskId: string): Promise<Task | undefined>;
}

// ========================
// 内存任务存储
// ========================

// 直接使用Task进行存储
export class InMemoryTaskStore implements TaskStore {
  private store: Map<string, Task> = new Map();

  async load(taskId: string): Promise<Task | undefined> {
    const entry = this.store.get(taskId);
    // 返回副本以防止外部修改
    return entry ? { ...entry } : undefined;
  }

  async save(task: Task): Promise<void> {
    // 存储副本以防止在调用者重用对象时的内部修改
    this.store.set(task.id, { ...task });
  }
}
