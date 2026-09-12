import { SaveManager } from '../save';

export type TransactionType = 'order_income' | 'supply_purchase' | 'recipe_unlock';

export interface TransactionDetail {
  id: string;
  type: TransactionType;
  grossAmount: number;
  staffCut: number;       // M1 为 0，M3 接入店员抽成
  loanRepayment: number;  // M1 为 0，M3 接入梦想基金还款
  netChange: number;      // 正数为净收入，负数为净支出
  balanceAfter: number;
  description: string;
  timestamp: number;
}

export class EconomyLedger {
  private saveManager: SaveManager;
  private history: TransactionDetail[] = [];
  private nextTxId = 1;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
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
    description: string
  ): TransactionDetail {
    const currentGold = this.getBalance();
    const newBalance = Math.max(0, currentGold + netChange);

    const tx: TransactionDetail = {
      id: `tx_${Date.now()}_${this.nextTxId++}`,
      type,
      grossAmount,
      staffCut: 0,
      loanRepayment: 0,
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
   * Settle an order payment. In M1: pure gross revenue into player account.
   */
  public settleOrder(recipeName: string, price: number): TransactionDetail {
    return this.createTx(
      'order_income',
      price,
      price,
      `售出饮品【${recipeName}】`
    );
  }

  /**
   * Settle supply purchase expense.
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
}
