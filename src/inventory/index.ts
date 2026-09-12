import {
  EMERGENCY_PACKAGE_CONFIG,
  INGREDIENT_DEFS,
  INITIAL_INVENTORY,
  RecipeDef
} from '../config';

export class InventoryManager {
  private stock: Record<string, number> = {};
  private reserved: Record<string, number> = {};

  constructor(initialStock?: Record<string, number>) {
    this.initStock(initialStock);
  }

  private initStock(initialStock?: Record<string, number>): void {
    const base = initialStock && Object.keys(initialStock).length > 0
      ? initialStock
      : INITIAL_INVENTORY;

    this.stock = { ...base };
    this.reserved = {};
    for (const def of INGREDIENT_DEFS) {
      if (this.stock[def.id] === undefined) {
        this.stock[def.id] = 0;
      }
      this.reserved[def.id] = 0;
    }
  }

  public getStock(ingredientId: string): number {
    return this.stock[ingredientId] || 0;
  }

  public getReserved(ingredientId: string): number {
    return this.reserved[ingredientId] || 0;
  }

  public getAvailable(ingredientId: string): number {
    const total = this.stock[ingredientId] || 0;
    const res = this.reserved[ingredientId] || 0;
    return Math.max(0, total - res);
  }

  public getAllStock(): Record<string, number> {
    return { ...this.stock };
  }

  public getAllAvailable(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const def of INGREDIENT_DEFS) {
      result[def.id] = this.getAvailable(def.id);
    }
    return result;
  }

  /**
   * Check if the required ingredients can be satisfied from available stock.
   */
  public canFulfill(ingredients: Record<string, number>): boolean {
    for (const [id, needed] of Object.entries(ingredients)) {
      if (this.getAvailable(id) < needed) {
        return false;
      }
    }
    return true;
  }

  /**
   * Atomically reserve ingredients for an accepted order.
   */
  public reserve(ingredients: Record<string, number>): boolean {
    if (!this.canFulfill(ingredients)) {
      return false;
    }
    for (const [id, count] of Object.entries(ingredients)) {
      this.reserved[id] = (this.reserved[id] || 0) + count;
    }
    return true;
  }

  /**
   * Release reserved ingredients back to available stock (e.g. order cancelled before brewing).
   */
  public releaseReserved(ingredients: Record<string, number>): void {
    for (const [id, count] of Object.entries(ingredients)) {
      const current = this.reserved[id] || 0;
      this.reserved[id] = Math.max(0, current - count);
    }
  }

  /**
   * Permanently consume reserved ingredients when brewing/serving is completed.
   */
  public consumeReserved(ingredients: Record<string, number>): void {
    for (const [id, count] of Object.entries(ingredients)) {
      const currStock = this.stock[id] || 0;
      const currRes = this.reserved[id] || 0;
      this.stock[id] = Math.max(0, currStock - count);
      this.reserved[id] = Math.max(0, currRes - count);
    }
  }

  /**
   * Add ingredients to stock (e.g. purchasing supplies or receiving emergency package).
   */
  public addStock(ingredientId: string, count: number): void {
    if (count <= 0) return;
    this.stock[ingredientId] = (this.stock[ingredientId] || 0) + count;
  }

  /** 将可用库存对齐纯函数推进结果，同时保留现场订单的预占数量。 */
  public reconcileAvailableStock(targetAvailable: Record<string, number>): void {
    for (const def of INGREDIENT_DEFS) {
      const id = def.id;
      const currentAvailable = this.getAvailable(id);
      const target = Math.max(0, Math.floor(targetAvailable[id] ?? 0));
      const delta = target - currentAvailable;
      if (delta > 0) {
        this.stock[id] = (this.stock[id] ?? 0) + delta;
      } else if (delta < 0) {
        this.stock[id] = Math.max(this.reserved[id] ?? 0, (this.stock[id] ?? 0) + delta);
      }
    }
  }

  /**
   * Check if emergency package condition is met (第 6 节)：
   * 1. Player's gold is insufficient to buy supplies (less than minimum trigger gold).
   * 2. 梦想基金不可用或额度已用尽（M3 接入，fundHasCapacity 由基金模块给出）。
   * 3. Available stock cannot fulfill ANY unlocked recipe.
   */
  public isEmergencyEligible(
    gold: number,
    unlockedRecipes: readonly RecipeDef[],
    fundHasCapacity = false
  ): boolean {
    if (gold >= EMERGENCY_PACKAGE_CONFIG.MIN_TRIGGER_GOLD) {
      return false;
    }
    if (fundHasCapacity) {
      return false;
    }
    // Check if player can make at least one unlocked recipe
    for (const recipe of unlockedRecipes) {
      if (this.canFulfill(recipe.ingredients)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Claim emergency package if eligible.
   */
  public claimEmergencyPackage(
    gold: number,
    unlockedRecipes: readonly RecipeDef[],
    fundHasCapacity = false
  ): boolean {
    if (!this.isEmergencyEligible(gold, unlockedRecipes, fundHasCapacity)) {
      return false;
    }
    for (const [id, count] of Object.entries(EMERGENCY_PACKAGE_CONFIG.ITEMS)) {
      this.addStock(id, count);
    }
    return true;
  }
}
