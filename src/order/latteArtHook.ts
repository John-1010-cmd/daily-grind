import { Order } from './types';

export interface LatteArtEvent {
  orderId: string;
  customerId: string;
  recipeId: string;
}

export interface LatteArtHook {
  onExclusiveDrinkBrewStarted(event: LatteArtEvent): void;
}

/**
 * v2 拉花涂鸦彩蛋的稳定接缝。v1 明确为空实现：不进入日常循环、没有成败判定。
 */
export const NOOP_LATTE_ART_HOOK: LatteArtHook = {
  onExclusiveDrinkBrewStarted(_event): void {}
};

export function toLatteArtEvent(order: Order): LatteArtEvent {
  return {
    orderId: order.id,
    customerId: order.customerId,
    recipeId: order.recipe.id
  };
}
