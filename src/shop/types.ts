import type { ShopId } from '../config';

export type SimOrderStage =
  | 'WAITING_FOR_ORDER'
  | 'WAITING_TO_BREW'
  | 'BREWING'
  | 'WAITING_TO_SERVE'
  | 'ENJOYING_DRINK'
  | 'WAITING_TO_PAY'
  | 'LEAVING';

export interface SimCustomerState {
  id: string;
  recipeId: string;
  stage: SimOrderStage;
  stageRemainingMs: number;
  patienceRemainingMs: number;
  reservedIngredients: Record<string, number>;
}

export interface ShopSimulationState {
  shopId: ShopId;
  rngState: number;
  simulatedMs: number;
  remainderMs: number;
  nextCustomerInMs: number;
  nextCustomerId: number;
  customers: SimCustomerState[];
  completedOrders: number;
}
