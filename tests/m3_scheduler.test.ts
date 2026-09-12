import { describe, expect, it } from 'vitest';
import { CUSTOMER_CONFIG, RECIPE_DEFS, STAFF_CONFIG } from '../src/config';
import { CustomerManager } from '../src/customer';
import { EconomyLedger } from '../src/economy';
import { InventoryManager } from '../src/inventory';
import { OrderStateMachine } from '../src/order';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import { NavGraph } from '../src/scene/nav';
import { StaffMember } from '../src/staff';
import { pickOldestTask, SchedulableTask } from '../src/staff/scheduler';

function makeTask(orderId: string, taskType: SchedulableTask['taskType'], createdAt: number): SchedulableTask {
  return { orderId, taskType, createdAt };
}

describe('M3 任务调度 (T3.5 / T3.9)', () => {
  it('最老可领取任务优先（按任务创建时间）', () => {
    const tasks = [
      makeTask('o3', 'SERVE', 300),
      makeTask('o1', 'TAKE_ORDER', 100),
      makeTask('o2', 'BREW', 200)
    ];
    const picked = pickOldestTask(tasks, ['TAKE_ORDER', 'BREW', 'SERVE', 'CHECKOUT']);
    expect(picked?.orderId).toBe('o1');
  });

  it('职责范围外的任务不会被领取', () => {
    const tasks = [makeTask('o1', 'BREW', 100), makeTask('o2', 'CHECKOUT', 50)];
    const picked = pickOldestTask(tasks, ['TAKE_ORDER', 'SERVE']);
    expect(picked).toBeNull();
  });

  it('空任务列表返回 null', () => {
    expect(pickOldestTask([], ['TAKE_ORDER'])).toBeNull();
  });
});

describe('M3 店员自动运转 (T3.5 / T3.9)', () => {
  function setup(options?: { lowStock?: boolean; gold?: number }) {
    const saveManager = new SaveManager(new MemoryStorageAdapter());
    if (options?.gold !== undefined) {
      saveManager.setGold(options.gold);
    } else {
      saveManager.setGold(1000);
    }
    const inventory = new InventoryManager(
      options?.lowStock
        ? { coffee_beans: 1, milk: 30, tea_leaves: 20, syrup: 10, baking_flour: 10, fruits: 10 }
        : { coffee_beans: 40, milk: 30, tea_leaves: 20, syrup: 10, baking_flour: 10, fruits: 10 }
    );
    const ledger = new EconomyLedger(saveManager);
    const orderSM = new OrderStateMachine(inventory, ledger, saveManager);
    const nav = new NavGraph();
    const customerMgr = new CustomerManager(nav, inventory, orderSM);
    const staff = new StaffMember({
      orderStateMachine: orderSM,
      customerManager: customerMgr,
      inventory,
      ledger,
      saveManager,
      getBrewSlots: () => 1,
      routeToExit: () => [{ ...CUSTOMER_CONFIG.EXIT_POS }]
    });
    return { saveManager, inventory, ledger, orderSM, customerMgr, staff };
  }

  function hireWithAllDuties(staff: StaffMember) {
    expect(staff.hire()).toBe(true);
    staff.setDuty('TAKE_ORDER', true);
    staff.setDuty('BREW', true);
    staff.setDuty('SERVE', true);
    staff.setDuty('CHECKOUT', true);
  }

  it('单店员全职责链：订单从下单到收银全自动完成，无环节饿死', () => {
    const { orderSM, staff } = setup();
    hireWithAllDuties(staff);

    const recipe = RECIPE_DEFS.find((r) => r.id === 'espresso')!;
    const o1 = orderSM.createOrder('cust_a', 'table_1', recipe);
    // 第二单稍后创建
    const o2 = orderSM.createOrder('cust_b', 'table_2', recipe);
    void o2;

    const DT = 0.1;
    let o1CompletedAt = -1;
    let o2CompletedAt = -1;
    for (let t = 0; t < 60; t += DT) {
      staff.update(DT);
      orderSM.tickBrewing(DT);
      if (o1CompletedAt < 0 && orderSM.getOrder(o1.id)?.state === 'COMPLETED') o1CompletedAt = t;
      if (o2CompletedAt < 0 && orderSM.getOrder(o2.id)?.state === 'COMPLETED') o2CompletedAt = t;
    }

    expect(o1CompletedAt).toBeGreaterThanOrEqual(0);
    expect(o2CompletedAt).toBeGreaterThanOrEqual(0);
    // 最老优先：第一单先于第二单完成
    expect(o1CompletedAt).toBeLessThan(o2CompletedAt);
  });

  it('自动补货不抢占订单任务：有单可领时先干活', () => {
    const { orderSM, staff, inventory } = setup({ lowStock: true });
    hireWithAllDuties(staff);
    staff.setDuty('AUTO_SUPPLY', true);

    const recipe = RECIPE_DEFS.find((r) => r.id === 'espresso')!;
    orderSM.createOrder('cust_a', 'table_1', recipe);

    const stockBefore = inventory.getStock('coffee_beans');
    staff.update(0.1);
    // 有订单任务可领 → 不应触发补货
    expect(inventory.getStock('coffee_beans')).toBe(stockBefore);
    expect(staff.isBusy()).toBe(true);
  });

  it('无订单任务且库存低于阈值时自动补货（独立交易）', () => {
    const { staff, inventory, ledger } = setup({ lowStock: true });
    hireWithAllDuties(staff);
    staff.setDuty('AUTO_SUPPLY', true);

    const stockBefore = inventory.getStock('coffee_beans');
    const goldBefore = ledger.getBalance();
    staff.update(0.1);

    expect(inventory.getStock('coffee_beans')).toBe(stockBefore + 10);
    const lastTx = ledger.getHistory()[ledger.getHistory().length - 1];
    expect(lastTx.type).toBe('supply_purchase');
    expect(ledger.getBalance()).toBeLessThan(goldBefore);
  });

  it('店员持续工资：雇佣后每笔订单收入按 config 比例抽成', () => {
    const { saveManager, ledger, staff } = setup();
    hireWithAllDuties(staff);
    ledger.setHooks({
      getStaffCut: (gross) => staff.getWageCut(gross),
      repayFund: () => 0
    });

    const tx = ledger.settleOrder('拿铁', 100);
    expect(tx.staffCut).toBe(Math.round(100 * STAFF_CONFIG.WAGE_RATE));
    expect(tx.netChange).toBe(100 - tx.staffCut);
    expect(saveManager.getState().staff.hired).toBe(true);
  });

  it('雇佣费一次收取；未雇佣不抽成不干活', () => {
    const { ledger, orderSM, staff } = setup();
    const goldBefore = ledger.getBalance();
    expect(staff.hire()).toBe(true);
    expect(ledger.getBalance()).toBe(goldBefore - STAFF_CONFIG.HIRE_FEE);

    // 未雇佣的第二个店员实例不抽成
    const { staff: staff2, orderSM: sm2 } = setup();
    expect(staff2.getWageCut(100)).toBe(0);
    const recipe = RECIPE_DEFS.find((r) => r.id === 'espresso')!;
    sm2.createOrder('cust_x', 'table_1', recipe);
    staff2.update(0.1);
    expect(staff2.isBusy()).toBe(false);
    void orderSM;
  });
});
