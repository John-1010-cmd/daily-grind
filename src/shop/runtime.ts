import { ShopId, ShopSceneDefinition } from '../config';
import { CustomerManager } from '../customer';
import { DecorManager } from '../decor';
import { EconomyLedger } from '../economy';
import { InventoryManager } from '../inventory';
import { OrderStateMachine } from '../order';
import { SaveManager } from '../save';
import { NavGraph } from '../scene/nav';

export interface ShopRuntime {
  id: ShopId;
  scene: ShopSceneDefinition;
  navGraph: NavGraph;
  orderStateMachine: OrderStateMachine;
  customerManager: CustomerManager;
  decorManager: DecorManager;
}

/**
 * 现场经营适配器：两店各自保存顾客/订单队列，但共享同一库存、账本与存档。
 * M5 后台纯逻辑推进也以同一店铺 id 接入，渲染层不拥有经营规则。
 */
export function createShopRuntime(
  scene: ShopSceneDefinition,
  inventory: InventoryManager,
  ledger: EconomyLedger,
  saveManager: SaveManager
): ShopRuntime {
  const navGraph = new NavGraph(
    scene.navWaypoints,
    scene.navEdges,
    scene.walkableZones,
    scene.collisionFootprints
  );
  const orderStateMachine = new OrderStateMachine(inventory, ledger, saveManager);
  const customerManager = new CustomerManager(navGraph, inventory, orderStateMachine, {
    tableSeats: scene.tableSeats,
    queueSpots: scene.queueSpots,
    spawnPos: scene.customerSpawn,
    exitPos: scene.customerExit
  });

  return {
    id: scene.id,
    scene,
    navGraph,
    orderStateMachine,
    customerManager,
    decorManager: new DecorManager(saveManager, scene.id)
  };
}
