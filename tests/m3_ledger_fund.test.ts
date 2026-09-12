import { describe, expect, it } from 'vitest';
import { EMERGENCY_PACKAGE_CONFIG, RECIPE_DEFS, STAFF_CONFIG } from '../src/config';
import { EconomyLedger } from '../src/economy';
import { DreamFundManager, FundMetrics } from '../src/fund';
import { InventoryManager } from '../src/inventory';
import { MemoryStorageAdapter, SaveManager } from '../src/save';

function setup() {
  const saveManager = new SaveManager(new MemoryStorageAdapter());
  const ledger = new EconomyLedger(saveManager);
  const fund = new DreamFundManager(saveManager);
  return { saveManager, ledger, fund };
}

const TIER0_METRICS: FundMetrics = { completedOrders: 0, totalRevenue: 0, storiesUnlocked: 0 };

describe('M3 账本结算顺序与梦想基金 (T3.6 / T3.9)', () => {
  it('订单结算顺序：营业额 → 店员抽成 → 基金还款 → 玩家净入账', () => {
    const { saveManager, ledger, fund } = setup();
    // 有一笔 100 的未清偿基金 + 店员在岗（工资 10%）
    fund.apply(100, TIER0_METRICS);
    saveManager.updateState((d) => {
      d.staff.hired = true;
    });
    ledger.setHooks({
      getStaffCut: (gross) => Math.round(gross * STAFF_CONFIG.WAGE_RATE),
      repayFund: (gross) => fund.repayFromIncome(gross)
    });

    const before = ledger.getBalance();
    const tx = ledger.settleOrder('拿铁', 100);

    expect(tx.grossAmount).toBe(100);
    expect(tx.staffCut).toBe(10);
    expect(tx.loanRepayment).toBe(10);
    expect(tx.netChange).toBe(80);
    expect(ledger.getBalance()).toBe(before + 80);
    expect(fund.getLoans()[0].repaid).toBe(10);
  });

  it('多笔基金按申请先后逐笔清偿', () => {
    const { fund } = setup();
    fund.apply(100, TIER0_METRICS);
    fund.apply(100, TIER0_METRICS);

    // 还款罐存 100：应全部清偿第一笔
    fund.repayFromIncome(1000);
    let loans = fund.getLoans();
    expect(loans[0].repaid).toBe(100);
    expect(loans[1].repaid).toBe(0);

    // 再存 100：清偿第二笔
    fund.repayFromIncome(1000);
    loans = fund.getLoans();
    expect(loans[1].repaid).toBe(100);
    expect(fund.getOutstanding()).toBe(0);
  });

  it('部分清偿时仍先还先申请的', () => {
    const { fund } = setup();
    fund.apply(100, TIER0_METRICS);
    fund.apply(100, TIER0_METRICS);

    fund.repayFromIncome(600); // 罐存 60
    const loans = fund.getLoans();
    expect(loans[0].repaid).toBe(60);
    expect(loans[1].repaid).toBe(0);
  });

  it('总额度上限：超过阶段额度拒绝，清偿后释放额度可再申请', () => {
    const { fund } = setup();
    // tier_0 额度 200
    expect(fund.getCap(TIER0_METRICS)).toBe(200);

    expect(fund.apply(200, TIER0_METRICS).ok).toBe(true);
    const rejected = fund.apply(100, TIER0_METRICS);
    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toContain('额度');

    // 还清后释放额度
    fund.repayFromIncome(2000);
    expect(fund.getOutstanding()).toBe(0);
    expect(fund.apply(100, TIER0_METRICS).ok).toBe(true);
  });

  it('基金消费不抬高额度：花掉基金后阶段额度不变（防阶梯套现）', () => {
    const { saveManager, ledger, fund } = setup();
    fund.apply(200, TIER0_METRICS);
    ledger.disburseFund(200);

    // 把基金花在配方解锁上
    ledger.settleRecipeUnlock('美式咖啡', 50);

    // 经营指标未被消费抬高，额度仍是 tier_0 的 200，且未清偿 200 → 不能再申请
    const metrics: FundMetrics = {
      completedOrders: saveManager.getState().stats.completedOrders,
      totalRevenue: saveManager.getState().stats.totalRevenue,
      storiesUnlocked: 0
    };
    expect(fund.getCap(metrics)).toBe(200);
    expect(fund.canApply(100, metrics).ok).toBe(false);

    // 通过真实营业收入还清后才能再申请
    fund.repayFromIncome(2000);
    expect(fund.canApply(100, metrics).ok).toBe(true);
  });

  it('应急原料包裹：基金有额度时不可领，额度用尽且金币不足时可领', () => {
    const inventory = new InventoryManager({
      coffee_beans: 0, milk: 0, tea_leaves: 0, syrup: 0, baking_flour: 0, fruits: 0
    });
    const unlocked = RECIPE_DEFS.filter((r) => r.id === 'espresso');
    const lowGold = EMERGENCY_PACKAGE_CONFIG.MIN_TRIGGER_GOLD - 1;

    // 基金还有额度 → 不可领（应先去申请基金）
    expect(inventory.isEmergencyEligible(lowGold, unlocked, true)).toBe(false);
    // 基金额度已用尽 → 可领
    expect(inventory.isEmergencyEligible(lowGold, unlocked, false)).toBe(true);

    const claimed = inventory.claimEmergencyPackage(lowGold, unlocked, false);
    expect(claimed).toBe(true);
    expect(inventory.getStock('coffee_beans')).toBe(EMERGENCY_PACKAGE_CONFIG.ITEMS.coffee_beans);
  });

  it('自动补货支出独立成交易', () => {
    const { ledger } = setup();
    ledger.settleOrder('拿铁', 50);
    ledger.settleSupplyPurchase('优质咖啡豆', 10, 30);

    const history = ledger.getHistory();
    expect(history[0].type).toBe('order_income');
    expect(history[1].type).toBe('supply_purchase');
    expect(history[1].netChange).toBe(-30);
  });

  it('余额永不为负：超支交易后余额钳制为 0', () => {
    const { saveManager, ledger } = setup();
    saveManager.setGold(10);
    const tx = ledger.settleSupplyPurchase('鲜牛奶', 50, 999);
    expect(tx.balanceAfter).toBe(0);
    expect(ledger.getBalance()).toBe(0);
  });

  it('店员抽成永不让余额为负（工资只从收入中抽）', () => {
    const { saveManager, ledger, fund } = setup();
    saveManager.updateState((d) => {
      d.staff.hired = true;
    });
    fund.apply(200, TIER0_METRICS);
    ledger.setHooks({
      getStaffCut: (gross) => Math.round(gross * STAFF_CONFIG.WAGE_RATE),
      repayFund: (gross) => fund.repayFromIncome(gross)
    });

    saveManager.setGold(0);
    const tx = ledger.settleOrder('意式浓缩', 15);
    expect(tx.netChange).toBeGreaterThanOrEqual(0);
    expect(ledger.getBalance()).toBeGreaterThanOrEqual(0);
  });
});
