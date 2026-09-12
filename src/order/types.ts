import { RecipeDef } from '../config';

export type OrderState =
  | 'WAITING_FOR_ORDER' // 等待接单
  | 'ORDER_TAKEN'       // 已接单
  | 'WAITING_TO_BREW'   // 等待制作
  | 'BREWING'           // 制作中
  | 'WAITING_TO_SERVE'  // 待上菜
  | 'WAITING_TO_PAY'    // 待收银
  | 'COMPLETED'         // 完成
  | 'ABANDONED';        // 放弃

export type OrderTaskType = 'TAKE_ORDER' | 'BREW' | 'SERVE' | 'CHECKOUT';

export interface TaskLock {
  taskType: OrderTaskType;
  executorId: string;
  claimedAt: number;
  started: boolean;
}

export interface Order {
  id: string;
  customerId: string;
  tableId: string;
  recipe: RecipeDef;
  state: OrderState;
  createdAt: number;
  updatedAt: number;
  brewProgress: number; // 0 to 1
  brewDurationSeconds: number;
  reservedIngredients: Record<string, number>;
  activeTaskLock: TaskLock | null;
  abandonReason?: string;
}
