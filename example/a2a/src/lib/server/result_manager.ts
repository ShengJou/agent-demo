import {
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from "../types.js";
import { AgentExecutionEvent } from "./events/execution_event_bus.js";
import { TaskStore } from "./store.js";

/**
 * 结果管理器类，负责处理代理执行事件并管理任务状态。
 */
export class ResultManager {
  private taskStore: TaskStore;
  private currentTask?: Task;
  private latestUserMessage?: Message; // 如果创建新任务，则添加到历史记录中
  private finalMessageResult?: Message; // 如果是最终结果，则存储消息

  constructor(taskStore: TaskStore) {
    this.taskStore = taskStore;
  }

  /**
   * 设置上下文，包括最新的用户消息。
   * @param latestUserMessage 最新的用户消息
   */
  public setContext(latestUserMessage: Message): void {
    this.latestUserMessage = latestUserMessage;
  }

  /**
   * 处理代理执行事件并更新任务存储。
   * @param event 代理执行事件。
   */
  public async processEvent(event: AgentExecutionEvent): Promise<void> {
    if (event.kind === "message") {
      this.finalMessageResult = event as Message;
      // 如果收到消息，通常是最终结果，
      // 但我们继续处理以确保任务状态（如果有）也被保存。
      // ExecutionEventQueue将在消息事件后停止。
    } else if (event.kind === "task") {
      const taskEvent = event as Task;
      this.currentTask = { ...taskEvent }; // 创建副本

      // 确保最新的用户消息在历史记录中（如果尚未存在）
      if (this.latestUserMessage) {
        if (
          !this.currentTask.history?.find(
            (msg) => msg.messageId === this.latestUserMessage!.messageId
          )
        ) {
          this.currentTask.history = [
            this.latestUserMessage,
            ...(this.currentTask.history || []),
          ];
        }
      }
      await this.saveCurrentTask();
    } else if (event.kind === "status-update") {
      const updateEvent = event as TaskStatusUpdateEvent;
      if (this.currentTask && this.currentTask.id === updateEvent.taskId) {
        this.currentTask.status = updateEvent.status;
        if (updateEvent.status.message) {
          // 如果历史记录中尚未存在，则将消息添加到历史记录
          if (
            !this.currentTask.history?.find(
              (msg) => msg.messageId === updateEvent.status.message!.messageId
            )
          ) {
            this.currentTask.history = [
              ...(this.currentTask.history || []),
              updateEvent.status.message,
            ];
          }
        }
        await this.saveCurrentTask();
      } else if (!this.currentTask && updateEvent.taskId) {
        // 可能是我们尚未看到'task'事件的任务的更新，
        // 或者我们正在重新水化。尝试加载。
        const loaded = await this.taskStore.load(updateEvent.taskId);
        if (loaded) {
          this.currentTask = loaded;
          this.currentTask.status = updateEvent.status;
          if (updateEvent.status.message) {
            if (
              !this.currentTask.history?.find(
                (msg) => msg.messageId === updateEvent.status.message!.messageId
              )
            ) {
              this.currentTask.history = [
                ...(this.currentTask.history || []),
                updateEvent.status.message,
              ];
            }
          }
          await this.saveCurrentTask();
        } else {
          console.warn(
            `ResultManager: Received status update for unknown task ${updateEvent.taskId}`
          );
        }
      }
      // 如果是最终状态更新，ExecutionEventQueue将停止。
      // 最终结果将是currentTask。
    } else if (event.kind === "artifact-update") {
      const artifactEvent = event as TaskArtifactUpdateEvent;
      if (this.currentTask && this.currentTask.id === artifactEvent.taskId) {
        if (!this.currentTask.artifacts) {
          this.currentTask.artifacts = [];
        }
        const existingArtifactIndex = this.currentTask.artifacts.findIndex(
          (art) => art.artifactId === artifactEvent.artifact.artifactId
        );
        if (existingArtifactIndex !== -1) {
          if (artifactEvent.append) {
            // 基本追加逻辑，假设部分兼容
            // 特定部分类型可能需要更复杂的合并
            const existingArtifact =
              this.currentTask.artifacts[existingArtifactIndex];
            existingArtifact.parts.push(...artifactEvent.artifact.parts);
            if (artifactEvent.artifact.description)
              existingArtifact.description = artifactEvent.artifact.description;
            if (artifactEvent.artifact.name)
              existingArtifact.name = artifactEvent.artifact.name;
            if (artifactEvent.artifact.metadata)
              existingArtifact.metadata = {
                ...existingArtifact.metadata,
                ...artifactEvent.artifact.metadata,
              };
          } else {
            this.currentTask.artifacts[existingArtifactIndex] =
              artifactEvent.artifact;
          }
        } else {
          this.currentTask.artifacts.push(artifactEvent.artifact);
        }
        await this.saveCurrentTask();
      } else if (!this.currentTask && artifactEvent.taskId) {
        // 类似于状态更新，如果任务不在内存中，尝试加载
        const loaded = await this.taskStore.load(artifactEvent.taskId);
        if (loaded) {
          this.currentTask = loaded;
          if (!this.currentTask.artifacts) this.currentTask.artifacts = [];
          // 应用工件更新逻辑（如上所述）
          const existingArtifactIndex = this.currentTask.artifacts.findIndex(
            (art) => art.artifactId === artifactEvent.artifact.artifactId
          );
          if (existingArtifactIndex !== -1) {
            if (artifactEvent.append) {
              this.currentTask.artifacts[existingArtifactIndex].parts.push(
                ...artifactEvent.artifact.parts
              );
            } else {
              this.currentTask.artifacts[existingArtifactIndex] =
                artifactEvent.artifact;
            }
          } else {
            this.currentTask.artifacts.push(artifactEvent.artifact);
          }
          await this.saveCurrentTask();
        } else {
          console.warn(
            `ResultManager: Received artifact update for unknown task ${artifactEvent.taskId}`
          );
        }
      }
    }
  }

  /**
   * 保存当前任务到存储中。
   */
  private async saveCurrentTask(): Promise<void> {
    if (this.currentTask) {
      await this.taskStore.save(this.currentTask);
    }
  }

  /**
   * 获取最终结果，可能是Message或Task。
   * 应在事件流完全处理后调用。
   * @returns 最终的Message或当前Task。
   */
  public getFinalResult(): Message | Task | undefined {
    if (this.finalMessageResult) {
      return this.finalMessageResult;
    }
    return this.currentTask;
  }

  /**
   * 获取此ResultManager实例当前管理的任务。
   * 此任务可能是启动时的任务或在代理执行期间创建的任务。
   * @returns 当前Task，如果没有活动任务则为undefined。
   */
  public getCurrentTask(): Task | undefined {
    return this.currentTask;
  }
}
