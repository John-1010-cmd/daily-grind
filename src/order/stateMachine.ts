import { RecipeDef } from '../config';
import { EconomyLedger } from '../economy';
import { InventoryManager } from '../inventory';
import { SaveManager } from '../save';
import { Order, OrderTaskType } from './types';

export class OrderStateMachine {
  private orders: Map<string, Order> = new Map();
  private inventory: InventoryManager;
  private ledger: EconomyLedger;
  private saveManager: SaveManager;
  private nextOrderId = 1;

  /** 设备升级带来的制作加速系数 (T3.2)，由外部按装备等级设置 */
  public brewSpeedMultiplier = 1;

  constructor(
    inventory: InventoryManager,
    ledger: EconomyLedger,
    saveManager: SaveManager
  ) {
    this.inventory = inventory;
    this.ledger = ledger;
    this.saveManager = saveManager;
  }

  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  public getOrderByTable(tableId: string): Order | undefined {
    for (const order of this.orders.values()) {
      if (order.tableId === tableId && order.state !== 'COMPLETED' && order.state !== 'ABANDONED') {
        return order;
      }
    }
    return undefined;
  }

  public getActiveOrders(): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.state !== 'COMPLETED' && o.state !== 'ABANDONED'
    );
  }

  public getWaitingToBrewOrders(): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.state === 'WAITING_TO_BREW' && (!o.activeTaskLock || !o.activeTaskLock.started)
    );
  }

  public getBrewingOrders(): Order[] {
    return Array.from(this.orders.values()).filter((o) => o.state === 'BREWING');
  }

  public getWaitingToServeOrders(): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.state === 'WAITING_TO_SERVE' && (!o.activeTaskLock || !o.activeTaskLock.started)
    );
  }

  public getWaitingToPayOrders(): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.state === 'WAITING_TO_PAY' && (!o.activeTaskLock || !o.activeTaskLock.started)
    );
  }

  /**
   * Create a new order when customer decides to order.
   * Starts in WAITING_FOR_ORDER.
   */
  public createOrder(customerId: string, tableId: string, recipe: RecipeDef): Order {
    const order: Order = {
      id: `order_${Date.now()}_${this.nextOrderId++}`,
      customerId,
      tableId,
      recipe,
      state: 'WAITING_FOR_ORDER',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      brewProgress: 0,
      brewDurationSeconds: recipe.brewTimeSeconds * this.brewSpeedMultiplier,
      reservedIngredients: {},
      activeTaskLock: null
    };

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Check if a task can be claimed on an order.
   */
  public canClaimTask(orderId: string, taskType: OrderTaskType): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;
    if (order.activeTaskLock) return false;

    switch (taskType) {
      case 'TAKE_ORDER':
        return order.state === 'WAITING_FOR_ORDER';
      case 'BREW':
        return order.state === 'WAITING_TO_BREW';
      case 'SERVE':
        return order.state === 'WAITING_TO_SERVE';
      case 'CHECKOUT':
        return order.state === 'WAITING_TO_PAY';
      default:
        return false;
    }
  }

  /**
   * Claim and lock a task to an executor.
   */
  public claimTask(orderId: string, taskType: OrderTaskType, executorId: string): boolean {
    if (!this.canClaimTask(orderId, taskType)) {
      return false;
    }
    const order = this.orders.get(orderId)!;
    order.activeTaskLock = {
      taskType,
      executorId,
      claimedAt: Date.now(),
      started: false
    };
    order.updatedAt = Date.now();
    return true;
  }

  /**
   * Release a claimed task if it has NOT started yet.
   */
  public releaseTask(orderId: string, taskType: OrderTaskType, executorId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || !order.activeTaskLock) return false;

    if (
      order.activeTaskLock.taskType === taskType &&
      order.activeTaskLock.executorId === executorId &&
      !order.activeTaskLock.started
    ) {
      order.activeTaskLock = null;
      order.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Mark a task as started (cannot be released anymore).
   */
  public startTask(orderId: string, taskType: OrderTaskType, executorId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || !order.activeTaskLock) return false;

    if (
      order.activeTaskLock.taskType === taskType &&
      order.activeTaskLock.executorId === executorId
    ) {
      order.activeTaskLock.started = true;
      if (taskType === 'BREW') {
        order.state = 'BREWING';
      }
      order.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Complete task and perform state transition.
   */
  public completeTask(orderId: string, taskType: OrderTaskType, executorId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || !order.activeTaskLock) return false;

    if (
      order.activeTaskLock.taskType !== taskType ||
      order.activeTaskLock.executorId !== executorId
    ) {
      return false;
    }

    switch (taskType) {
      case 'TAKE_ORDER': {
        if (order.state !== 'WAITING_FOR_ORDER') return false;
        // Reserve ingredients
        const reservedSuccess = this.inventory.reserve(order.recipe.ingredients);
        if (!reservedSuccess) {
          return false;
        }
        order.reservedIngredients = { ...order.recipe.ingredients };
        order.state = 'ORDER_TAKEN';
        // Immediately ready to brew
        order.state = 'WAITING_TO_BREW';
        break;
      }
      case 'BREW': {
        if (order.state !== 'BREWING' && order.state !== 'WAITING_TO_BREW') return false;
        order.brewProgress = 1;
        order.state = 'WAITING_TO_SERVE';
        break;
      }
      case 'SERVE': {
        if (order.state !== 'WAITING_TO_SERVE') return false;
        // Ingredients are now served
        this.inventory.consumeReserved(order.reservedIngredients);
        order.reservedIngredients = {};
        order.state = 'WAITING_TO_PAY';
        break;
      }
      case 'CHECKOUT': {
        if (order.state !== 'WAITING_TO_PAY') return false;
        // Settle payment through ledger
        this.ledger.settleOrder(order.recipe.name, order.recipe.price);

        // Record recipe mastery (+1 sold) & 不可购买经营指标 (M3: 基金额度 / 成就)
        this.saveManager.updateState((draft) => {
          if (!draft.recipeMastery) draft.recipeMastery = {};
          draft.recipeMastery[order.recipe.id] =
            (draft.recipeMastery[order.recipe.id] || 0) + 1;
          draft.stats.completedOrders += 1;
          draft.stats.totalRevenue += order.recipe.price;
        });

        order.state = 'COMPLETED';
        break;
      }
      default:
        return false;
    }

    order.activeTaskLock = null;
    order.updatedAt = Date.now();
    return true;
  }

  /**
   * Update brewing progress for any currently brewing orders.
   */
  public tickBrewing(deltaSeconds: number): Order[] {
    const completedBrewOrders: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.state === 'BREWING') {
        order.brewProgress += deltaSeconds / order.brewDurationSeconds;
        if (order.brewProgress >= 1) {
          order.brewProgress = 1;
          order.state = 'WAITING_TO_SERVE';
          order.activeTaskLock = null;
          order.updatedAt = Date.now();
          completedBrewOrders.push(order);
        }
      }
    }
    return completedBrewOrders;
  }

  /**
   * Abandon an order (e.g. customer patience timeout).
   * Follows design doc section 5:
   * - Unbrewed: full refund of reserved ingredients.
   * - Brewed but unserved: ingredients consumed/lost, no refund, no penalty.
   */
  public abandonOrder(orderId: string, reason = 'patience_timeout'): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;
    if (order.state === 'COMPLETED' || order.state === 'ABANDONED') return false;

    // Check if unbrewed vs brewed
    if (
      order.state === 'WAITING_FOR_ORDER' ||
      order.state === 'ORDER_TAKEN' ||
      order.state === 'WAITING_TO_BREW' ||
      order.state === 'BREWING'
    ) {
      // Full refund of reserved ingredients
      if (Object.keys(order.reservedIngredients).length > 0) {
        this.inventory.releaseReserved(order.reservedIngredients);
        order.reservedIngredients = {};
      }
    } else if (order.state === 'WAITING_TO_SERVE') {
      // Brewed drink discarded; ingredients permanently consumed
      if (Object.keys(order.reservedIngredients).length > 0) {
        this.inventory.consumeReserved(order.reservedIngredients);
        order.reservedIngredients = {};
      }
    }

    order.state = 'ABANDONED';
    order.abandonReason = reason;
    order.activeTaskLock = null;
    order.updatedAt = Date.now();
    return true;
  }
}
