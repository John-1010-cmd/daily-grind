import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_CONFIG,
  SESSION_RELEASE_CONDITIONS
} from '../src/config';
import { CustomerManager } from '../src/customer';
import { EconomyLedger } from '../src/economy';
import { InventoryManager } from '../src/inventory';
import { OrderStateMachine } from '../src/order';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import { NavGraph } from '../src/scene/nav';

describe('T1.8 15分钟单次会话循环仿真与放行条件验证', () => {
  it('仿真 15 分钟经营：完成单量 ≥ 8、攒够解锁茶饮第一款、平均等待 ≤ 60s、空闲时间 ≤ 40%', () => {
    const memory = new MemoryStorageAdapter();
    const saveManager = new SaveManager(memory);
    // Initial inventory ample for a 15-minute run
    const inventory = new InventoryManager({
      coffee_beans: 40,
      milk: 30,
      tea_leaves: 20,
      syrup: 15,
      baking_flour: 15,
      fruits: 10
    });
    const ledger = new EconomyLedger(saveManager);
    const orderSM = new OrderStateMachine(inventory, ledger, saveManager);
    const nav = new NavGraph();
    const customerMgr = new CustomerManager(nav, inventory, orderSM);

    const SESSION_DURATION_SECONDS = 15 * 60; // 900s
    const DT = 0.5; // step in half-seconds

    let totalOrdersCompleted = 0;
    let totalCustomerWaitTime = 0;
    let customersServedCount = 0;
    let busyTimeSeconds = 0;
    let idleTimeSeconds = 0;

    const customerOrderPlacedTime = new Map<string, number>();

    // Initial state
    const unlockedIds = ['espresso', 'americano'];

    for (let simTime = 0; simTime < SESSION_DURATION_SECONDS; simTime += DT) {
      // 1. Advance customer system
      customerMgr.update(DT, unlockedIds);

      // 2. Advance brewing
      orderSM.tickBrewing(DT);

      // Check barista actions
      let baristaActionThisTick = false;

      // A. Checkout customers waiting to pay
      const waitingPayCust = customerMgr
        .getCustomers()
        .find((c) => c.state === 'WAITING_TO_PAY');
      if (waitingPayCust && waitingPayCust.orderId) {
        if (orderSM.canClaimTask(waitingPayCust.orderId, 'CHECKOUT')) {
          orderSM.claimTask(waitingPayCust.orderId, 'CHECKOUT', 'player');
          orderSM.completeTask(waitingPayCust.orderId, 'CHECKOUT', 'player');
          waitingPayCust.state = 'LEAVING';
          totalOrdersCompleted++;
          baristaActionThisTick = true;
        }
      }

      // B. Serve drinks ready to serve
      const readyToServeOrder = orderSM.getWaitingToServeOrders()[0];
      if (readyToServeOrder && !baristaActionThisTick) {
        const targetCust = customerMgr.getCustomerById(readyToServeOrder.customerId);
        if (targetCust && targetCust.state === 'WAITING_FOR_DRINK') {
          if (orderSM.canClaimTask(readyToServeOrder.id, 'SERVE')) {
            orderSM.claimTask(readyToServeOrder.id, 'SERVE', 'player');
            orderSM.completeTask(readyToServeOrder.id, 'SERVE', 'player');
            targetCust.state = 'ENJOYING_DRINK';
            targetCust.enjoyRemaining = CUSTOMER_CONFIG.EAT_DURATION_SECONDS;

            // Record wait time from order placed to served
            const placedAt = customerOrderPlacedTime.get(readyToServeOrder.id) ?? simTime;
            totalCustomerWaitTime += simTime - placedAt;
            customersServedCount++;
            baristaActionThisTick = true;
          }
        }
      }

      // C. Start brewing orders waiting to brew
      const waitingBrew = orderSM.getWaitingToBrewOrders()[0];
      if (waitingBrew && !baristaActionThisTick && orderSM.getBrewingOrders().length === 0) {
        if (orderSM.canClaimTask(waitingBrew.id, 'BREW')) {
          orderSM.claimTask(waitingBrew.id, 'BREW', 'player');
          orderSM.startTask(waitingBrew.id, 'BREW', 'player');
          baristaActionThisTick = true;
        }
      }

      // D. Take orders from customers waiting to order
      const waitingOrderCust = customerMgr
        .getCustomers()
        .find((c) => c.state === 'WAITING_FOR_ORDER');
      if (waitingOrderCust && waitingOrderCust.orderId && !baristaActionThisTick) {
        if (orderSM.canClaimTask(waitingOrderCust.orderId, 'TAKE_ORDER')) {
          orderSM.claimTask(waitingOrderCust.orderId, 'TAKE_ORDER', 'player');
          orderSM.completeTask(waitingOrderCust.orderId, 'TAKE_ORDER', 'player');
          waitingOrderCust.state = 'WAITING_FOR_DRINK';
          customerOrderPlacedTime.set(waitingOrderCust.orderId, simTime);
          baristaActionThisTick = true;
        }
      }

      // 空闲判定：店内既无顾客在座/在途，也无任何待处理订单（真正无事可做的时间）
      const hasActiveCustomerOrOrder =
        customerMgr.getCustomers().some((c) => c.state !== 'LEFT') ||
        orderSM.getActiveOrders().length > 0;

      if (hasActiveCustomerOrOrder) {
        busyTimeSeconds += DT;
      } else {
        idleTimeSeconds += DT;
      }
    }

    const idleRatio = idleTimeSeconds / SESSION_DURATION_SECONDS;
    const avgWaitSeconds =
      customersServedCount > 0 ? totalCustomerWaitTime / customersServedCount : 0;
    const currentGold = ledger.getBalance();

    console.log('--- 15分钟会话仿真数据实测 ---');
    console.log(`完成订单数: ${totalOrdersCompleted} (目标: ≥${SESSION_RELEASE_CONDITIONS.TARGET_ORDERS_IN_15_MIN})`);
    console.log(`期末金币: ${currentGold} (目标: 攒够解锁茉莉清茶 🪙${SESSION_RELEASE_CONDITIONS.LINE2_FIRST_RECIPE_COST})`);
    console.log(`顾客平均等待时长: ${avgWaitSeconds.toFixed(1)}s (目标: ≤${SESSION_RELEASE_CONDITIONS.CUSTOMER_AVG_WAIT_SECONDS}s)`);
    console.log(`无事可做时间占比: ${(idleRatio * 100).toFixed(1)}% (目标: ≤${SESSION_RELEASE_CONDITIONS.MAX_IDLE_TIME_RATIO * 100}%)`);

    // 放行条件 1: 15 分钟 ≥ 8 单
    expect(totalOrdersCompleted).toBeGreaterThanOrEqual(
      SESSION_RELEASE_CONDITIONS.TARGET_ORDERS_IN_15_MIN
    );

    // 放行条件 2: 攒够解锁第二条配方线首款配方 (jasmine_tea: 80)
    expect(currentGold).toBeGreaterThanOrEqual(
      SESSION_RELEASE_CONDITIONS.LINE2_FIRST_RECIPE_COST
    );

    // 放行条件 3: 顾客平均等待 ≤ 60s
    expect(avgWaitSeconds).toBeLessThanOrEqual(
      SESSION_RELEASE_CONDITIONS.CUSTOMER_AVG_WAIT_SECONDS
    );

    // 放行条件 4: 空闲占比 ≤ 40%
    expect(idleRatio).toBeLessThanOrEqual(
      SESSION_RELEASE_CONDITIONS.MAX_IDLE_TIME_RATIO
    );
  });
});
