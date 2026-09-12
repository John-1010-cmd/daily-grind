import { describe, expect, it } from 'vitest';
import {
  RECIPE_DEFS,
  SHOP_SIMULATION_CONFIG,
  WORLD_IDLE_CONFIG
} from '../src/config';
import { EconomyLedger } from '../src/economy';
import { InventoryManager } from '../src/inventory';
import { OrderStateMachine } from '../src/order';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import {
  advanceShop,
  createInitialShopState,
  prepareShopSwitch,
  SharedShopEconomy,
  settleWorldIdle,
  WorldIdleState
} from '../src/shop';

const ALL_DUTIES = SHOP_SIMULATION_CONFIG.AUTONOMOUS_DUTIES;
const OPTIONS = {
  unlockedRecipeIds: ['espresso'],
  duties: ALL_DUTIES,
  brewSpeedMultiplier: 1,
  customerIntervalMultiplier: 1
} as const;

function makeWorld(overrides?: Partial<WorldIdleState>): WorldIdleState {
  return {
    inventory: { coffee_beans: 100, milk: 0, tea_leaves: 0, syrup: 0, baking_flour: 0, fruits: 0 },
    unlockedRecipeIds: ['espresso'],
    brewSpeedMultiplier: 1,
    mainStaff: { hired: true, duties: [...ALL_DUTIES] },
    shops: {
      main: {
        unlocked: true,
        lastSettledAt: 1_000_000,
        simulation: createInitialShopState('main'),
        decorOwnedCount: 0
      },
      seaside: {
        unlocked: false,
        lastSettledAt: 1_000_000,
        simulation: createInitialShopState('seaside'),
        decorOwnedCount: 0
      }
    },
    ...overrides
  };
}

describe('M5 确定性店铺推进（T5.4 / T5.6）', () => {
  it('同种子前台与后台调用得到完全相同状态、库存和事件', () => {
    const state = createInitialShopState('main');
    const economy = { inventory: { coffee_beans: 20 }, grossGold: 0 };

    const foreground = advanceShop(state, 60_000, economy, OPTIONS);
    const background = advanceShop(state, 60_000, economy, OPTIONS);

    expect(background).toEqual(foreground);
  });

  it('1×1000ms 与 10×100ms 分段调用等价，且不修改输入对象', () => {
    const initial = createInitialShopState('seaside');
    const economy = { inventory: { coffee_beans: 20 }, grossGold: 0 };
    const initialSnapshot = structuredClone(initial);
    const economySnapshot = structuredClone(economy);
    const once = advanceShop(initial, 1_000, economy, OPTIONS);

    let segmentedState = initial;
    let segmentedEconomy: SharedShopEconomy = economy;
    const segmentedEvents = [] as typeof once.events;
    for (let index = 0; index < 10; index += 1) {
      const step = advanceShop(segmentedState, 100, segmentedEconomy, OPTIONS);
      segmentedState = step.state;
      segmentedEconomy = step.economy;
      segmentedEvents.push(...step.events);
    }

    expect(segmentedState).toEqual(once.state);
    expect(segmentedEconomy).toEqual(once.economy);
    expect(segmentedEvents).toEqual(once.events);
    expect(initial).toEqual(initialSnapshot);
    expect(economy).toEqual(economySnapshot);
  });
});

describe('M5 世界级挂机结算（T5.5 / T5.6）', () => {
  it('每店离线时长独立精确封顶 12 小时', () => {
    const world = makeWorld({
      inventory: { coffee_beans: 10_000 },
      shops: {
        main: { ...makeWorld().shops.main },
        seaside: { ...makeWorld().shops.seaside, unlocked: true }
      }
    });
    const now = 1_000_000 + WORLD_IDLE_CONFIG.MAX_ELAPSED_MS_PER_SHOP * 2;
    const result = settleWorldIdle(world, now);

    expect(result.shops[0].elapsedMs).toBe(WORLD_IDLE_CONFIG.MAX_ELAPSED_MS_PER_SHOP);
    expect(result.shops[1].elapsedMs).toBe(WORLD_IDLE_CONFIG.MAX_ELAPSED_MS_PER_SHOP);
    expect(result.shops.every((shop) => shop.capped)).toBe(true);
  }, 15_000);

  it('共享库存不足时固定本店优先，库存永不为负', () => {
    const base = makeWorld();
    const world = makeWorld({
      inventory: { coffee_beans: 1 },
      shops: {
        main: { ...base.shops.main },
        seaside: { ...base.shops.seaside, unlocked: true }
      }
    });
    const result = settleWorldIdle(world, 1_060_000);

    expect(result.shops[0].shopId).toBe('main');
    expect(result.shops[0].completedOrders).toBe(1);
    expect(result.shops[1].completedOrders).toBe(0);
    expect(result.state.inventory.coffee_beans).toBe(0);
  });

  it('相同 now 重复调用幂等，不重复发放收益', () => {
    const first = settleWorldIdle(makeWorld(), 1_060_000);
    const second = settleWorldIdle(first.state, 1_060_000);

    expect(first.totalGross).toBeGreaterThan(0);
    expect(second.totalGross).toBe(0);
    expect(second.totalCompletedOrders).toBe(0);
    expect(second.state.inventory).toEqual(first.state.inventory);
  });

  it('本店职责链缺失时无收益也不消耗原料', () => {
    const world = makeWorld({
      mainStaff: { hired: true, duties: ['TAKE_ORDER', 'BREW', 'SERVE'] }
    });
    const before = structuredClone(world.inventory);
    const result = settleWorldIdle(world, 1_060_000);

    expect(result.shops[0].skipReason).toBe('MAIN_DUTY_CHAIN_INCOMPLETE');
    expect(result.shops[0].gross).toBe(0);
    expect(result.state.inventory).toEqual(before);
  });

  it('wallClock 回拨按 0，结算游标不倒退', () => {
    const world = makeWorld();
    const result = settleWorldIdle(world, 900_000);

    expect(result.shops[0].elapsedMs).toBe(0);
    expect(result.totalGross).toBe(0);
    expect(result.state.shops.main.lastSettledAt).toBe(1_000_000);
  });
});

describe('M5 切店任务锁（T5.4 / T5.6）', () => {
  function setupOrderMachine() {
    const save = new SaveManager(new MemoryStorageAdapter());
    const inventory = new InventoryManager({ coffee_beans: 10 });
    const ledger = new EconomyLedger(save);
    return { machine: new OrderStateMachine(inventory, ledger, save) };
  }

  it('本店无雇员时不能前往分店', () => {
    const { machine } = setupOrderMachine();
    expect(prepareShopSwitch('main', 'seaside', machine, false)).toMatchObject({ ok: false });
  });

  it('玩家执行中的任务阻止切换且保留任务锁', () => {
    const { machine } = setupOrderMachine();
    const espresso = RECIPE_DEFS.find((recipe) => recipe.id === 'espresso')!;
    const order = machine.createOrder('customer', 'table_1', espresso);
    machine.claimTask(order.id, 'TAKE_ORDER', 'player');
    machine.completeTask(order.id, 'TAKE_ORDER', 'player');
    machine.claimTask(order.id, 'BREW', 'player');
    machine.startTask(order.id, 'BREW', 'player');

    expect(prepareShopSwitch('main', 'seaside', machine, true)).toMatchObject({
      ok: false,
      releasedTaskCount: 0
    });
    expect(order.activeTaskLock?.started).toBe(true);
  });

  it('已领取未开始任务在成功切换前自动释放回队列', () => {
    const { machine } = setupOrderMachine();
    const espresso = RECIPE_DEFS.find((recipe) => recipe.id === 'espresso')!;
    const order = machine.createOrder('customer', 'table_1', espresso);
    machine.claimTask(order.id, 'TAKE_ORDER', 'player');

    expect(prepareShopSwitch('main', 'seaside', machine, true)).toEqual({
      ok: true,
      releasedTaskCount: 1
    });
    expect(order.activeTaskLock).toBeNull();
    expect(machine.canClaimTask(order.id, 'TAKE_ORDER')).toBe(true);
  });
});
