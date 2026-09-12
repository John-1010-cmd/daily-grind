import { describe, expect, it } from 'vitest';
import { EMERGENCY_PACKAGE_CONFIG, RECIPE_DEFS } from '../src/config';
import { EconomyLedger } from '../src/economy';
import { DreamFundManager } from '../src/fund';
import { InventoryManager } from '../src/inventory';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import { FundModal } from '../src/ui/fundModal';
import { ToastManager } from '../src/ui/toast';

describe('M6 三条红线与温柔化呈现（T6.2）', () => {
  it('花光金币与原料后仍可领取包裹继续经营，没有失败态', () => {
    const inventory = new InventoryManager({
      coffee_beans: 0,
      milk: 0,
      tea_leaves: 0,
      syrup: 0,
      baking_flour: 0,
      fruits: 0
    });
    const recipes = RECIPE_DEFS.filter((recipe) => recipe.id === 'espresso');

    expect(inventory.claimEmergencyPackage(0, recipes, false)).toBe(true);
    expect(inventory.getStock('coffee_beans')).toBe(EMERGENCY_PACKAGE_CONFIG.ITEMS.coffee_beans);
    expect(inventory.canFulfill(recipes[0].ingredients)).toBe(true);
  });

  it('梦想基金面板明确零息无期限，玩家可见文本不出现高压金融措辞', () => {
    const root = document.createElement('div');
    const save = new SaveManager(new MemoryStorageAdapter());
    const ledger = new EconomyLedger(save);
    const fund = new DreamFundManager(save);
    const toast = new ToastManager(root);
    const modal = new FundModal(
      root,
      save,
      ledger,
      fund,
      () => ({ completedOrders: 0, totalRevenue: 0, storiesUnlocked: 0 }),
      toast
    );

    modal.open();
    expect(root.textContent).toContain('没有利息、没有期限');
    expect(root.textContent).not.toContain('贷' + '款');
    expect(root.textContent).not.toContain('逾期');
    expect(root.textContent).not.toContain('催收');
  });

  it('基金多笔共存并按先后清偿，消费本身不会抬高额度', () => {
    const save = new SaveManager(new MemoryStorageAdapter());
    const ledger = new EconomyLedger(save);
    const fund = new DreamFundManager(save);
    const metrics = { completedOrders: 0, totalRevenue: 0, storiesUnlocked: 0 };
    fund.apply(100, metrics);
    fund.apply(100, metrics);
    ledger.disburseFund(200);
    ledger.settleRecipeUnlock('美式咖啡', 50);

    expect(fund.getCap(metrics)).toBe(200);
    expect(fund.canApply(100, metrics).ok).toBe(false);
    fund.repayFromIncome(1_000);
    expect(fund.getLoans()[0].repaid).toBe(100);
    expect(fund.getLoans()[1].repaid).toBe(0);
  });
});
