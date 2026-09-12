import {
  INGREDIENT_DEFS,
  STAFF_CONFIG,
  STAFF_MEMBER_DEF,
  SUPPLY_BATCH_DISCOUNTS,
  StaffDuty,
  StaffStoryChapter
} from '../config';
import { Customer, CustomerManager } from '../customer';
import { EconomyLedger } from '../economy';
import { InventoryManager } from '../inventory';
import { OrderStateMachine } from '../order';
import { OrderTaskType } from '../order/types';
import { Point } from '../config';
import { SaveManager } from '../save';
import { SchedulableTask, pickOldestTask } from './scheduler';

export interface StaffDeps {
  orderStateMachine: OrderStateMachine;
  customerManager: CustomerManager;
  inventory: InventoryManager;
  ledger: EconomyLedger;
  saveManager: SaveManager;
  getBrewSlots: () => number;
  /** 顾客离店路径规划（由场景侧注入 navGraph.route） */
  routeToExit: (from: Point) => Point[];
  onStoryUnlocked?: (chapter: StaffStoryChapter) => void;
  onAutoOrderCompleted?: (customer: Customer) => void;
}

interface ActiveWork {
  orderId: string;
  taskType: OrderTaskType;
  remaining: number;
}

/**
 * 店员（T3.5）：雇佣 + 持续工资（账本抽成）+ 职责指派 + 自动领任务。
 * 逻辑与渲染分离：本类不含 pixi 依赖，可单测；视觉由场景侧读取 pos/isBusy 绘制。
 */
export class StaffMember {
  public readonly id = STAFF_MEMBER_DEF.id;
  public readonly name = STAFF_MEMBER_DEF.name;

  private deps: StaffDeps;
  private currentWork: ActiveWork | null = null;
  private autoSupplyCooldown = 0;
  private pendingStories: StaffStoryChapter[] = [];

  constructor(deps: StaffDeps) {
    this.deps = deps;
  }

  // ---------- 档案 ----------

  public isHired(): boolean {
    return this.deps.saveManager.getState().staff.hired;
  }

  public getDuties(): StaffDuty[] {
    return this.deps.saveManager.getState().staff.duties as StaffDuty[];
  }

  public getStoriesSeen(): readonly string[] {
    return this.deps.saveManager.getState().staff.storiesSeen;
  }

  public isBusy(): boolean {
    return this.currentWork !== null;
  }

  public getCurrentWorkLabel(): string | null {
    if (!this.currentWork) return null;
    return STAFF_CONFIG.DUTY_LABELS[this.currentWork.taskType as StaffDuty] ?? null;
  }

  // ---------- 雇佣与工资 ----------

  public canHire(): { ok: boolean; reason?: string } {
    if (this.isHired()) return { ok: false, reason: '店员已在岗' };
    if (this.deps.ledger.getBalance() < STAFF_CONFIG.HIRE_FEE) {
      return { ok: false, reason: `金币不足（需 🪙${STAFF_CONFIG.HIRE_FEE}）` };
    }
    return { ok: true };
  }

  public hire(): boolean {
    const check = this.canHire();
    if (!check.ok) return false;
    this.deps.ledger.settleStaffHire(this.name, STAFF_CONFIG.HIRE_FEE);
    this.deps.saveManager.updateState((draft) => {
      draft.staff.hired = true;
    });
    this.unlockStory('on_hire');
    return true;
  }

  /** 持续工资：每笔订单收入抽成（经账本挂钩调用，余额永不为负） */
  public getWageCut(grossAmount: number): number {
    if (!this.isHired()) return 0;
    return Math.round(grossAmount * STAFF_CONFIG.WAGE_RATE);
  }

  // ---------- 职责指派 ----------

  public setDuty(duty: StaffDuty, enabled: boolean): void {
    this.deps.saveManager.updateState((draft) => {
      const duties = new Set(draft.staff.duties as StaffDuty[]);
      if (enabled) duties.add(duty);
      else duties.delete(duty);
      draft.staff.duties = Array.from(duties);
    });
  }

  // ---------- 剧情 ----------

  private unlockStory(trigger: StaffStoryChapter['trigger']): void {
    const seen = new Set(this.getStoriesSeen());
    for (const chapter of STAFF_MEMBER_DEF.stories) {
      if (chapter.trigger !== trigger || seen.has(chapter.id)) continue;
      this.deps.saveManager.updateState((draft) => {
        draft.staff.storiesSeen.push(chapter.id);
      });
      this.pendingStories.push(chapter);
      this.deps.onStoryUnlocked?.(chapter);
    }
  }

  // ---------- 任务调度与执行 ----------

  /** 收集当前可领取的订单任务（未锁定且状态匹配） */
  public collectClaimableTasks(): SchedulableTask[] {
    const sm = this.deps.orderStateMachine;
    const tasks: SchedulableTask[] = [];
    for (const order of sm.getActiveOrders()) {
      if (order.activeTaskLock) continue;
      let taskType: OrderTaskType | null = null;
      if (order.state === 'WAITING_FOR_ORDER') taskType = 'TAKE_ORDER';
      else if (order.state === 'WAITING_TO_BREW') taskType = 'BREW';
      else if (order.state === 'WAITING_TO_SERVE') taskType = 'SERVE';
      else if (order.state === 'WAITING_TO_PAY') taskType = 'CHECKOUT';
      if (taskType && sm.canClaimTask(order.id, taskType)) {
        tasks.push({ orderId: order.id, taskType, createdAt: order.createdAt });
      }
    }
    return tasks;
  }

  public update(deltaSeconds: number): void {
    if (!this.isHired()) return;

    if (this.autoSupplyCooldown > 0) {
      this.autoSupplyCooldown -= deltaSeconds;
    }

    // 1. 执行中的工作推进
    if (this.currentWork) {
      this.currentWork.remaining -= deltaSeconds;
      if (this.currentWork.remaining <= 0) {
        this.finishWork();
      }
      return;
    }

    // 2. 空闲：按"最老可领取任务优先"领取职责内订单任务
    const duties = this.getDuties().filter((d) => d !== 'AUTO_SUPPLY') as OrderTaskType[];
    const picked = pickOldestTask(this.collectClaimableTasks(), duties);

    if (picked) {
      // 双杯槽位限制：制作槽位满时不领 BREW
      if (picked.taskType === 'BREW') {
        const brewing = this.deps.orderStateMachine.getBrewingOrders().length;
        if (brewing >= this.deps.getBrewSlots()) {
          return;
        }
      }
      this.startWork(picked);
      return;
    }

    // 3. 自动补货：不抢占订单任务，仅无单可领且库存低于阈值时触发
    if (this.getDuties().includes('AUTO_SUPPLY')) {
      this.tryAutoSupply();
    }
  }

  private startWork(task: SchedulableTask): void {
    const sm = this.deps.orderStateMachine;
    if (!sm.claimTask(task.orderId, task.taskType, this.id)) {
      return;
    }

    if (task.taskType === 'BREW') {
      // 开始萃取后立即空闲（咖啡机按自身时长工作，BREW 锁由 tickBrewing 完成时释放）
      sm.startTask(task.orderId, 'BREW', this.id);
      this.currentWork = null;
      return;
    }

    const duration = STAFF_CONFIG.TASK_DURATIONS[task.taskType as keyof typeof STAFF_CONFIG.TASK_DURATIONS] ?? 1.5;
    this.currentWork = { orderId: task.orderId, taskType: task.taskType, remaining: duration };
  }

  private finishWork(): void {
    const work = this.currentWork;
    if (!work) return;
    this.currentWork = null;

    const sm = this.deps.orderStateMachine;
    const order = sm.getOrder(work.orderId);
    if (!order) return;

    const customer = this.deps.customerManager.getCustomerById(order.customerId);
    const success = sm.completeTask(work.orderId, work.taskType, this.id);
    if (!success) return;

    if (!customer) return;

    switch (work.taskType) {
      case 'TAKE_ORDER':
        customer.state = 'WAITING_FOR_DRINK';
        this.deps.customerManager.setBubble(customer, `好期待这杯【${order.recipe.name}】！`, 2.5);
        break;
      case 'SERVE':
        customer.state = 'ENJOYING_DRINK';
        this.deps.customerManager.setBubble(customer, '香气四溢！谢谢~', 3.0);
        break;
      case 'CHECKOUT': {
        this.deps.customerManager.setBubble(customer, '多谢款待，下次再来！', 3.0);
        customer.state = 'LEAVING';
        customer.walkPath = this.deps.routeToExit(customer.pos);
        this.deps.saveManager.updateState((draft) => {
          draft.staff.autoOrdersCompleted += 1;
        });
        this.unlockStory('first_auto_order');
        if (this.deps.saveManager.getState().staff.autoOrdersCompleted >= 10) {
          this.unlockStory('orders_10');
        }
        this.deps.onAutoOrderCompleted?.(customer);
        break;
      }
      default:
        break;
    }
  }

  private tryAutoSupply(): void {
    if (this.autoSupplyCooldown > 0) return;

    const threshold = STAFF_CONFIG.AUTO_SUPPLY_THRESHOLD;
    const batch = SUPPLY_BATCH_DISCOUNTS[0];

    for (const def of INGREDIENT_DEFS) {
      if (this.deps.inventory.getAvailable(def.id) >= threshold) continue;
      const cost = Math.round(def.unitPrice * batch.amount * batch.discountRate);
      if (this.deps.ledger.getBalance() < cost) {
        this.autoSupplyCooldown = STAFF_CONFIG.AUTO_SUPPLY_COOLDOWN_SECONDS;
        return;
      }
      // 独立成交易（第 7 节：自动补货等支出另起独立交易）
      this.deps.ledger.settleSupplyPurchase(def.name, batch.amount, cost);
      this.deps.inventory.addStock(def.id, batch.amount);
      this.deps.saveManager.updateState((draft) => {
        draft.inventory = this.deps.inventory.getAllStock();
      });
      this.autoSupplyCooldown = STAFF_CONFIG.AUTO_SUPPLY_COOLDOWN_SECONDS;
      return;
    }
  }
}
