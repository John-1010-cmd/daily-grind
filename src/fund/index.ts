import { FUND_CONFIG, FundTierDef } from '../config';
import { SaveManager } from '../save';
import { FundLoanState } from '../save/schema';

/**
 * 梦想基金的额度指标：全部为不可购买的经营指标（第 0 节），
 * 用基金消费不会抬高其中任何一项，杜绝阶梯式套现。
 */
export interface FundMetrics {
  completedOrders: number;
  totalRevenue: number;
  storiesUnlocked: number;
}

export interface FundApplyResult {
  ok: boolean;
  reason?: string;
  loan?: FundLoanState;
}

export class DreamFundManager {
  private saveManager: SaveManager;
  private nextLoanId = 1;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  public getLoans(): readonly FundLoanState[] {
    return this.saveManager.getState().fund.loans;
  }

  public getOutstanding(): number {
    return this.getLoans().reduce((sum, l) => sum + (l.amount - l.repaid), 0);
  }

  public getTotalRepaid(): number {
    return this.getLoans().reduce((sum, l) => sum + l.repaid, 0);
  }

  /** 当前阶段：满足全部门槛的最高档 */
  public getCurrentTier(metrics: FundMetrics): FundTierDef {
    let current = FUND_CONFIG.TIERS[0];
    for (const tier of FUND_CONFIG.TIERS) {
      if (
        metrics.completedOrders >= tier.minOrders &&
        metrics.totalRevenue >= tier.minRevenue &&
        metrics.storiesUnlocked >= tier.minStories
      ) {
        current = tier;
      }
    }
    return current;
  }

  public getCap(metrics: FundMetrics): number {
    return this.getCurrentTier(metrics).cap;
  }

  /** 未清偿合计 + 申请额不得超过当前阶段额度 */
  public canApply(amount: number, metrics: FundMetrics): { ok: boolean; reason?: string } {
    if (amount <= 0) {
      return { ok: false, reason: '申请金额必须大于 0' };
    }
    const cap = this.getCap(metrics);
    const outstanding = this.getOutstanding();
    if (outstanding + amount > cap) {
      return {
        ok: false,
        reason: `前辈的小金库目前最多还能支持 🪙${Math.max(0, cap - outstanding)}（当前阶段额度 ${cap}），先慢慢还一些吧`
      };
    }
    return { ok: true };
  }

  /**
   * 申请一笔基金：零息、无期限、允许多笔共存。
   * 成功时把金额交给调用方入账（账本 tx）。
   */
  public apply(amount: number, metrics: FundMetrics): FundApplyResult {
    const check = this.canApply(amount, metrics);
    if (!check.ok) {
      return { ok: false, reason: check.reason };
    }
    const loan: FundLoanState = {
      id: `loan_${Date.now()}_${this.nextLoanId++}`,
      amount,
      repaid: 0,
      appliedAt: Date.now()
    };
    this.saveManager.updateState((draft) => {
      draft.fund.loans.push(loan);
      draft.fund.totalBorrowed += amount;
    });
    return { ok: true, loan };
  }

  /**
   * 还款罐：从一笔营业收入中自动存 10%，按申请先后逐笔清偿。
   * 返回本笔实际存入还款罐的金额（可能为 0）。
   */
  public repayFromIncome(grossIncome: number): number {
    const outstanding = this.getOutstanding();
    if (outstanding <= 0 || grossIncome <= 0) {
      return 0;
    }
    let jar = Math.min(Math.round(grossIncome * FUND_CONFIG.REPAYMENT_RATE), outstanding);
    if (jar <= 0) {
      // 收入很小时至少存 1 金币（向上取整的温柔版）
      jar = Math.min(1, outstanding);
    }

    this.saveManager.updateState((draft) => {
      let remaining = jar;
      for (const loan of draft.fund.loans) {
        if (remaining <= 0) break;
        const due = loan.amount - loan.repaid;
        if (due <= 0) continue;
        const pay = Math.min(due, remaining);
        loan.repaid += pay;
        remaining -= pay;
      }
    });
    return jar;
  }

  /** 基金是否还有可申请额度（应急包裹条件：基金不可用或额度已用尽） */
  public hasAvailableCapacity(metrics: FundMetrics): boolean {
    const minAmount = FUND_CONFIG.APPLY_AMOUNTS[0];
    return this.canApply(minAmount, metrics).ok;
  }

  /** 多笔合计还款进度 0-1（装修面板顶部小进度条） */
  public getOverallProgress(): number {
    const total = this.getLoans().reduce((sum, l) => sum + l.amount, 0);
    if (total <= 0) return 1;
    return this.getTotalRepaid() / total;
  }
}
