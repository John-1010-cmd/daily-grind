import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMERGENCY_PACKAGE_CONFIG,
  RECIPE_DEFS,
  RecipeDef
} from '../src/config';
import { CustomerManager } from '../src/customer';
import { EconomyLedger } from '../src/economy';
import { InventoryManager } from '../src/inventory';
import { OrderStateMachine } from '../src/order';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import { NavGraph } from '../src/scene/nav';

describe('M1 核心循环灰盒测试 (T1.1, T1.3, T1.4, T1.6, T1.7, T1.9)', () => {
  let saveManager: SaveManager;
  let inventory: InventoryManager;
  let ledger: EconomyLedger;
  let orderSM: OrderStateMachine;

  const espresso = RECIPE_DEFS.find((r) => r.id === 'espresso')!;
  const latte = RECIPE_DEFS.find((r) => r.id === 'latte')!;
  const jasmineTea = RECIPE_DEFS.find((r) => r.id === 'jasmine_tea')!;

  beforeEach(() => {
    const memory = new MemoryStorageAdapter();
    saveManager = new SaveManager(memory);
    inventory = new InventoryManager({
      coffee_beans: 10,
      milk: 10,
      tea_leaves: 10,
      syrup: 10,
      baking_flour: 10,
      fruits: 10
    });
    ledger = new EconomyLedger(saveManager);
    orderSM = new OrderStateMachine(inventory, ledger, saveManager);
  });

  it('1. 状态迁移合法全流程：接单 → 等待制作 → 制作中 → 待上菜 → 待收银 → 完成', () => {
    const order = orderSM.createOrder('cust_1', 'table_1', espresso);
    expect(order.state).toBe('WAITING_FOR_ORDER');

    // 1. 接单
    expect(orderSM.canClaimTask(order.id, 'TAKE_ORDER')).toBe(true);
    expect(orderSM.claimTask(order.id, 'TAKE_ORDER', 'player')).toBe(true);
    // 接单时预占原料
    const initialAvailable = inventory.getAvailable('coffee_beans');
    expect(orderSM.completeTask(order.id, 'TAKE_ORDER', 'player')).toBe(true);
    expect(order.state).toBe('WAITING_TO_BREW');
    expect(inventory.getAvailable('coffee_beans')).toBe(initialAvailable - 1);
    expect(inventory.getReserved('coffee_beans')).toBe(1);

    // 2. 制作
    expect(orderSM.canClaimTask(order.id, 'BREW')).toBe(true);
    expect(orderSM.claimTask(order.id, 'BREW', 'player')).toBe(true);
    expect(orderSM.startTask(order.id, 'BREW', 'player')).toBe(true);
    expect(order.state).toBe('BREWING');

    // 推进制作进度
    orderSM.tickBrewing(espresso.brewTimeSeconds + 0.1);
    expect(order.state).toBe('WAITING_TO_SERVE');

    // 3. 上菜
    expect(orderSM.canClaimTask(order.id, 'SERVE')).toBe(true);
    expect(orderSM.claimTask(order.id, 'SERVE', 'player')).toBe(true);
    expect(orderSM.completeTask(order.id, 'SERVE', 'player')).toBe(true);
    expect(order.state).toBe('WAITING_TO_PAY');
    // 上菜后预占原料正式消耗扣减
    expect(inventory.getReserved('coffee_beans')).toBe(0);

    // 4. 收银
    const prevGold = ledger.getBalance();
    expect(orderSM.canClaimTask(order.id, 'CHECKOUT')).toBe(true);
    expect(orderSM.claimTask(order.id, 'CHECKOUT', 'player')).toBe(true);
    expect(orderSM.completeTask(order.id, 'CHECKOUT', 'player')).toBe(true);
    expect(order.state).toBe('COMPLETED');
    // 检查账本与金币
    expect(ledger.getBalance()).toBe(prevGold + espresso.price);
    // 检查配方熟练度计数 +1
    expect(saveManager.getState().recipeMastery[espresso.id]).toBe(1);
  });

  it('2. 非法迁移拒绝：未接单不能直接制作，未制作不能上菜，未上菜不能收银', () => {
    const order = orderSM.createOrder('cust_2', 'table_2', latte);
    expect(orderSM.canClaimTask(order.id, 'BREW')).toBe(false);
    expect(orderSM.claimTask(order.id, 'BREW', 'player')).toBe(false);

    expect(orderSM.canClaimTask(order.id, 'SERVE')).toBe(false);
    expect(orderSM.claimTask(order.id, 'SERVE', 'player')).toBe(false);

    expect(orderSM.canClaimTask(order.id, 'CHECKOUT')).toBe(false);
    expect(orderSM.claimTask(order.id, 'CHECKOUT', 'player')).toBe(false);
  });

  it('3. 任务锁定与竞态：已领取的任务不可被重复领取，不可换手', () => {
    const order = orderSM.createOrder('cust_3', 'table_3', espresso);
    expect(orderSM.claimTask(order.id, 'TAKE_ORDER', 'player')).toBe(true);

    // 再次领取被拒绝
    expect(orderSM.claimTask(order.id, 'TAKE_ORDER', 'staff_1')).toBe(false);

    // 非持有者完成任务被拒绝
    expect(orderSM.completeTask(order.id, 'TAKE_ORDER', 'staff_1')).toBe(false);

    // 持有者完成成功
    expect(orderSM.completeTask(order.id, 'TAKE_ORDER', 'player')).toBe(true);
  });

  it('4. 任务释放接口：已领取但未开始可释放，已开始不可释放', () => {
    const order = orderSM.createOrder('cust_4', 'table_4', espresso);
    orderSM.claimTask(order.id, 'TAKE_ORDER', 'player');
    orderSM.completeTask(order.id, 'TAKE_ORDER', 'player');

    // 领取 BREW 任务
    expect(orderSM.claimTask(order.id, 'BREW', 'player')).toBe(true);

    // 未开始前允许释放（M5 场景切换任务锁）
    expect(orderSM.releaseTask(order.id, 'BREW', 'player')).toBe(true);
    expect(order.activeTaskLock).toBeNull();

    // 重新领取并开始
    expect(orderSM.claimTask(order.id, 'BREW', 'player')).toBe(true);
    expect(orderSM.startTask(order.id, 'BREW', 'player')).toBe(true);

    // 已开始执行的任务禁止释放
    expect(orderSM.releaseTask(order.id, 'BREW', 'player')).toBe(false);
  });

  it('5. 原料守恒与放弃分支：未出杯全额返还，已出杯不返还', () => {
    const order1 = orderSM.createOrder('cust_5', 'table_1', latte); // coffee_beans: 1, milk: 1
    const beforeAvailBeans = inventory.getAvailable('coffee_beans');
    const beforeAvailMilk = inventory.getAvailable('milk');

    orderSM.claimTask(order1.id, 'TAKE_ORDER', 'player');
    orderSM.completeTask(order1.id, 'TAKE_ORDER', 'player');
    expect(inventory.getAvailable('coffee_beans')).toBe(beforeAvailBeans - 1);
    expect(inventory.getAvailable('milk')).toBe(beforeAvailMilk - 1);

    // 分支 A：制作前放弃 -> 原料全额返还
    orderSM.abandonOrder(order1.id, 'customer_left');
    expect(inventory.getAvailable('coffee_beans')).toBe(beforeAvailBeans);
    expect(inventory.getAvailable('milk')).toBe(beforeAvailMilk);
    expect(inventory.getReserved('coffee_beans')).toBe(0);

    // 分支 B：已出杯待上菜阶段放弃 -> 原料已被消耗，不返还
    const order2 = orderSM.createOrder('cust_6', 'table_2', latte);
    orderSM.claimTask(order2.id, 'TAKE_ORDER', 'player');
    orderSM.completeTask(order2.id, 'TAKE_ORDER', 'player');
    orderSM.claimTask(order2.id, 'BREW', 'player');
    orderSM.startTask(order2.id, 'BREW', 'player');
    orderSM.tickBrewing(latte.brewTimeSeconds + 0.1);
    expect(order2.state).toBe('WAITING_TO_SERVE');

    const totalBeansBeforeAbandon = inventory.getStock('coffee_beans');
    orderSM.abandonOrder(order2.id, 'patience_timeout');
    expect(order2.state).toBe('ABANDONED');
    // 出杯后报废，库存减少且预占清空
    expect(inventory.getStock('coffee_beans')).toBe(totalBeansBeforeAbandon - 1);
    expect(inventory.getReserved('coffee_beans')).toBe(0);
  });

  it('6. 缺货改点行为序列：缺货温和反馈并改点备选，全缺货平静离开', () => {
    // 构造库存：仅有茶叶，没有咖啡豆
    const lowInv = new InventoryManager({
      coffee_beans: 0,
      milk: 0,
      tea_leaves: 5,
      syrup: 0,
      baking_flour: 0,
      fruits: 0
    });
    const lowCustomerMgr = new CustomerManager(
      new NavGraph(),
      lowInv,
      new OrderStateMachine(lowInv, ledger, saveManager)
    );

    const cust = lowCustomerMgr.spawnCustomer()!;
    // 解锁了 espresso 和 jasmine_tea
    const unlocked = ['espresso', 'jasmine_tea'];

    // 顾客选品，优先选浓缩咖啡但缺货，自动改点有货的茉莉清茶
    lowCustomerMgr.decideRecipe(cust, unlocked, 'espresso');
    expect(cust.chosenRecipe?.id).toBe('jasmine_tea');
    expect(cust.bubbleText).toContain('卖完');

    // 构造全缺货情况
    const zeroInv = new InventoryManager({
      coffee_beans: 0,
      milk: 0,
      tea_leaves: 0,
      syrup: 0,
      baking_flour: 0,
      fruits: 0
    });
    const zeroCustomerMgr = new CustomerManager(
      new NavGraph(),
      zeroInv,
      new OrderStateMachine(zeroInv, ledger, saveManager)
    );
    const custZero = zeroCustomerMgr.spawnCustomer()!;
    zeroCustomerMgr.decideRecipe(custZero, ['espresso', 'jasmine_tea']);
    expect(custZero.allOutOfStockCount).toBe(1);
    expect(custZero.bubbleText).toContain('改天再来');
  });

  it('7. 应急原料包裹触发条件：金币充足不可领，金币不足且无原料可做时免费领取', () => {
    const unlockedDefs: readonly RecipeDef[] = [espresso, jasmineTea];

    // 情况 A：金币充足 (100 >= 20) -> 不可领
    expect(inventory.isEmergencyEligible(100, unlockedDefs)).toBe(false);
    expect(inventory.claimEmergencyPackage(100, unlockedDefs)).toBe(false);

    // 情况 B：金币不足 (10 < 20) 但原料还够做 espresso -> 不可领（仍可继续经营赚钱）
    expect(inventory.isEmergencyEligible(10, unlockedDefs)).toBe(false);

    // 情况 C：金币不足 (10 < 20) 且原料全部耗尽 -> 激活应急包裹（无死局）
    const emptyInv = new InventoryManager({
      coffee_beans: 0,
      milk: 0,
      tea_leaves: 0,
      syrup: 0,
      baking_flour: 0,
      fruits: 0
    });
    expect(emptyInv.isEmergencyEligible(10, unlockedDefs)).toBe(true);

    const claimed = emptyInv.claimEmergencyPackage(10, unlockedDefs);
    expect(claimed).toBe(true);
    expect(emptyInv.getStock('coffee_beans')).toBe(EMERGENCY_PACKAGE_CONFIG.ITEMS.coffee_beans);
    expect(emptyInv.getStock('milk')).toBe(EMERGENCY_PACKAGE_CONFIG.ITEMS.milk);
    expect(emptyInv.getStock('tea_leaves')).toBe(EMERGENCY_PACKAGE_CONFIG.ITEMS.tea_leaves);
  });

  it('8. 经济账本收支全程记录与明细完整性', () => {
    expect(ledger.getHistory().length).toBe(0);

    // 进货支出
    const purchaseTx = ledger.settleSupplyPurchase('咖啡豆', 10, 30);
    expect(purchaseTx.type).toBe('supply_purchase');
    expect(purchaseTx.netChange).toBe(-30);
    expect(ledger.getBalance()).toBe(70);

    // 订单收入
    const orderTx = ledger.settleOrder('意式浓缩', 15);
    expect(orderTx.type).toBe('order_income');
    expect(orderTx.grossAmount).toBe(15);
    expect(orderTx.staffCut).toBe(0);
    expect(orderTx.loanRepayment).toBe(0);
    expect(orderTx.netChange).toBe(15);
    expect(ledger.getBalance()).toBe(85);

    // 历史明细一致
    expect(ledger.getHistory().length).toBe(2);
  });
});
