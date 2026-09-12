import {
  RECIPE_DEFS,
  SHOP_SIMULATION_CONFIG,
  StaffDuty
} from '../config';
import type { RecipeDef, ShopId } from '../config';
import type { ShopSimulationState, SimCustomerState } from './types';

export interface SharedShopEconomy {
  inventory: Record<string, number>;
  grossGold: number;
}

export type ShopEvent =
  | { type: 'CUSTOMER_ARRIVED'; shopId: ShopId; customerId: string; recipeId: string }
  | { type: 'OUT_OF_STOCK_CHANGED'; shopId: ShopId; customerId: string; recipeId: string }
  | { type: 'OUT_OF_STOCK_LEFT'; shopId: ShopId; customerId: string }
  | { type: 'ORDER_COMPLETED'; shopId: ShopId; customerId: string; recipeId: string; recipeName: string; gross: number }
  | { type: 'CUSTOMER_LEFT_CALMLY'; shopId: ShopId; customerId: string };

export interface AdvanceShopOptions {
  unlockedRecipeIds: readonly string[];
  duties: readonly StaffDuty[];
  brewSpeedMultiplier: number;
}

export interface AdvanceShopResult {
  state: ShopSimulationState;
  economy: SharedShopEconomy;
  events: ShopEvent[];
}

export function createInitialShopState(shopId: ShopId): ShopSimulationState {
  return {
    shopId,
    rngState:
      shopId === 'main'
        ? SHOP_SIMULATION_CONFIG.MAIN_RNG_SEED
        : SHOP_SIMULATION_CONFIG.SEASIDE_RNG_SEED,
    simulatedMs: 0,
    remainderMs: 0,
    nextCustomerInMs: SHOP_SIMULATION_CONFIG.INITIAL_CUSTOMER_DELAY_MS,
    nextCustomerId: 1,
    customers: [],
    completedOrders: 0
  };
}

function cloneState(state: ShopSimulationState): ShopSimulationState {
  return {
    ...state,
    customers: state.customers.map((customer) => ({
      ...customer,
      reservedIngredients: { ...customer.reservedIngredients }
    }))
  };
}

function nextRandom(state: ShopSimulationState): number {
  let value = state.rngState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 0x1_0000_0000;
}

function canFulfill(inventory: Record<string, number>, recipe: RecipeDef): boolean {
  return Object.entries(recipe.ingredients).every(([id, count]) => (inventory[id] ?? 0) >= count);
}

function consume(inventory: Record<string, number>, ingredients: Record<string, number>): void {
  for (const [id, count] of Object.entries(ingredients)) {
    inventory[id] = Math.max(0, (inventory[id] ?? 0) - count);
  }
}

function refund(inventory: Record<string, number>, ingredients: Record<string, number>): void {
  for (const [id, count] of Object.entries(ingredients)) {
    inventory[id] = (inventory[id] ?? 0) + count;
  }
}

function hasDuty(options: AdvanceShopOptions, duty: StaffDuty): boolean {
  return options.duties.includes(duty);
}

function beginLeaving(
  customer: SimCustomerState,
  economy: SharedShopEconomy,
  refundReserved: boolean
): void {
  if (refundReserved) refund(economy.inventory, customer.reservedIngredients);
  customer.reservedIngredients = {};
  customer.stage = 'LEAVING';
  customer.stageRemainingMs = SHOP_SIMULATION_CONFIG.LEAVE_MS;
}

function advanceCustomer(
  state: ShopSimulationState,
  customer: SimCustomerState,
  stepMs: number,
  economy: SharedShopEconomy,
  options: AdvanceShopOptions,
  events: ShopEvent[]
): boolean {
  const recipe = RECIPE_DEFS.find((item) => item.id === customer.recipeId);
  if (!recipe) {
    beginLeaving(customer, economy, true);
    return true;
  }

  if (customer.stage === 'LEAVING') {
    customer.stageRemainingMs -= stepMs;
    if (customer.stageRemainingMs <= 0) {
      events.push({ type: 'CUSTOMER_LEFT_CALMLY', shopId: state.shopId, customerId: customer.id });
      return false;
    }
    return true;
  }

  if (customer.stage === 'ENJOYING_DRINK') {
    customer.stageRemainingMs -= stepMs;
    if (customer.stageRemainingMs <= 0) {
      customer.stage = 'WAITING_TO_PAY';
      customer.patienceRemainingMs = SHOP_SIMULATION_CONFIG.PATIENCE_MS;
    }
    return true;
  }

  if (customer.stage === 'BREWING') {
    customer.stageRemainingMs -= stepMs;
    customer.patienceRemainingMs -= stepMs;
    if (customer.stageRemainingMs <= 0) {
      customer.stage = 'WAITING_TO_SERVE';
    } else if (customer.patienceRemainingMs <= 0) {
      beginLeaving(customer, economy, true);
    }
    return true;
  }

  customer.patienceRemainingMs -= stepMs;
  if (customer.patienceRemainingMs <= 0) {
    const refundReserved = customer.stage === 'WAITING_TO_BREW';
    beginLeaving(customer, economy, refundReserved);
    return true;
  }

  switch (customer.stage) {
    case 'WAITING_FOR_ORDER': {
      if (!hasDuty(options, 'TAKE_ORDER')) return true;
      const unlocked = RECIPE_DEFS.filter((item) => options.unlockedRecipeIds.includes(item.id));
      const preferredIndex = Math.max(0, unlocked.findIndex((item) => item.id === customer.recipeId));
      const available = unlocked.filter((item) => canFulfill(economy.inventory, item));
      if (available.length === 0) {
        events.push({ type: 'OUT_OF_STOCK_LEFT', shopId: state.shopId, customerId: customer.id });
        beginLeaving(customer, economy, false);
        return true;
      }
      const preferred = unlocked[preferredIndex];
      const selected = preferred && canFulfill(economy.inventory, preferred) ? preferred : available[0];
      if (selected.id !== customer.recipeId) {
        customer.recipeId = selected.id;
        events.push({ type: 'OUT_OF_STOCK_CHANGED', shopId: state.shopId, customerId: customer.id, recipeId: selected.id });
      }
      consume(economy.inventory, selected.ingredients);
      customer.reservedIngredients = { ...selected.ingredients };
      customer.stage = 'WAITING_TO_BREW';
      return true;
    }
    case 'WAITING_TO_BREW':
      if (hasDuty(options, 'BREW')) {
        customer.stage = 'BREWING';
        customer.stageRemainingMs = Math.max(
          SHOP_SIMULATION_CONFIG.FIXED_TIMESTEP_MS,
          Math.round(recipe.brewTimeSeconds * 1000 * options.brewSpeedMultiplier)
        );
      }
      return true;
    case 'WAITING_TO_SERVE':
      if (hasDuty(options, 'SERVE')) {
        customer.reservedIngredients = {};
        customer.stage = 'ENJOYING_DRINK';
        customer.stageRemainingMs = SHOP_SIMULATION_CONFIG.ENJOY_MS;
      }
      return true;
    case 'WAITING_TO_PAY':
      if (hasDuty(options, 'CHECKOUT')) {
        economy.grossGold += recipe.price;
        state.completedOrders += 1;
        events.push({
          type: 'ORDER_COMPLETED',
          shopId: state.shopId,
          customerId: customer.id,
          recipeId: recipe.id,
          recipeName: recipe.name,
          gross: recipe.price
        });
        return false;
      }
      return true;
    default:
      return true;
  }
}

function runFixedStep(
  state: ShopSimulationState,
  economy: SharedShopEconomy,
  options: AdvanceShopOptions,
  events: ShopEvent[]
): void {
  const stepMs = SHOP_SIMULATION_CONFIG.FIXED_TIMESTEP_MS;
  state.simulatedMs += stepMs;
  state.nextCustomerInMs -= stepMs;

  if (state.nextCustomerInMs <= 0 && state.customers.length < SHOP_SIMULATION_CONFIG.MAX_CUSTOMERS) {
    const unlocked = RECIPE_DEFS.filter((recipe) => options.unlockedRecipeIds.includes(recipe.id));
    if (unlocked.length > 0) {
      const recipe = unlocked[Math.floor(nextRandom(state) * unlocked.length)] ?? unlocked[0];
      const customer: SimCustomerState = {
        id: `${state.shopId}_sim_${state.nextCustomerId++}`,
        recipeId: recipe.id,
        stage: 'WAITING_FOR_ORDER',
        stageRemainingMs: 0,
        patienceRemainingMs: SHOP_SIMULATION_CONFIG.PATIENCE_MS,
        reservedIngredients: {}
      };
      state.customers.push(customer);
      events.push({ type: 'CUSTOMER_ARRIVED', shopId: state.shopId, customerId: customer.id, recipeId: recipe.id });
    }
    const intervalRange =
      SHOP_SIMULATION_CONFIG.CUSTOMER_INTERVAL_MAX_MS -
      SHOP_SIMULATION_CONFIG.CUSTOMER_INTERVAL_MIN_MS;
    state.nextCustomerInMs =
      SHOP_SIMULATION_CONFIG.CUSTOMER_INTERVAL_MIN_MS +
      Math.floor(nextRandom(state) * (intervalRange + 1));
  }

  state.customers = state.customers.filter((customer) =>
    advanceCustomer(state, customer, stepMs, economy, options, events)
  );
}

/** 纯函数、固定 timestep；输入对象不被修改，余数随 shopState 携带。 */
export function advanceShop(
  shopState: ShopSimulationState,
  elapsedMs: number,
  sharedEconomy: SharedShopEconomy,
  options: AdvanceShopOptions
): AdvanceShopResult {
  const state = cloneState(shopState);
  const economy: SharedShopEconomy = {
    inventory: { ...sharedEconomy.inventory },
    grossGold: sharedEconomy.grossGold
  };
  const events: ShopEvent[] = [];
  const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const totalMs = state.remainderMs + safeElapsedMs;
  const steps = Math.floor(totalMs / SHOP_SIMULATION_CONFIG.FIXED_TIMESTEP_MS);
  state.remainderMs = totalMs - steps * SHOP_SIMULATION_CONFIG.FIXED_TIMESTEP_MS;

  for (let index = 0; index < steps; index += 1) {
    runFixedStep(state, economy, options, events);
  }

  return { state, economy, events };
}
