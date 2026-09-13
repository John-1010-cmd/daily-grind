import { describe, expect, it } from 'vitest';
import { CUSTOMER_QUEUE_SPOTS, MAIN_2P5D_TABLE_SEATS } from '../src/config';
import { CustomerManager } from '../src/customer';
import { EconomyLedger } from '../src/economy';
import { InventoryManager } from '../src/inventory';
import { OrderStateMachine } from '../src/order';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import { NavGraph } from '../src/scene/nav';

function setupQueue() {
  const save = new SaveManager(new MemoryStorageAdapter());
  const inventory = new InventoryManager(save.getState().inventory);
  const ledger = new EconomyLedger(save);
  const orders = new OrderStateMachine(inventory, ledger, save);
  return new CustomerManager(new NavGraph(), inventory, orders, {
    tableSeats: [MAIN_2P5D_TABLE_SEATS[0]],
    queueSpots: CUSTOMER_QUEUE_SPOTS,
    spawnPos: { x: 150, y: 625 },
    exitPos: { x: 128, y: 650 }
  });
}

describe('M6 满座顾客队列', () => {
  it('座位满时顾客会在吧台附近排队，不会凭空消失', () => {
    const customers = setupQueue();
    const seated = customers.spawnCustomer()!;
    const queued = customers.spawnCustomer()!;

    expect(seated.state).toBe('ENTERING');
    expect(queued.state).toBe('WAITING_FOR_SEAT');
    expect(queued.seat.tableId).toBe('waiting_queue');
    expect(queued.seat.seatPos.x).toBeGreaterThanOrEqual(1000);
  });

  it('座位释放后按队列顺序自动前往餐桌', () => {
    const customers = setupQueue();
    const seated = customers.spawnCustomer()!;
    const queued = customers.spawnCustomer()!;
    seated.state = 'LEFT';
    queued.walkPath = [];

    customers.update(0.016, ['espresso']);

    expect(queued.state).toBe('ENTERING');
    expect(queued.seat.tableId).toBe('table_1');
  });
});
