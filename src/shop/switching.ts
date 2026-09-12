import { SHOP_SIMULATION_CONFIG, ShopId } from '../config';
import { OrderStateMachine } from '../order';

export interface ShopSwitchCheck {
  ok: boolean;
  releasedTaskCount: number;
  reason?: string;
}

/**
 * 场景切换的任务锁边界：执行中先整体阻断；确认可切换后，才释放玩家已领取未开始任务。
 */
export function prepareShopSwitch(
  fromShopId: ShopId,
  toShopId: ShopId,
  orderStateMachine: OrderStateMachine,
  mainStaffHired: boolean
): ShopSwitchCheck {
  if (fromShopId === toShopId) return { ok: true, releasedTaskCount: 0 };
  if (fromShopId === 'main' && toShopId === 'seaside' && !mainStaffHired) {
    return {
      ok: false,
      releasedTaskCount: 0,
      reason: '先请一位店员照看本店，再安心去海边吧'
    };
  }

  const playerLocks = orderStateMachine.getActiveOrders()
    .map((order) => ({ order, lock: order.activeTaskLock }))
    .filter(({ lock }) => lock?.executorId === SHOP_SIMULATION_CONFIG.PLAYER_EXECUTOR_ID);
  if (playerLocks.some(({ lock }) => lock?.started)) {
    return {
      ok: false,
      releasedTaskCount: 0,
      reason: '手上的饮品正在制作中，完成这一步再出发会更从容'
    };
  }

  let releasedTaskCount = 0;
  for (const { order, lock } of playerLocks) {
    if (
      lock &&
      orderStateMachine.releaseTask(order.id, lock.taskType, SHOP_SIMULATION_CONFIG.PLAYER_EXECUTOR_ID)
    ) {
      releasedTaskCount += 1;
    }
  }
  return { ok: true, releasedTaskCount };
}
