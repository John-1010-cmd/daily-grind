import {
  BRANCH_CONFIG,
  SHOP_SCENES,
  SHOP_SIMULATION_CONFIG,
  StaffDuty,
  ShopId,
  WORLD_IDLE_CONFIG
} from '../config';
import type { ShopSimulationState } from './types';
import { advanceShop } from './simulation';

export interface WorldIdleShopState {
  unlocked: boolean;
  lastSettledAt: number;
  simulation: ShopSimulationState;
  decorOwnedCount: number;
}

export interface WorldIdleState {
  inventory: Record<string, number>;
  unlockedRecipeIds: readonly string[];
  brewSpeedMultiplier: number;
  mainStaff: { hired: boolean; duties: readonly StaffDuty[] };
  shops: Record<ShopId, WorldIdleShopState>;
}

export interface IdleRecipeLine {
  recipeId: string;
  recipeName: string;
  count: number;
  gross: number;
}

export interface IdleShopSettlement {
  shopId: ShopId;
  shopName: string;
  elapsedMs: number;
  capped: boolean;
  completedOrders: number;
  gross: number;
  recipes: IdleRecipeLine[];
  inventoryUsed: Record<string, number>;
  skipReason?: 'LOCKED' | 'MAIN_STAFF_MISSING' | 'MAIN_DUTY_CHAIN_INCOMPLETE';
}

export interface WorldSettlement {
  state: WorldIdleState;
  shops: IdleShopSettlement[];
  totalGross: number;
  totalCompletedOrders: number;
}

export function getCustomerIntervalMultiplier(decorOwnedCount: number): number {
  const reduction = Math.min(
    WORLD_IDLE_CONFIG.MAX_DECOR_INTERVAL_REDUCTION,
    Math.max(0, decorOwnedCount) * WORLD_IDLE_CONFIG.DECOR_INTERVAL_REDUCTION_PER_OWNED_VARIANT
  );
  return Math.max(WORLD_IDLE_CONFIG.MIN_CUSTOMER_INTERVAL_MULTIPLIER, 1 - reduction);
}

function hasCompleteDutyChain(duties: readonly StaffDuty[]): boolean {
  return SHOP_SIMULATION_CONFIG.AUTONOMOUS_DUTIES.every((duty) =>
    duties.includes(duty)
  );
}

function cloneWorldState(input: WorldIdleState): WorldIdleState {
  return {
    ...input,
    inventory: { ...input.inventory },
    unlockedRecipeIds: [...input.unlockedRecipeIds],
    mainStaff: { ...input.mainStaff, duties: [...input.mainStaff.duties] },
    shops: {
      main: {
        ...input.shops.main,
        simulation: structuredClone(input.shops.main.simulation)
      },
      seaside: {
        ...input.shops.seaside,
        simulation: structuredClone(input.shops.seaside.simulation)
      }
    }
  };
}

/** 世界级唯一挂机入口：逐店按固定优先级推进，共享库存天然先到先得。 */
export function settleWorldIdle(worldState: WorldIdleState, now: number): WorldSettlement {
  const state = cloneWorldState(worldState);
  const safeNow = Number.isFinite(now) ? Math.max(0, now) : 0;
  const settlements: IdleShopSettlement[] = [];

  for (const shopId of BRANCH_CONFIG.SHOP_PRIORITY) {
    const shop = state.shops[shopId];
    const lastSettledAt = shop.lastSettledAt > 0 ? shop.lastSettledAt : safeNow;
    const rawElapsedMs = Math.max(0, safeNow - lastSettledAt);
    const elapsedMs = Math.min(rawElapsedMs, WORLD_IDLE_CONFIG.MAX_ELAPSED_MS_PER_SHOP);
    const settlement: IdleShopSettlement = {
      shopId,
      shopName: SHOP_SCENES[shopId].name,
      elapsedMs,
      capped: rawElapsedMs > WORLD_IDLE_CONFIG.MAX_ELAPSED_MS_PER_SHOP,
      completedOrders: 0,
      gross: 0,
      recipes: [],
      inventoryUsed: {}
    };

    if (!shop.unlocked) {
      settlement.skipReason = 'LOCKED';
    } else if (shopId === 'main' && !state.mainStaff.hired) {
      settlement.skipReason = 'MAIN_STAFF_MISSING';
    } else if (shopId === 'main' && !hasCompleteDutyChain(state.mainStaff.duties)) {
      settlement.skipReason = 'MAIN_DUTY_CHAIN_INCOMPLETE';
    } else if (elapsedMs > 0) {
      const beforeInventory = { ...state.inventory };
      const result = advanceShop(
        shop.simulation,
        elapsedMs,
        { inventory: state.inventory, grossGold: 0 },
        {
          unlockedRecipeIds: state.unlockedRecipeIds,
          duties: SHOP_SIMULATION_CONFIG.AUTONOMOUS_DUTIES,
          brewSpeedMultiplier: state.brewSpeedMultiplier,
          customerIntervalMultiplier: getCustomerIntervalMultiplier(shop.decorOwnedCount)
        }
      );
      shop.simulation = result.state;
      state.inventory = result.economy.inventory;
      const recipeLines = new Map<string, IdleRecipeLine>();
      for (const event of result.events) {
        if (event.type !== 'ORDER_COMPLETED') continue;
        const line = recipeLines.get(event.recipeId) ?? {
          recipeId: event.recipeId,
          recipeName: event.recipeName,
          count: 0,
          gross: 0
        };
        line.count += 1;
        line.gross += event.gross;
        recipeLines.set(event.recipeId, line);
        settlement.completedOrders += 1;
        settlement.gross += event.gross;
      }
      settlement.recipes = [...recipeLines.values()];
      for (const [ingredientId, before] of Object.entries(beforeInventory)) {
        const used = before - (state.inventory[ingredientId] ?? 0);
        if (used > 0) settlement.inventoryUsed[ingredientId] = used;
      }
    }

    // 回拨不把游标倒退；正常或封顶结算均直接推进到 now，重复调用因 elapsed=0 幂等。
    shop.lastSettledAt = Math.max(shop.lastSettledAt, safeNow);
    settlements.push(settlement);
  }

  return {
    state,
    shops: settlements,
    totalGross: settlements.reduce((sum, item) => sum + item.gross, 0),
    totalCompletedOrders: settlements.reduce((sum, item) => sum + item.completedOrders, 0)
  };
}
