import { describe, expect, it } from 'vitest';
import { BRANCH_CONFIG, RECIPE_DEFS, SHOP_SCENES } from '../src/config';
import { AchievementManager } from '../src/achievements';
import { EconomyLedger } from '../src/economy';
import { InventoryManager } from '../src/inventory';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import { BranchManager, createShopRuntime } from '../src/shop';

describe('M5 分店现场经营与共享库存（T5.2）', () => {
  it('海风分店复用完整订单状态机，现场完成接单到收银', () => {
    const save = new SaveManager(new MemoryStorageAdapter());
    const inventory = new InventoryManager(save.getState().inventory);
    const ledger = new EconomyLedger(save);
    const seaside = createShopRuntime(SHOP_SCENES.seaside, inventory, ledger, save);
    const espresso = RECIPE_DEFS.find((recipe) => recipe.id === 'espresso')!;
    const order = seaside.orderStateMachine.createOrder('sea_customer', 'table_1', espresso);
    const beforeGold = ledger.getBalance();

    expect(seaside.orderStateMachine.claimTask(order.id, 'TAKE_ORDER', 'player')).toBe(true);
    expect(seaside.orderStateMachine.completeTask(order.id, 'TAKE_ORDER', 'player')).toBe(true);
    expect(seaside.orderStateMachine.claimTask(order.id, 'BREW', 'player')).toBe(true);
    expect(seaside.orderStateMachine.startTask(order.id, 'BREW', 'player')).toBe(true);
    seaside.orderStateMachine.tickBrewing(espresso.brewTimeSeconds + 1);
    expect(seaside.orderStateMachine.claimTask(order.id, 'SERVE', 'player')).toBe(true);
    expect(seaside.orderStateMachine.completeTask(order.id, 'SERVE', 'player')).toBe(true);
    expect(seaside.orderStateMachine.claimTask(order.id, 'CHECKOUT', 'player')).toBe(true);
    expect(seaside.orderStateMachine.completeTask(order.id, 'CHECKOUT', 'player')).toBe(true);

    expect(order.state).toBe('COMPLETED');
    expect(ledger.getBalance()).toBe(beforeGold + espresso.price);
  });

  it('两店共享一份库存，任一店预占与消耗都会被另一店立即看见', () => {
    const save = new SaveManager(new MemoryStorageAdapter());
    const inventory = new InventoryManager({ coffee_beans: 2 });
    const ledger = new EconomyLedger(save);
    const main = createShopRuntime(SHOP_SCENES.main, inventory, ledger, save);
    const seaside = createShopRuntime(SHOP_SCENES.seaside, inventory, ledger, save);
    const espresso = RECIPE_DEFS.find((recipe) => recipe.id === 'espresso')!;
    const mainOrder = main.orderStateMachine.createOrder('main_customer', 'table_1', espresso);
    const seasideOrder = seaside.orderStateMachine.createOrder('sea_customer', 'table_1', espresso);

    main.orderStateMachine.claimTask(mainOrder.id, 'TAKE_ORDER', 'player');
    main.orderStateMachine.completeTask(mainOrder.id, 'TAKE_ORDER', 'player');
    expect(inventory.getAvailable('coffee_beans')).toBe(1);

    seaside.orderStateMachine.claimTask(seasideOrder.id, 'TAKE_ORDER', 'player');
    seaside.orderStateMachine.completeTask(seasideOrder.id, 'TAKE_ORDER', 'player');
    expect(inventory.getAvailable('coffee_beans')).toBe(0);
    expect(inventory.getReserved('coffee_beans')).toBe(2);
  });

  it('分店顾客使用独立入口与桌位，装修存档不污染本店', () => {
    const save = new SaveManager(new MemoryStorageAdapter());
    const inventory = new InventoryManager(save.getState().inventory);
    const ledger = new EconomyLedger(save);
    const main = createShopRuntime(SHOP_SCENES.main, inventory, ledger, save);
    const seaside = createShopRuntime(SHOP_SCENES.seaside, inventory, ledger, save);
    const customer = seaside.customerManager.spawnCustomer();
    const paidVariant = seaside.decorManager.getSlots()[0].variants[1];

    expect(customer?.pos).toEqual(SHOP_SCENES.seaside.customerSpawn);
    expect(customer?.seat.id.startsWith('sea_')).toBe(true);
    save.setGold(paidVariant.cost);
    expect(seaside.decorManager.purchaseVariant(seaside.decorManager.getSlots()[0].id, paidVariant.id, ledger).ok).toBe(true);
    expect(seaside.decorManager.isVariantOwned(seaside.decorManager.getSlots()[0].id, paidVariant.id)).toBe(true);
    expect(main.decorManager.isVariantOwned(main.decorManager.getSlots()[0].id, paidVariant.id)).toBe(false);
    expect(save.getState().world.shops.seaside.decor.ownedVariants).toContain(paidVariant.id);
    expect(save.getState().decor.ownedVariants).not.toContain(paidVariant.id);
  });

  it('海风分店只检查明示的金币目标与前置成就，达成后一次解锁', () => {
    const save = new SaveManager(new MemoryStorageAdapter());
    const ledger = new EconomyLedger(save);
    const achievements = new AchievementManager(save, ledger);
    const branches = new BranchManager(save, ledger, achievements);

    save.setGold(BRANCH_CONFIG.SEASIDE_UNLOCK_COST);
    expect(branches.unlockSeaside()).toMatchObject({ ok: false });
    save.updateState((draft) => {
      draft.achievements.push(...BRANCH_CONFIG.SEASIDE_PREREQUISITE_ACHIEVEMENT_IDS);
    });

    expect(branches.getSeasideStatus()).toMatchObject({
      hasEnoughGold: true,
      prerequisitesMet: true,
      unlocked: false
    });
    expect(branches.unlockSeaside()).toEqual({ ok: true });
    expect(save.getState().world.shops.seaside.unlocked).toBe(true);
    expect(save.getState().gold).toBe(0);
    expect(ledger.getHistory().at(-1)?.type).toBe('branch_unlock');
    expect(branches.unlockSeaside().ok).toBe(false);
  });
});
