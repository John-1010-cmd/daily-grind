import {
  CUSTOMER_CONFIG,
  CUSTOMER_QUEUE_SPOTS,
  Point,
  RECIPE_DEFS,
  RecipeDef,
  TABLE_SEATS,
  TableSeatDef
} from '../config';
import { InventoryManager } from '../inventory';
import { OrderStateMachine } from '../order';
import { NavGraph, distance } from '../scene/nav';

export type CustomerState =
  | 'ENTERING'          // 进店走向座位
  | 'WAITING_FOR_SEAT'  // 满座时在吧台前安静排队
  | 'SEATED_CHOOSING'   // 坐下看菜单选品
  | 'WAITING_FOR_ORDER' // 选好等待接单
  | 'WAITING_FOR_DRINK' // 已接单，等待制作上菜
  | 'ENJOYING_DRINK'    // 品尝饮品中
  | 'WAITING_TO_PAY'    // 喝完等待收银
  | 'LEAVING'           // 离开走向大门
  | 'LEFT';             // 已完全离店

export interface Customer {
  id: string;
  name: string;
  seat: TableSeatDef;
  state: CustomerState;
  pos: Point;
  facing: 'left' | 'right';
  walkPath: Point[];
  patienceRemaining: number;
  enjoyRemaining: number;
  bubbleText: string | null;
  bubbleDuration: number;
  orderId: string | null;
  chosenRecipe: RecipeDef | null;
  color: number;
  allOutOfStockCount: number;
  /** 常客 ID（随机路人为 undefined），M3 常客系统 */
  regularId?: string;
}

const CUSTOMER_NAMES = [
  '戴圆眼镜的女孩',
  '背双肩包的学生',
  '读诗集的小伙',
  '拿素描本的常客',
  '穿风衣的旅行者',
  '捧着电脑的写作者',
  '散步路过的阿姨'
];

const CUSTOMER_PALETTES = [
  0xe17055, // coral
  0x6c5ce7, // violet
  0x00b894, // mint
  0x0984e3, // blue
  0xfdcb6e, // warm yellow
  0xe84393  // pink
];

/** M3 常客接入钩子（避免 customer 模块反向依赖 regulars 模块） */
export interface RegularHooks {
  /** 决定本次进店是否为常客：返回常客定义或 null（随机路人） */
  pickRegular: (activeRegularIds: Set<string>) => { id: string; name: string; color: number } | null;
  /** 常客进店时回调（计 visit） */
  onRegularArrive: (regularId: string) => void;
  /** 常客固定偏好 / 专属点单：返回完整 RecipeDef（专属）或配方 id（常规偏好走缺货改点流程） */
  pickRecipeFor: (
    regularId: string,
    unlockedRecipeIds: readonly string[]
  ) => { kind: 'exclusive'; recipe: RecipeDef } | { kind: 'preferred'; recipeId: string } | null;
}

export interface CustomerSceneOptions {
  tableSeats: readonly TableSeatDef[];
  queueSpots: readonly TableSeatDef[];
  spawnPos: Point;
  exitPos: Point;
}

export class CustomerManager {
  private customers: Customer[] = [];
  private spawnTimer: number = 2; // Initial spawn soon after launch
  private navGraph: NavGraph;
  private inventory: InventoryManager;
  private orderStateMachine: OrderStateMachine;
  private nextCustomerId = 1;
  private sceneOptions: CustomerSceneOptions;

  /** M3：常客生成与点单偏好（由 main 注入） */
  private regularHooks: RegularHooks | null = null;

  constructor(
    navGraph: NavGraph,
    inventory: InventoryManager,
    orderStateMachine: OrderStateMachine,
    sceneOptions: CustomerSceneOptions = {
      tableSeats: TABLE_SEATS,
      queueSpots: CUSTOMER_QUEUE_SPOTS,
      spawnPos: CUSTOMER_CONFIG.SPAWN_POS,
      exitPos: CUSTOMER_CONFIG.EXIT_POS
    }
  ) {
    this.navGraph = navGraph;
    this.inventory = inventory;
    this.orderStateMachine = orderStateMachine;
    this.sceneOptions = sceneOptions;
  }

  public setRegularHooks(hooks: RegularHooks): void {
    this.regularHooks = hooks;
  }

  public getCustomers(): readonly Customer[] {
    return this.customers;
  }

  public getCustomerByTable(tableId: string): Customer | undefined {
    return this.customers.find(
      (c) => c.seat.tableId === tableId && c.state !== 'LEFT' && c.state !== 'LEAVING'
    );
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  private getOccupiedSeatIds(): Set<string> {
    const occupied = new Set<string>();
    for (const c of this.customers) {
      if (c.state !== 'LEFT' && c.state !== 'LEAVING') {
        occupied.add(c.seat.id);
      }
    }
    return occupied;
  }

  private getOccupiedQueueSpotIds(): Set<string> {
    return new Set(
      this.customers
        .filter((customer) => customer.state !== 'LEFT' && customer.seat.tableId === 'waiting_queue')
        .map((customer) => customer.seat.id)
    );
  }

  private promoteQueueToSeats(): void {
    const occupiedSeats = this.getOccupiedSeatIds();
    const freeSeats = this.sceneOptions.tableSeats.filter((seat) => !occupiedSeats.has(seat.id));
    if (freeSeats.length === 0) return;

    const waiting = this.customers.filter(
      (customer) => customer.state === 'WAITING_FOR_SEAT' && customer.walkPath.length === 0
    );
    for (const customer of waiting) {
      const seat = freeSeats.shift();
      if (!seat) break;
      customer.seat = seat;
      customer.state = 'ENTERING';
      customer.walkPath = this.navGraph.route(customer.pos, seat.seatPos);
      this.setBubble(customer, '轮到我啦，去找个舒服的位置坐下~', CUSTOMER_CONFIG.QUEUE_BUBBLE_DURATION_SECONDS);
    }
  }

  public setSceneOptions(sceneOptions: CustomerSceneOptions): void {
    this.sceneOptions = sceneOptions;
  }

  /**
   * Spawns a customer if a table is free and customer limit not reached.
   */
  public spawnCustomer(): Customer | null {
    if (this.customers.filter((c) => c.state !== 'LEFT').length >= CUSTOMER_CONFIG.MAX_ACTIVE_CUSTOMERS) {
      return null;
    }

    const occupiedSeats = this.getOccupiedSeatIds();
    const availableSeats = this.sceneOptions.tableSeats.filter((s) => !occupiedSeats.has(s.id));
    const queueSpot = this.sceneOptions.queueSpots.find(
      (spot) => !this.getOccupiedQueueSpotIds().has(spot.id)
    );
    const chosenSeat = availableSeats.length > 0
      ? availableSeats[Math.floor(Math.random() * availableSeats.length)]
      : queueSpot;
    if (!chosenSeat) return null;
    const waitingForSeat = chosenSeat.tableId === 'waiting_queue';

    // M3：常客优先生成（不与店内现有常客重复）
    let regularId: string | undefined;
    let name: string;
    let color: number;
    const activeRegularIds = new Set(
      this.customers
        .filter((c) => c.state !== 'LEFT' && c.regularId)
        .map((c) => c.regularId as string)
    );
    const regular = this.regularHooks?.pickRegular(activeRegularIds) ?? null;
    if (regular) {
      regularId = regular.id;
      name = regular.name;
      color = regular.color;
    } else {
      name = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
      color = CUSTOMER_PALETTES[Math.floor(Math.random() * CUSTOMER_PALETTES.length)];
    }

    const spawnPos = { ...this.sceneOptions.spawnPos };
    const walkPath = this.navGraph.route(spawnPos, chosenSeat.seatPos);

    const customer: Customer = {
      id: `cust_${Date.now()}_${this.nextCustomerId++}`,
      name,
      seat: chosenSeat,
      state: waitingForSeat ? 'WAITING_FOR_SEAT' : 'ENTERING',
      pos: spawnPos,
      facing: 'right',
      walkPath,
      patienceRemaining: CUSTOMER_CONFIG.PATIENCE_SECONDS,
      enjoyRemaining: CUSTOMER_CONFIG.EAT_DURATION_SECONDS,
      bubbleText: null,
      bubbleDuration: 0,
      orderId: null,
      chosenRecipe: null,
      color,
      allOutOfStockCount: 0,
      regularId
    };

    this.customers.push(customer);
    if (regularId) {
      this.regularHooks?.onRegularArrive(regularId);
    }
    return customer;
  }

  public setBubble(customer: Customer, text: string, duration = 3.5): void {
    customer.bubbleText = text;
    customer.bubbleDuration = duration;
  }

  /**
   * Process customer deciding recipe & gentle out-of-stock sequence (Sections 0 & 4).
   */
  public decideRecipe(
    customer: Customer,
    unlockedRecipeIds: readonly string[],
    forcedPreferredId?: string
  ): void {
    // M3 常客：固定偏好 / 好感专属点单
    if (customer.regularId && this.regularHooks) {
      const pick = this.regularHooks.pickRecipeFor(customer.regularId, unlockedRecipeIds);
      if (pick?.kind === 'exclusive') {
        // 专属点单：有货则直接确认；缺货则回落到常规偏好流程
        if (this.inventory.canFulfill(pick.recipe.ingredients)) {
          this.setBubble(customer, `今天想喝那杯【${pick.recipe.name}】，老规矩~`, 3.0);
          this.confirmOrder(customer, pick.recipe);
          return;
        }
      } else if (pick?.kind === 'preferred') {
        forcedPreferredId = pick.recipeId;
      }
    }

    const unlockedDefs = RECIPE_DEFS.filter((r) => unlockedRecipeIds.includes(r.id));
    if (unlockedDefs.length === 0) {
      this.setBubble(customer, '店里还没有配方呢，我稍后再来看看~', 3.0);
      this.leaveCalmly(customer);
      return;
    }

    // 1. Pick preferred recipe
    const preferred = forcedPreferredId
      ? unlockedDefs.find((r) => r.id === forcedPreferredId) || unlockedDefs[0]
      : unlockedDefs[Math.floor(Math.random() * unlockedDefs.length)];

    // 2. Check stock
    if (this.inventory.canFulfill(preferred.ingredients)) {
      // In stock!
      this.confirmOrder(customer, preferred);
      return;
    }

    // 3. Out of stock gentle change!
    // Try to find alternative unlocked recipe in stock
    const inStockAlternatives = unlockedDefs.filter(
      (r) => r.id !== preferred.id && this.inventory.canFulfill(r.ingredients)
    );

    if (inStockAlternatives.length > 0) {
      const alt = inStockAlternatives[Math.floor(Math.random() * inStockAlternatives.length)];
      this.setBubble(customer, `【${preferred.name}】卖完了呀，那改来一杯【${alt.name}】吧！`, 3.5);
      this.confirmOrder(customer, alt);
    } else {
      // 4. All unlocked recipes are out of stock: wait briefly with calm bubble, then leave calmly!
      this.setBubble(customer, '原料好像都用完了，那我改天再来喝咖啡~', 3.5);
      customer.state = 'SEATED_CHOOSING';
      customer.enjoyRemaining = 2.0; // short pause before leaving
      customer.allOutOfStockCount++;
    }
  }

  private confirmOrder(customer: Customer, recipe: RecipeDef): void {
    customer.chosenRecipe = recipe;
    const order = this.orderStateMachine.createOrder(customer.id, customer.seat.tableId, recipe);
    customer.orderId = order.id;
    customer.state = 'WAITING_FOR_ORDER';
    customer.patienceRemaining = CUSTOMER_CONFIG.PATIENCE_SECONDS;
    if (!customer.bubbleText) {
      this.setBubble(customer, `来一杯【${recipe.name}】~`, 3.0);
    }
  }

  public leaveCalmly(customer: Customer): void {
    if (customer.state === 'LEAVING' || customer.state === 'LEFT') return;

    if (customer.orderId) {
      this.orderStateMachine.abandonOrder(customer.orderId, 'calm_departure');
    }

    customer.state = 'LEAVING';
    customer.walkPath = this.navGraph.route(customer.pos, this.sceneOptions.exitPos);
  }

  public update(deltaSeconds: number, unlockedRecipeIds: readonly string[]): void {
    // 1. 空位先交给已经排队的顾客，再接纳新客。
    this.promoteQueueToSeats();

    // 2. Spawning timer
    this.spawnTimer -= deltaSeconds;
    if (this.spawnTimer <= 0) {
      this.spawnCustomer();
      this.spawnTimer =
        CUSTOMER_CONFIG.SPAWN_INTERVAL_MIN +
        Math.random() *
          (CUSTOMER_CONFIG.SPAWN_INTERVAL_MAX - CUSTOMER_CONFIG.SPAWN_INTERVAL_MIN);
    }

    // 3. Update each customer
    for (const c of this.customers) {
      if (c.bubbleDuration > 0) {
        c.bubbleDuration -= deltaSeconds;
        if (c.bubbleDuration <= 0) {
          c.bubbleText = null;
        }
      }

      switch (c.state) {
        case 'WAITING_FOR_SEAT': {
          if (c.walkPath.length > 0) {
            this.stepMovement(c, deltaSeconds, () => {
              this.setBubble(c, '这里闻得到咖啡香，我慢慢排一会儿~', CUSTOMER_CONFIG.QUEUE_BUBBLE_DURATION_SECONDS);
            });
          }
          break;
        }

        case 'ENTERING': {
          this.stepMovement(c, deltaSeconds, () => {
            c.pos = { ...c.seat.seatPos };
            c.state = 'SEATED_CHOOSING';
            this.decideRecipe(c, unlockedRecipeIds);
          });
          break;
        }

        case 'SEATED_CHOOSING': {
          if (c.allOutOfStockCount > 0) {
            c.enjoyRemaining -= deltaSeconds;
            if (c.enjoyRemaining <= 0) {
              this.leaveCalmly(c);
            }
          }
          break;
        }

        case 'WAITING_FOR_ORDER':
        case 'WAITING_FOR_DRINK':
        case 'WAITING_TO_PAY': {
          // Decrement patience
          c.patienceRemaining -= deltaSeconds;
          if (c.patienceRemaining <= 0) {
            this.setBubble(c, '店里看起来好忙，我改天再来吧~', 3.0);
            this.leaveCalmly(c);
          }
          break;
        }

        case 'ENJOYING_DRINK': {
          c.enjoyRemaining -= deltaSeconds;
          if (c.enjoyRemaining <= 0) {
            c.state = 'WAITING_TO_PAY';
            c.patienceRemaining = CUSTOMER_CONFIG.PATIENCE_SECONDS;
            this.setBubble(c, '买单，辛苦啦！', 3.0);
          }
          break;
        }

        case 'LEAVING': {
          this.stepMovement(c, deltaSeconds, () => {
            c.state = 'LEFT';
          });
          break;
        }

        case 'LEFT':
          break;
      }
    }

    // Cleanup left customers
    this.customers = this.customers.filter((c) => c.state !== 'LEFT');
  }

  private stepMovement(customer: Customer, deltaSeconds: number, onArrived: () => void): void {
    if (customer.walkPath.length === 0) {
      onArrived();
      return;
    }

    const target = customer.walkPath[0];
    const dist = distance(customer.pos, target);
    const step = CUSTOMER_CONFIG.WALK_SPEED * deltaSeconds;

    if (target.x > customer.pos.x + 2) customer.facing = 'right';
    else if (target.x < customer.pos.x - 2) customer.facing = 'left';

    if (dist <= step) {
      customer.pos = { x: target.x, y: target.y };
      customer.walkPath.shift();
      if (customer.walkPath.length === 0) {
        onArrived();
      }
    } else {
      const angle = Math.atan2(target.y - customer.pos.y, target.x - customer.pos.x);
      customer.pos.x += Math.cos(angle) * step;
      customer.pos.y += Math.sin(angle) * step;
    }
  }
}
