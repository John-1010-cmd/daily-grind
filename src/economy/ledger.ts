import { SaveManager } from '../save';

export type TransactionType =
  | 'order_income'
  | 'supply_purchase'
  | 'recipe_unlock'
  | 'equipment_upgrade'
  | 'decor_purchase'
  | 'staff_hire'
  | 'fund_disbursement'
  | 'achievement_reward'
  | 'cat_gift'
  | 'branch_unlock'
  | 'world_idle_income';

export interface TransactionDetail {
  id: string;
  type: TransactionType;
  grossAmount: number;
  staffCut: number;
  loanRepayment: number;
  netChange: number;      // 正数为净收入，负数为净支出
  balanceAfter: number;
  description: string;
  timestamp: number;
}

/**
 * 订单收入挂钩（由 main 接线注入）：
 * - getStaffCut：店员持续工资抽成（无店员时为 0）
 * - repayFund：梦想基金还款罐抽存（无负债时为 0）
 * 结算顺序固定：营业额 → 店员抽成 → 基金还款 → 玩家净入账（第 7 节）
 */
export interface LedgerHooks {
  getStaffCut?: (grossAmount: number) => number;
  repayFund?: (grossAmount: number) => number;
}

export class EconomyLedger {
  private saveManager: SaveManager;
  private history: TransactionDetail[] = [];
  private nextTxId = 1;
  private hooks: LedgerHooks = {};

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  public setHooks(hooks: LedgerHooks): void {
    this.hooks = hooks;
  }

  public getBalance(): number {
    return this.saveManager.getState().gold;
  }

  public getHistory(): readonly TransactionDetail[] {
    return this.history;
  }

  private createTx(
    type: TransactionType,
    grossAmount: number,
    netChange: number,
    description: string,
    staffCut = 0,
    loanRepayment = 0
  ): TransactionDetail {
    const currentGold = this.getBalance();
    // 余额永不为负（红线 1）
    const newBalance = Math.max(0, currentGold + netChange);

    const tx: TransactionDetail = {
      id: `tx_${Date.now()}_${this.nextTxId++}`,
      type,
      grossAmount,
      staffCut,
      loanRepayment,
      netChange,
      balanceAfter: newBalance,
      description,
      timestamp: Date.now()
    };

    this.history.push(tx);
    this.saveManager.setGold(newBalance);
    return tx;
  }

  /**
   * 订单收银结算：营业额 → 店员抽成 → 梦想基金还款 → 玩家净入账。
   */
  public settleOrder(recipeName: string, price: number): TransactionDetail {
    const staffCut = this.hooks.getStaffCut ? this.hooks.getStaffCut(price) : 0;
    const loanRepayment = this.hooks.repayFund ? this.hooks.repayFund(price) : 0;
    const net = price - staffCut - loanRepayment;

    return this.createTx(
      'order_income',
      price,
      net,
      `售出饮品【${recipeName}】`,
      staffCut,
      loanRepayment
    );
  }

  /**
   * Settle supply purchase expense (manual or staff auto-supply, 各自独立成交易).
   */
  public settleSupplyPurchase(
    ingredientName: string,
    count: number,
    cost: number
  ): TransactionDetail {
    return this.createTx(
      'supply_purchase',
      cost,
      -cost,
      `进货【${ingredientName}】x${count}`
    );
  }

  /**
   * Settle recipe unlock expense.
   */
  public settleRecipeUnlock(recipeName: string, cost: number): TransactionDetail {
    return this.createTx(
      'recipe_unlock',
      cost,
      -cost,
      `解锁新配方【${recipeName}】`
    );
  }

  /** 设备升级支出 (T3.2) */
  public settleEquipmentUpgrade(label: string, cost: number): TransactionDetail {
    return this.createTx(
      'equipment_upgrade',
      cost,
      -cost,
      `升级设备【${label}】`
    );
  }

  /** 装修款式 / 主题购买支出 (T3.1) */
  public settleDecorPurchase(itemName: string, cost: number): TransactionDetail {
    return this.createTx(
      'decor_purchase',
      cost,
      -cost,
      `置办装修【${itemName}】`
    );
  }

  /** 店员一次性雇佣费 (T3.5) */
  public settleStaffHire(staffName: string, cost: number): TransactionDetail {
    return this.createTx(
      'staff_hire',
      cost,
      -cost,
      `雇佣店员【${staffName}】`
    );
  }

  /** 梦想基金入账（前辈的支持，无期限零息） */
  public disburseFund(amount: number): TransactionDetail {
    return this.createTx(
      'fund_disbursement',
      amount,
      amount,
      `前辈的支持款到账（存入钱箱）`
    );
  }

  /** 成就奖励金币 (T3.7) */
  public grantAchievementReward(achievementName: string, gold: number): TransactionDetail {
    return this.createTx(
      'achievement_reward',
      gold,
      gold,
      `达成成就【${achievementName}】`
    );
  }

  /** 现实时间每日首摸的小额礼物，仍经唯一账本入账。 */
  public grantCatGift(gold: number): TransactionDetail {
    return this.createTx('cat_gift', gold, gold, '橘猫从睡垫下拨出一枚小礼物');
  }

  public settleBranchUnlock(branchName: string, cost: number): TransactionDetail {
    return this.createTx('branch_unlock', cost, -cost, `为【${branchName}】备齐开店所需`);
  }

  public settleWorldIdleIncome(
    shopName: string,
    completedOrders: number,
    gross: number,
    applyStaffCut: boolean
  ): TransactionDetail {
    const staffCut = applyStaffCut && this.hooks.getStaffCut ? this.hooks.getStaffCut(gross) : 0;
    const loanRepayment = this.hooks.repayFund ? this.hooks.repayFund(gross) : 0;
    return this.createTx(
      'world_idle_income',
      gross,
      gross - staffCut - loanRepayment,
      `【${shopName}】挂机完成 ${completedOrders} 单`,
      staffCut,
      loanRepayment
    );
  }
}
