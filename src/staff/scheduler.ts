import { OrderTaskType } from '../order/types';

export interface SchedulableTask {
  orderId: string;
  taskType: OrderTaskType;
  createdAt: number;
}

/**
 * 任务调度（第 5 节，集中在调度模块）：
 * 执行者空闲时在其职责范围内按"最老可领取任务优先"（按任务创建时间）领取。
 * 纯函数，便于单元测试。
 */
export function pickOldestTask(
  tasks: readonly SchedulableTask[],
  duties: readonly OrderTaskType[]
): SchedulableTask | null {
  const dutySet = new Set(duties);
  let oldest: SchedulableTask | null = null;
  for (const task of tasks) {
    if (!dutySet.has(task.taskType)) continue;
    if (!oldest || task.createdAt < oldest.createdAt) {
      oldest = task;
    }
  }
  return oldest;
}
