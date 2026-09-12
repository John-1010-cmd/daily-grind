export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneObjectConfig {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  interactPoint: Point;
  hitbox: Rect;
  description: string;
}

export interface NavWaypoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface NavEdge {
  from: string;
  to: string;
}

export interface TimePeriodConfig {
  id: 'dawn' | 'noon' | 'dusk' | 'night';
  label: string;
  icon: string;
  durationSeconds: number;
  tintColor: number;
  tintAlpha: number;
  ambientHex: string;
}

export const SCREEN_CONFIG = {
  DESIGN_WIDTH: 1376,
  DESIGN_HEIGHT: 768,
  LETTERBOX_BACKGROUND: '#1b140e'
} as const;

export const PLAYER_CONFIG = {
  SPEED: 240,
  WIDTH: 32,
  HEIGHT: 48,
  INITIAL_X: 520,
  INITIAL_Y: 550,
  COLOR: 0x3d7e5d,
  ACCENT_COLOR: 0x24523b
} as const;

export const TIME_PERIODS: readonly TimePeriodConfig[] = [
  {
    id: 'dawn',
    label: '清晨',
    icon: '🌅',
    durationSeconds: 120,
    tintColor: 0xd8e6f8,
    tintAlpha: 0.18,
    ambientHex: '#d8e6f8'
  },
  {
    id: 'noon',
    label: '午后',
    icon: '☀️',
    durationSeconds: 180,
    tintColor: 0xfffaed,
    tintAlpha: 0.05,
    ambientHex: '#fffaed'
  },
  {
    id: 'dusk',
    label: '黄昏',
    icon: '🌇',
    durationSeconds: 120,
    tintColor: 0xfcb075,
    tintAlpha: 0.28,
    ambientHex: '#fcb075'
  },
  {
    id: 'night',
    label: '夜晚',
    icon: '🌙',
    durationSeconds: 180,
    tintColor: 0x222a45,
    tintAlpha: 0.42,
    ambientHex: '#222a45'
  }
] as const;

export const CLOCK_CONFIG = {
  TOTAL_CYCLE_SECONDS: 600,
  OFFLINE_MAX_SECONDS: 12 * 3600,
  HOUR_TO_PERIOD: [
    { startHour: 5, endHour: 10, periodId: 'dawn' },
    { startHour: 11, endHour: 16, periodId: 'noon' },
    { startHour: 17, endHour: 19, periodId: 'dusk' },
    { startHour: 20, endHour: 24, periodId: 'night' },
    { startHour: 0, endHour: 4, periodId: 'night' }
  ]
} as const;

export const SCENE_OBJECTS: readonly SceneObjectConfig[] = [
  {
    id: 'window',
    name: '落地窗与绿植',
    x: 10,
    y: 10,
    width: 440,
    height: 560,
    color: 0x9ec7db,
    interactPoint: { x: 480, y: 550 },
    hitbox: { x: 0, y: 0, width: 460, height: 580 },
    description: '明亮通透的大落地窗，阳光倾泻其上。'
  },
  {
    id: 'door',
    name: '大门',
    x: 470,
    y: 200,
    width: 85,
    height: 320,
    color: 0xa06d44,
    interactPoint: { x: 520, y: 550 },
    hitbox: { x: 450, y: 190, width: 125, height: 350 },
    description: '咖啡馆木框玻璃门，迎送每一位顾客。'
  },
  {
    id: 'bookshelf_back',
    name: '后墙书架',
    x: 650,
    y: 260,
    width: 130,
    height: 230,
    color: 0x7a4622,
    interactPoint: { x: 660, y: 540 },
    hitbox: { x: 630, y: 240, width: 160, height: 260 },
    description: '摆满咖啡典籍与手绘画册的书架。'
  },
  {
    id: 'counter',
    name: '吧台主台',
    x: 800,
    y: 380,
    width: 380,
    height: 180,
    color: 0x8b5428,
    interactPoint: { x: 760, y: 560 },
    hitbox: { x: 770, y: 360, width: 430, height: 210 },
    description: '实木制作吧台，散发浓郁咖啡香。'
  },
  {
    id: 'espresso_machine',
    name: '意式咖啡机',
    x: 940,
    y: 360,
    width: 90,
    height: 70,
    color: 0x475569,
    interactPoint: { x: 920, y: 590 },
    hitbox: { x: 910, y: 340, width: 140, height: 110 },
    description: '双头商用意式咖啡机，蒸汽嗤嗤作响。'
  },
  {
    id: 'pastry_case',
    name: '冷藏糕点柜',
    x: 810,
    y: 400,
    width: 80,
    height: 80,
    color: 0xd4a373,
    interactPoint: { x: 760, y: 540 },
    hitbox: { x: 780, y: 380, width: 120, height: 120 },
    description: '摆放牛角包与提拉米苏的玻璃展柜。'
  },
  {
    id: 'table_3',
    name: '3号餐桌(中后)',
    x: 570,
    y: 460,
    width: 120,
    height: 90,
    color: 0xb58451,
    interactPoint: { x: 570, y: 570 },
    hitbox: { x: 550, y: 440, width: 160, height: 130 },
    description: '靠墙静谧双人座，常有常客捧书静读。'
  },
  {
    id: 'cat_and_table_4',
    name: '4号桌与橘猫',
    x: 230,
    y: 600,
    width: 440,
    height: 155,
    color: 0xc48c58,
    interactPoint: { x: 620, y: 620 },
    hitbox: { x: 210, y: 580, width: 480, height: 180 },
    description: '阳光最好的大木桌，上面睡着暖融融的橘猫。'
  },
  {
    id: 'cat_cushion',
    name: '橘猫与睡垫',
    x: 380,
    y: 620,
    width: 130,
    height: 80,
    color: 0xe67e22,
    interactPoint: { x: 530, y: 640 },
    hitbox: { x: 360, y: 600, width: 170, height: 110 },
    description: '蜷缩在木桌上的招牌橘猫，轻触会发出满足的呼噜声。'
  },
  {
    id: 'table_2',
    name: '2号餐桌(中右)',
    x: 980,
    y: 580,
    width: 140,
    height: 100,
    color: 0xb58451,
    interactPoint: { x: 940, y: 660 },
    hitbox: { x: 960, y: 560, width: 180, height: 130 },
    description: '厅中舒适木桌，适合闺蜜轻声闲聊。'
  },
  {
    id: 'table_1',
    name: '1号餐桌(前右)',
    x: 1090,
    y: 670,
    width: 170,
    height: 95,
    color: 0x935c33,
    interactPoint: { x: 1060, y: 710 },
    hitbox: { x: 1070, y: 650, width: 210, height: 118 },
    description: '前景实木餐桌，常有点了拿铁独处的人。'
  },
  {
    id: 'bookshelf_right',
    name: '右侧大型书架',
    x: 1240,
    y: 110,
    width: 136,
    height: 500,
    color: 0x7a4622,
    interactPoint: { x: 1210, y: 640 },
    hitbox: { x: 1220, y: 90, width: 156, height: 540 },
    description: '高耸入顶的深色书架，装点着暖黄小夜灯。'
  }
] as const;

export const WALKABLE_ZONES: readonly Rect[] = [
  // Door area
  { x: 470, y: 520, width: 110, height: 80 },
  // Center main aisle
  { x: 520, y: 540, width: 320, height: 110 },
  // Front central walkway (between table 4 and table 1)
  { x: 670, y: 600, width: 240, height: 140 },
  // Bar front counter aisle
  { x: 740, y: 530, width: 220, height: 120 },
  // Right tables aisle
  { x: 900, y: 620, width: 190, height: 110 },
  // Right edge walkway
  { x: 1040, y: 670, width: 90, height: 70 },
  { x: 1180, y: 610, width: 70, height: 80 }
] as const;

export const NAV_WAYPOINTS: readonly NavWaypoint[] = [
  { id: 'door_exit', name: '大门前', x: 520, y: 550 },
  { id: 'aisle_mid_left', name: '中左走道', x: 560, y: 610 },
  { id: 'aisle_front_cat', name: '猫咪桌侧', x: 540, y: 660 },
  { id: 'aisle_center_back', name: '后厅中心', x: 660, y: 560 },
  { id: 'aisle_center_mid', name: '大厅中枢', x: 760, y: 600 },
  { id: 'aisle_center_front', name: '前厅主道', x: 780, y: 700 },
  { id: 'bar_counter_left', name: '吧台点单位', x: 760, y: 540 },
  { id: 'bar_counter_mid', name: '咖啡机操作位', x: 920, y: 590 },
  { id: 'table2_front', name: '2号桌位', x: 940, y: 660 },
  { id: 'table1_front', name: '1号桌位', x: 1060, y: 710 },
  { id: 'right_aisle_back', name: '右书架旁', x: 1210, y: 640 }
] as const;

export const NAV_EDGES: readonly NavEdge[] = [
  { from: 'door_exit', to: 'aisle_mid_left' },
  { from: 'door_exit', to: 'aisle_center_back' },
  { from: 'aisle_mid_left', to: 'aisle_front_cat' },
  { from: 'aisle_mid_left', to: 'aisle_center_mid' },
  { from: 'aisle_center_back', to: 'aisle_center_mid' },
  { from: 'aisle_center_back', to: 'bar_counter_left' },
  { from: 'aisle_center_mid', to: 'aisle_center_front' },
  { from: 'aisle_center_mid', to: 'bar_counter_left' },
  { from: 'aisle_center_mid', to: 'bar_counter_mid' },
  { from: 'aisle_center_mid', to: 'table2_front' },
  { from: 'aisle_center_front', to: 'table2_front' },
  { from: 'bar_counter_left', to: 'bar_counter_mid' },
  { from: 'bar_counter_mid', to: 'table2_front' },
  { from: 'table2_front', to: 'table1_front' },
  { from: 'table2_front', to: 'right_aisle_back' }
] as const;

export interface IngredientDef {
  id: string;
  name: string;
  unitPrice: number;
  icon: string;
}

export interface RecipeDef {
  id: string;
  name: string;
  lineId: 'espresso' | 'tea' | 'bakery';
  lineName: string;
  ingredients: Record<string, number>;
  price: number;
  brewTimeSeconds: number;
  unlockCost: number;
  prerequisiteRecipeId?: string;
  prerequisiteMasteryCount?: number;
}

export interface TableSeatDef {
  id: string;
  tableId: string;
  name: string;
  seatPos: Point;
  interactPoint: Point;
}

export const INGREDIENT_DEFS: readonly IngredientDef[] = [
  { id: 'coffee_beans', name: '优质咖啡豆', unitPrice: 3, icon: '🫘' },
  { id: 'milk', name: '鲜牛奶', unitPrice: 2, icon: '🥛' },
  { id: 'tea_leaves', name: '精选茶叶', unitPrice: 3, icon: '🍃' },
  { id: 'syrup', name: '风味糖浆', unitPrice: 2, icon: '🍯' },
  { id: 'baking_flour', name: '烘焙粉料', unitPrice: 3, icon: '🌾' },
  { id: 'fruits', name: '新鲜水果', unitPrice: 4, icon: '🍑' }
] as const;

export const INITIAL_INVENTORY: Record<string, number> = {
  coffee_beans: 16,
  milk: 10,
  tea_leaves: 8,
  syrup: 6,
  baking_flour: 6,
  fruits: 4
};

export const RECIPE_DEFS: readonly RecipeDef[] = [
  // 1. 意式咖啡线
  {
    id: 'espresso',
    name: '意式浓缩',
    lineId: 'espresso',
    lineName: '意式咖啡',
    ingredients: { coffee_beans: 1 },
    price: 15,
    brewTimeSeconds: 2.5,
    unlockCost: 0
  },
  {
    id: 'americano',
    name: '美式咖啡',
    lineId: 'espresso',
    lineName: '意式咖啡',
    ingredients: { coffee_beans: 1 },
    price: 20,
    brewTimeSeconds: 3.0,
    unlockCost: 50,
    prerequisiteRecipeId: 'espresso',
    prerequisiteMasteryCount: 2
  },
  {
    id: 'latte',
    name: '经典拿铁',
    lineId: 'espresso',
    lineName: '意式咖啡',
    ingredients: { coffee_beans: 1, milk: 1 },
    price: 28,
    brewTimeSeconds: 3.5,
    unlockCost: 100,
    prerequisiteRecipeId: 'americano',
    prerequisiteMasteryCount: 2
  },
  {
    id: 'cappuccino',
    name: '卡布奇诺',
    lineId: 'espresso',
    lineName: '意式咖啡',
    ingredients: { coffee_beans: 1, milk: 2 },
    price: 32,
    brewTimeSeconds: 4.0,
    unlockCost: 160,
    prerequisiteRecipeId: 'latte',
    prerequisiteMasteryCount: 2
  },

  // 2. 茶饮特调线
  {
    id: 'jasmine_tea',
    name: '茉莉清茶',
    lineId: 'tea',
    lineName: '茶饮特调',
    ingredients: { tea_leaves: 1 },
    price: 18,
    brewTimeSeconds: 2.8,
    unlockCost: 80 // 第二线首款，80金币可在15分钟单次会话内达成
  },
  {
    id: 'matcha_latte',
    name: '抹茶拿铁',
    lineId: 'tea',
    lineName: '茶饮特调',
    ingredients: { tea_leaves: 1, milk: 1 },
    price: 30,
    brewTimeSeconds: 3.8,
    unlockCost: 140,
    prerequisiteRecipeId: 'jasmine_tea',
    prerequisiteMasteryCount: 2
  },
  {
    id: 'peach_oolong',
    name: '蜜桃乌龙',
    lineId: 'tea',
    lineName: '茶饮特调',
    ingredients: { tea_leaves: 1, fruits: 1, syrup: 1 },
    price: 36,
    brewTimeSeconds: 4.2,
    unlockCost: 200,
    prerequisiteRecipeId: 'matcha_latte',
    prerequisiteMasteryCount: 2
  },

  // 3. 甜点烘焙线
  {
    id: 'croissant',
    name: '牛角可颂',
    lineId: 'bakery',
    lineName: '甜点烘焙',
    ingredients: { baking_flour: 1, milk: 1 },
    price: 24,
    brewTimeSeconds: 3.2,
    unlockCost: 120
  },
  {
    id: 'tiramisu',
    name: '经典提拉米苏',
    lineId: 'bakery',
    lineName: '甜点烘焙',
    ingredients: { baking_flour: 1, coffee_beans: 1, milk: 1 },
    price: 38,
    brewTimeSeconds: 4.5,
    unlockCost: 220,
    prerequisiteRecipeId: 'croissant',
    prerequisiteMasteryCount: 2
  }
] as const;

export const SUPPLY_BATCH_DISCOUNTS = [
  { amount: 10, discountRate: 1.0, label: '标准包 (10份)' },
  { amount: 30, discountRate: 0.9, label: '特惠箱 (30份, 9折)' },
  { amount: 50, discountRate: 0.8, label: '批发装 (50份, 8折)' }
] as const;

export const EMERGENCY_PACKAGE_CONFIG = {
  MIN_TRIGGER_GOLD: 20,
  ITEMS: {
    coffee_beans: 8,
    milk: 6,
    tea_leaves: 4
  }
} as const;

export const TABLE_SEATS: readonly TableSeatDef[] = [
  {
    id: 'seat_table_1',
    tableId: 'table_1',
    name: '1号桌',
    seatPos: { x: 1150, y: 710 },
    interactPoint: { x: 1060, y: 710 }
  },
  {
    id: 'seat_table_2',
    tableId: 'table_2',
    name: '2号桌',
    seatPos: { x: 1050, y: 620 },
    interactPoint: { x: 940, y: 660 }
  },
  {
    id: 'seat_table_3',
    tableId: 'table_3',
    name: '3号桌',
    seatPos: { x: 620, y: 500 },
    interactPoint: { x: 570, y: 570 }
  },
  {
    id: 'seat_table_4',
    tableId: 'table_4',
    name: '4号桌',
    seatPos: { x: 300, y: 670 },
    interactPoint: { x: 620, y: 620 }
  }
] as const;

export const CUSTOMER_CONFIG = {
  SPAWN_INTERVAL_MIN: 10,
  SPAWN_INTERVAL_MAX: 20,
  MAX_ACTIVE_CUSTOMERS: 4,
  PATIENCE_SECONDS: 90,
  EAT_DURATION_SECONDS: 6,
  WALK_SPEED: 180,
  SPAWN_POS: { x: 520, y: 480 },
  EXIT_POS: { x: 520, y: 550 }
} as const;

export const SESSION_RELEASE_CONDITIONS = {
  TARGET_ORDERS_IN_15_MIN: 8,
  LINE2_FIRST_RECIPE_ID: 'jasmine_tea',
  LINE2_FIRST_RECIPE_COST: 80,
  CUSTOMER_AVG_WAIT_SECONDS: 60,
  MAX_IDLE_TIME_RATIO: 0.40
} as const;

export const SAVE_CONFIG = {
  STORAGE_KEY: 'daily_grind_save_v1',
  CURRENT_VERSION: 1,
  INITIAL_GOLD: 100,
  AUTOSAVE_THROTTLE_MS: 1000,
  VALID_RECIPE_IDS: [
    'espresso',
    'americano',
    'latte',
    'cappuccino',
    'jasmine_tea',
    'matcha_latte',
    'peach_oolong',
    'croissant',
    'tiramisu'
  ] as const,
  VALID_FURNITURE_IDS: ['default_chair', 'default_table', 'plant_monstera'] as const
} as const;

export const UI_CONFIG = {
  TOAST_DURATION_MS: 2600,
  TOP_NAV_BUTTONS: [
    { id: 'recipes', label: '配方', icon: '📖', enabledInM0: false, enabledInM1: true },
    { id: 'supply', label: '进货', icon: '📦', enabledInM0: false, enabledInM1: true },
    { id: 'decor', label: '装修', icon: '🛋️', enabledInM0: false, enabledInM1: false },
    { id: 'handbook', label: '图鉴', icon: '📕', enabledInM0: false, enabledInM1: false },
    { id: 'map', label: '分店地图', icon: '🗺️', enabledInM0: false, enabledInM1: false },
    { id: 'fund', label: '梦想基金', icon: '🏺', enabledInM0: false, enabledInM1: false },
    { id: 'settings', label: '设置', icon: '⚙️', enabledInM0: true, enabledInM1: true }
  ]
} as const;
