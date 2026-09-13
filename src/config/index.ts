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

/** M6 作品集验收预算：构建、运行测量与触控布局共同消费这一组阈值。 */
export const PERFORMANCE_BUDGETS = {
  FIRST_SCREEN_GZIP_MAX_BYTES: 6 * 1024 * 1024,
  TTI_MAX_MS: 5_000,
  MIN_FPS_1080P: 50,
  MIN_TOUCH_TARGET_PX: 44,
  FPS_SAMPLE_DURATION_MS: 5_000,
  FAST_4G_SIMULATION: {
    downloadBytesPerSecond: 512 * 1024,
    roundTripMs: 150
  },
  DESKTOP_VIEWPORT: { width: 1920, height: 1080 },
  MOBILE_LANDSCAPE_VIEWPORT: { width: 844, height: 390 }
} as const;

export const PLAYER_CONFIG = {
  SPEED: 240,
  WIDTH: 32,
  HEIGHT: 48,
  INITIAL_X: 610,
  INITIAL_Y: 650,
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

/** M4 成品光照：所有灯位和过渡数值集中在 config，场景逻辑只消费配置。 */
export const LIGHTING_CONFIG = {
  TRANSITION_PORTION: 0.18,
  NIGHT_MIN_GLOW_STRENGTH: 0.72,
  NIGHT_PULSE_SPEED: 1.4,
  NIGHT_PULSE_AMPLITUDE: 0.08,
  STRING_COLOR: 0x5d3b22,
  BULB_COLOR: 0xffd37a,
  BULB_CORE_RADIUS: 4,
  BULB_HALO_RADIUS: 34,
  BULB_CORE_ALPHA: 0.9,
  BULB_HALO_ALPHA: 0.16,
  STRING_WIDTH: 2,
  STRING_LIGHTS: [
    { x: 540, y: 38 }, { x: 590, y: 57 }, { x: 644, y: 74 },
    { x: 712, y: 80 }, { x: 781, y: 67 }, { x: 837, y: 44 },
    { x: 1028, y: 42 }, { x: 1100, y: 59 }, { x: 1162, y: 50 },
    { x: 1224, y: 76 }, { x: 1262, y: 45 }
  ],
  STRING_SEGMENTS: [
    [{ x: 515, y: 18 }, { x: 590, y: 57 }, { x: 712, y: 80 }, { x: 837, y: 44 }, { x: 880, y: 10 }],
    [{ x: 1002, y: 12 }, { x: 1100, y: 59 }, { x: 1224, y: 76 }, { x: 1300, y: 10 }]
  ]
} as const;

/** M4 音频混音与片段窗口；源文件与许可见 src/assets/audio/ATTRIBUTION.md。 */
export const AUDIO_CONFIG = {
  DEFAULT_MASTER_VOLUME: 0.72,
  DEFAULT_MUSIC_VOLUME: 0.42,
  DEFAULT_SFX_VOLUME: 0.82,
  VOLUME_STEP: 0.05,
  BGM_CROSSFADE_SECONDS: 1.8,
  BGM_SCHEDULE_AHEAD_SECONDS: 2.5,
  BGM_SCHEDULER_INTERVAL_MS: 500,
  START_LATENCY_SECONDS: 0.025,
  PREPARATION_SEQUENCE: [
    { id: 'grinder', delayMs: 0 },
    { id: 'extraction', delayMs: 1050 },
    { id: 'steam', delayMs: 2150 }
  ],
  SFX_WINDOWS: {
    grinder: { offsetSeconds: 0.25, durationSeconds: 1.4 },
    extraction: { offsetSeconds: 5.0, durationSeconds: 2.2 },
    steam: { offsetSeconds: 1.0, durationSeconds: 2.0 },
    cup: { offsetSeconds: 0, durationSeconds: 0.7 },
    purr: { offsetSeconds: 0.2, durationSeconds: 3.2 }
  }
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

export type ShopId = 'main' | 'seaside';

export interface ShopSceneDefinition {
  id: ShopId;
  name: string;
  backgroundKey: ShopId;
  sceneObjects: readonly SceneObjectConfig[];
  walkableZones: readonly Rect[];
  navWaypoints: readonly NavWaypoint[];
  navEdges: readonly NavEdge[];
  tableSeats: readonly TableSeatDef[];
  playerStart: Point;
  customerSpawn: Point;
  customerExit: Point;
  catEnabled: boolean;
}

export const SEASIDE_SCENE_OBJECTS: readonly SceneObjectConfig[] = [
  { id: 'window', name: '临海落地窗', x: 0, y: 30, width: 760, height: 390, color: 0x9fd8ea, interactPoint: { x: 600, y: 450 }, hitbox: { x: 0, y: 0, width: 770, height: 410 }, description: '潮声隔着玻璃轻轻涌来，远处的灯塔守着海面。' },
  { id: 'counter', name: '漂白木吧台', x: 860, y: 300, width: 500, height: 250, color: 0xd9c2a3, interactPoint: { x: 820, y: 520 }, hitbox: { x: 850, y: 285, width: 526, height: 280 }, description: '被海风吹成浅色的木吧台，摸起来温润光滑。' },
  { id: 'espresso_machine', name: '海蓝意式咖啡机', x: 1120, y: 245, width: 190, height: 130, color: 0x6f8992, interactPoint: { x: 1030, y: 500 }, hitbox: { x: 1100, y: 225, width: 220, height: 160 }, description: '在潮声里稳定地嘶嘶萃取。' },
  { id: 'pastry_case', name: '海边糕点柜', x: 900, y: 250, width: 190, height: 150, color: 0xd4a373, interactPoint: { x: 850, y: 500 }, hitbox: { x: 885, y: 235, width: 220, height: 180 }, description: '玻璃柜里的面包沾着清晨的暖光。' },
  { id: 'table_1', name: '临窗一号桌', x: 180, y: 400, width: 300, height: 150, color: 0xb58451, interactPoint: { x: 500, y: 520 }, hitbox: { x: 155, y: 380, width: 350, height: 190 }, description: '坐下就能望见灯塔的一桌。' },
  { id: 'table_2', name: '海景二号桌', x: 555, y: 330, width: 180, height: 100, color: 0xb58451, interactPoint: { x: 650, y: 475 }, hitbox: { x: 535, y: 310, width: 225, height: 140 }, description: '正对着海平线的安静双人桌。' },
  { id: 'table_3', name: '前厅三号桌', x: 0, y: 520, width: 365, height: 210, color: 0xb58451, interactPoint: { x: 390, y: 620 }, hitbox: { x: 0, y: 500, width: 390, height: 240 }, description: '贝壳灯旁边总有一小块阳光。' },
  { id: 'table_4', name: '前厅四号桌', x: 1030, y: 535, width: 346, height: 200, color: 0xb58451, interactPoint: { x: 980, y: 640 }, hitbox: { x: 1020, y: 515, width: 356, height: 235 }, description: '铺着海盐蓝坐垫的宽桌。' }
] as const;

export const SEASIDE_WALKABLE_ZONES: readonly Rect[] = [
  { x: 360, y: 430, width: 500, height: 290 },
  { x: 710, y: 450, width: 350, height: 220 },
  { x: 530, y: 390, width: 260, height: 130 },
  { x: 820, y: 500, width: 210, height: 100 }
] as const;

export const SEASIDE_NAV_WAYPOINTS: readonly NavWaypoint[] = [
  { id: 'sea_entry', name: '海边店入口', x: 680, y: 710 },
  { id: 'sea_center', name: '中央走道', x: 680, y: 570 },
  { id: 'sea_left', name: '临窗走道', x: 500, y: 520 },
  { id: 'sea_rear', name: '后窗桌旁', x: 650, y: 475 },
  { id: 'sea_counter_left', name: '糕点柜前', x: 850, y: 500 },
  { id: 'sea_counter_right', name: '咖啡机前', x: 1030, y: 500 },
  { id: 'sea_table3', name: '三号桌旁', x: 390, y: 620 },
  { id: 'sea_table4', name: '四号桌旁', x: 980, y: 640 }
] as const;

export const SEASIDE_NAV_EDGES: readonly NavEdge[] = [
  { from: 'sea_entry', to: 'sea_center' },
  { from: 'sea_center', to: 'sea_left' },
  { from: 'sea_center', to: 'sea_rear' },
  { from: 'sea_center', to: 'sea_counter_left' },
  { from: 'sea_center', to: 'sea_table3' },
  { from: 'sea_center', to: 'sea_table4' },
  { from: 'sea_rear', to: 'sea_counter_left' },
  { from: 'sea_counter_left', to: 'sea_counter_right' },
  { from: 'sea_counter_right', to: 'sea_table4' }
] as const;

export const SEASIDE_TABLE_SEATS: readonly TableSeatDef[] = [
  { id: 'sea_seat_1', tableId: 'table_1', name: '临窗一号桌', seatPos: { x: 365, y: 455 }, interactPoint: { x: 500, y: 520 } },
  { id: 'sea_seat_2', tableId: 'table_2', name: '海景二号桌', seatPos: { x: 710, y: 390 }, interactPoint: { x: 650, y: 475 } },
  { id: 'sea_seat_3', tableId: 'table_3', name: '前厅三号桌', seatPos: { x: 300, y: 600 }, interactPoint: { x: 390, y: 620 } },
  { id: 'sea_seat_4', tableId: 'table_4', name: '前厅四号桌', seatPos: { x: 1110, y: 610 }, interactPoint: { x: 980, y: 640 } }
] as const;

export interface CatSpotDef {
  id: string;
  name: string;
  pos: Point;
  interactPoint: Point;
}

export const CAT_SPOTS: readonly CatSpotDef[] = [
  {
    id: 'spot_table_4',
    name: '窗边猫窝软垫',
    pos: { x: 305, y: 375 },
    interactPoint: { x: 365, y: 455 }
  },
  {
    id: 'spot_table_3',
    name: '窗边一号桌椅',
    pos: { x: 430, y: 480 },
    interactPoint: { x: 540, y: 520 }
  },
  {
    id: 'spot_table_2',
    name: '中央二号桌旁',
    pos: { x: 720, y: 545 },
    interactPoint: { x: 850, y: 590 }
  },
  {
    id: 'spot_window',
    name: '阳光地板',
    pos: { x: 455, y: 590 },
    interactPoint: { x: 520, y: 625 }
  }
] as const;

export const CAT_CONFIG = {
  POSE_CHANGE_INTERVAL: 18,
  RELOCATE_INTERVAL: 75,
  BREATH_SPEED: 2.2,
  CLICK_PURR_DURATION: 3.5
} as const;

export const CAT_GIFT_CONFIG = {
  GOLD_AMOUNT: 12,
  FRAGMENT_AMOUNT: 1,
  FRAGMENT_CHANCE: 0.45,
  FRAGMENT_EXCHANGE_COST: 3
} as const;

export const CHAR_ANIM_CONFIG = {
  WALK_CYCLE_SPEED: 11,
  BODY_BOUNCE_AMPLITUDE: 2.6,
  BODY_TILT_AMPLITUDE: 0.05,
  LIMB_SWING_AMPLITUDE: 0.36,
  IDLE_BREATH_SPEED: 2.2,
  IDLE_BREATH_SCALE: 0.018,
  IDLE_TILT_SPEED_FACTOR: 0.5,
  IDLE_TILT_AMPLITUDE: 0.012,
  BREATH_WIDTH_FACTOR: 0.5,
  OWNER_WIDTH: 76,
  OWNER_HEIGHT: 238,
  CUSTOMER_WIDTH: 70,
  CUSTOMER_HEIGHT: 225,
  CUSTOMER_TINT_SOFTEN: 0.82,
  SHADOW_WIDTH: 24,
  SHADOW_HEIGHT: 7
} as const;

export const CUSTOMER_CONFIG = {
  SPAWN_INTERVAL_MIN: 10,
  SPAWN_INTERVAL_MAX: 20,
  MAX_ACTIVE_CUSTOMERS: 8,
  PATIENCE_SECONDS: 90,
  EAT_DURATION_SECONDS: 6,
  WALK_SPEED: 180,
  SPAWN_POS: { x: 150, y: 625 },
  EXIT_POS: { x: 128, y: 650 }
} as const;

export type MainSceneModuleAsset =
  | 'catNook'
  | 'counterBase'
  | 'equipmentStation'
  | 'storageShelf'
  | 'tableTwoSeat'
  | 'tableFourSeat';

export interface SceneModulePlacement {
  id: string;
  asset: MainSceneModuleAsset;
  x: number;
  y: number;
  width: number;
  anchorX: number;
  anchorY: number;
  depthOffset: number;
}

/** 2:1 斜投影模块布局。所有落点、尺寸和深度偏移只在配置层定义。 */
export const MAIN_2P5D_MODULES = {
  static: [
    { id: 'cat_nook', asset: 'catNook', x: 304, y: 397, width: 330, anchorX: 0.5, anchorY: 1, depthOffset: -18 },
    { id: 'storage_shelf', asset: 'storageShelf', x: 692, y: 340, width: 365, anchorX: 0.5, anchorY: 1, depthOffset: -22 },
    { id: 'counter', asset: 'counterBase', x: 1082, y: 460, width: 480, anchorX: 0.5, anchorY: 1, depthOffset: 0 },
    { id: 'equipment_station', asset: 'equipmentStation', x: 1082, y: 370, width: 245, anchorX: 0.5, anchorY: 1, depthOffset: 96 }
  ] as readonly SceneModulePlacement[],
  tableSlots: [
    { id: 'table_1', x: 430, y: 520, width: 205 },
    { id: 'table_2', x: 725, y: 585, width: 220 },
    { id: 'table_3', x: 1045, y: 650, width: 235 }
  ],
  depthBase: 1_000,
  shellDepth: -1_000,
  clickRippleDepth: 10_000,
  debugDepth: 20_000
} as const;

export const MAIN_2P5D_SCENE_OBJECTS: readonly SceneObjectConfig[] = [
  { id: 'door', name: '街角入口', x: 40, y: 390, width: 210, height: 300, color: 0xa06d44, interactPoint: { x: 165, y: 620 }, hitbox: { x: 20, y: 360, width: 235, height: 340 }, description: '推开门，街角的阳光正好落进来。' },
  { id: 'cat_nook', name: '橘猫窗边窝', x: 145, y: 260, width: 320, height: 165, color: 0xc48c58, interactPoint: { x: 365, y: 455 }, hitbox: { x: 130, y: 245, width: 350, height: 200 }, description: '铺着鼠尾草绿小毯的窗边窝。' },
  { id: 'storage_shelf', name: '咖啡储物架', x: 510, y: 160, width: 365, height: 205, color: 0x7a4622, interactPoint: { x: 690, y: 410 }, hitbox: { x: 500, y: 145, width: 390, height: 230 }, description: '杯子、豆罐和手写配方册都分门别类地收好。' },
  { id: 'counter', name: '蜂蜜木吧台', x: 835, y: 225, width: 490, height: 255, color: 0x8b5428, interactPoint: { x: 865, y: 505 }, hitbox: { x: 820, y: 210, width: 520, height: 285 }, description: '模块化吧台，工作位与取餐位清楚分开。' },
  { id: 'espresso_machine', name: '意式工作站', x: 970, y: 250, width: 260, height: 130, color: 0x475569, interactPoint: { x: 925, y: 505 }, hitbox: { x: 955, y: 230, width: 290, height: 155 }, description: '咖啡机、磨豆机和糕点柜组成的工作站。' },
  { id: 'pastry_case', name: '玻璃糕点柜', x: 1110, y: 280, width: 145, height: 110, color: 0xd4a373, interactPoint: { x: 990, y: 510 }, hitbox: { x: 1095, y: 265, width: 170, height: 130 }, description: '小小的玻璃柜里摆着今日烘焙。' },
  { id: 'table_1', name: '窗边一号桌', x: 320, y: 400, width: 220, height: 150, color: 0xb58451, interactPoint: { x: 540, y: 520 }, hitbox: { x: 305, y: 385, width: 245, height: 180 }, description: '窗边的安静座位。' },
  { id: 'table_2', name: '中央二号桌', x: 610, y: 455, width: 235, height: 165, color: 0xb58451, interactPoint: { x: 850, y: 590 }, hitbox: { x: 595, y: 440, width: 265, height: 195 }, description: '留出宽阔过道的中央座位。' },
  { id: 'table_3', name: '右侧三号桌', x: 920, y: 520, width: 250, height: 175, color: 0xb58451, interactPoint: { x: 900, y: 675 }, hitbox: { x: 905, y: 505, width: 280, height: 205 }, description: '靠近右墙、能听见磨豆声的一桌。' }
] as const;

export const MAIN_2P5D_WALKABLE_ZONES: readonly Rect[] = [
  { x: 115, y: 560, width: 1170, height: 155 },
  { x: 360, y: 420, width: 590, height: 210 },
  { x: 780, y: 465, width: 280, height: 180 }
] as const;

export const MAIN_2P5D_NAV_WAYPOINTS: readonly NavWaypoint[] = [
  { id: 'entry', name: '入口', x: 150, y: 635 },
  { id: 'left_aisle', name: '窗边走道', x: 340, y: 610 },
  { id: 'center', name: '中央主道', x: 610, y: 650 },
  { id: 'center_back', name: '中央后道', x: 600, y: 455 },
  { id: 'counter_left', name: '吧台左侧', x: 865, y: 505 },
  { id: 'counter_mid', name: '工作站前', x: 950, y: 535 },
  { id: 'table_1_front', name: '一号桌旁', x: 540, y: 520 },
  { id: 'table_2_front', name: '二号桌旁', x: 850, y: 590 },
  { id: 'table_3_front', name: '三号桌旁', x: 900, y: 675 },
  { id: 'right_aisle', name: '右侧通道', x: 1190, y: 680 }
] as const;

export const MAIN_2P5D_NAV_EDGES: readonly NavEdge[] = [
  { from: 'entry', to: 'left_aisle' }, { from: 'left_aisle', to: 'center' },
  { from: 'left_aisle', to: 'table_1_front' }, { from: 'center', to: 'center_back' },
  { from: 'center', to: 'table_2_front' }, { from: 'center', to: 'table_3_front' },
  { from: 'center_back', to: 'counter_left' }, { from: 'counter_left', to: 'counter_mid' },
  { from: 'table_2_front', to: 'counter_mid' }, { from: 'table_2_front', to: 'table_3_front' },
  { from: 'table_3_front', to: 'right_aisle' }
] as const;

export const MAIN_2P5D_TABLE_SEATS: readonly TableSeatDef[] = [
  { id: 'table_1_a', tableId: 'table_1', name: '窗边一号桌 A', seatPos: { x: 388, y: 470 }, interactPoint: { x: 540, y: 520 } },
  { id: 'table_1_b', tableId: 'table_1', name: '窗边一号桌 B', seatPos: { x: 475, y: 525 }, interactPoint: { x: 540, y: 520 } },
  { id: 'table_1_c', tableId: 'table_1', name: '窗边一号桌 C', seatPos: { x: 350, y: 510 }, interactPoint: { x: 540, y: 520 } },
  { id: 'table_1_d', tableId: 'table_1', name: '窗边一号桌 D', seatPos: { x: 500, y: 480 }, interactPoint: { x: 540, y: 520 } },
  { id: 'table_2_a', tableId: 'table_2', name: '中央二号桌 A', seatPos: { x: 680, y: 535 }, interactPoint: { x: 850, y: 590 } },
  { id: 'table_2_b', tableId: 'table_2', name: '中央二号桌 B', seatPos: { x: 770, y: 590 }, interactPoint: { x: 850, y: 590 } },
  { id: 'table_2_c', tableId: 'table_2', name: '中央二号桌 C', seatPos: { x: 645, y: 575 }, interactPoint: { x: 850, y: 590 } },
  { id: 'table_2_d', tableId: 'table_2', name: '中央二号桌 D', seatPos: { x: 800, y: 545 }, interactPoint: { x: 850, y: 590 } },
  { id: 'table_3_a', tableId: 'table_3', name: '右侧三号桌 A', seatPos: { x: 995, y: 600 }, interactPoint: { x: 900, y: 675 } },
  { id: 'table_3_b', tableId: 'table_3', name: '右侧三号桌 B', seatPos: { x: 1090, y: 650 }, interactPoint: { x: 900, y: 675 } },
  { id: 'table_3_c', tableId: 'table_3', name: '右侧三号桌 C', seatPos: { x: 950, y: 645 }, interactPoint: { x: 900, y: 675 } },
  { id: 'table_3_d', tableId: 'table_3', name: '右侧三号桌 D', seatPos: { x: 1125, y: 610 }, interactPoint: { x: 900, y: 675 } }
] as const;

export const FURNITURE_EXPANSION_CONFIG = {
  table: [
    { level: 0, name: '留白空间', cost: 0, seats: 0, asset: null, operationsImpact: '暂不接待顾客，保留宽敞动线。' },
    { level: 1, name: '温暖双人桌', cost: 90, seats: 2, asset: 'tableTwoSeat', operationsImpact: '增加 2 个座位，可同时接待更多客人。' },
    { level: 2, name: '绘本四人桌', cost: 180, seats: 4, asset: 'tableFourSeat', operationsImpact: '升级为 4 个座位，提升店内并发接待量。' }
  ],
  counter: [
    { level: 0, name: '基础吧台', cost: 0, workstations: 1, pickupSlots: 1, prepEfficiency: 1, operationsImpact: '1 个制作位与 1 个取餐位。' },
    { level: 1, name: '备餐延展台', cost: 240, workstations: 1, pickupSlots: 2, prepEfficiency: 1.08, operationsImpact: '增加备餐面与第 2 个等候位。' },
    { level: 2, name: '双工作站', cost: 420, workstations: 2, pickupSlots: 2, prepEfficiency: 1.16, operationsImpact: '店主与店员可并行制作。' },
    { level: 3, name: '完整暖木吧台', cost: 680, workstations: 2, pickupSlots: 3, prepEfficiency: 1.24, operationsImpact: '加入糕点展示与一个装饰槽。' }
  ],
  defaultTableLevels: { table_1: 1, table_2: 1, table_3: 1 },
  defaultCounterLevel: 0,
  counterVisuals: {
    bodyWidths: [480, 500, 525, 550],
    equipmentWidths: [210, 225, 238, 245],
    secondaryStation: { x: 1215, y: 365, width: 155, fromLevel: 2, depthOffset: 102 }
  },
  insufficientGoldCopy: '钱箱还差一点点，先招待几位客人再来看看吧。',
  purchaseSuccessCopy: '新家具已经稳稳摆好，随时都能免费移动或收起。'
} as const;

export const SHOP_SCENES: Record<ShopId, ShopSceneDefinition> = {
  main: {
    id: 'main',
    name: '街角本店',
    backgroundKey: 'main',
    sceneObjects: MAIN_2P5D_SCENE_OBJECTS,
    walkableZones: MAIN_2P5D_WALKABLE_ZONES,
    navWaypoints: MAIN_2P5D_NAV_WAYPOINTS,
    navEdges: MAIN_2P5D_NAV_EDGES,
    tableSeats: MAIN_2P5D_TABLE_SEATS,
    playerStart: { x: PLAYER_CONFIG.INITIAL_X, y: PLAYER_CONFIG.INITIAL_Y },
    customerSpawn: CUSTOMER_CONFIG.SPAWN_POS,
    customerExit: CUSTOMER_CONFIG.EXIT_POS,
    catEnabled: true
  },
  seaside: {
    id: 'seaside',
    name: '海风分店',
    backgroundKey: 'seaside',
    sceneObjects: SEASIDE_SCENE_OBJECTS,
    walkableZones: SEASIDE_WALKABLE_ZONES,
    navWaypoints: SEASIDE_NAV_WAYPOINTS,
    navEdges: SEASIDE_NAV_EDGES,
    tableSeats: SEASIDE_TABLE_SEATS,
    playerStart: { x: 680, y: 680 },
    customerSpawn: { x: 680, y: 730 },
    customerExit: { x: 680, y: 730 },
    catEnabled: false
  }
};

export const BRANCH_CONFIG = {
  SEASIDE_UNLOCK_COST: 1200,
  SEASIDE_PREREQUISITE_ACHIEVEMENT_IDS: ['ach_lines_3', 'ach_regulars_5'],
  SHOP_PRIORITY: ['main', 'seaside'] as readonly ShopId[]
} as const;

export const SHOP_SIMULATION_CONFIG = {
  FIXED_TIMESTEP_MS: 100,
  INITIAL_CUSTOMER_DELAY_MS: 2_000,
  CUSTOMER_INTERVAL_MIN_MS: 10_000,
  CUSTOMER_INTERVAL_MAX_MS: 20_000,
  MAX_CUSTOMERS: 4,
  PATIENCE_MS: 90_000,
  ENJOY_MS: 6_000,
  LEAVE_MS: 2_000,
  MAIN_RNG_SEED: 0x1a2b3c4d,
  SEASIDE_RNG_SEED: 0x5e6f7788,
  PLAYER_EXECUTOR_ID: 'player',
  AUTONOMOUS_DUTIES: ['TAKE_ORDER', 'BREW', 'SERVE', 'CHECKOUT']
} as const;

export const WORLD_IDLE_CONFIG = {
  MAX_ELAPSED_MS_PER_SHOP: CLOCK_CONFIG.OFFLINE_MAX_SECONDS * 1000,
  DECOR_INTERVAL_REDUCTION_PER_OWNED_VARIANT: 0.025,
  MAX_DECOR_INTERVAL_REDUCTION: 0.2,
  MIN_CUSTOMER_INTERVAL_MULTIPLIER: 0.8
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
  CURRENT_VERSION: 2,
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
    { id: 'recipes', label: '配方', icon: '📖', enabledInM0: false, enabledInM1: true, enabledInM3: true },
    { id: 'supply', label: '进货', icon: '📦', enabledInM0: false, enabledInM1: true, enabledInM3: true },
    { id: 'decor', label: '装修', icon: '🛋️', enabledInM0: false, enabledInM1: false, enabledInM3: true },
    { id: 'handbook', label: '图鉴', icon: '📕', enabledInM0: false, enabledInM1: false, enabledInM3: true },
    { id: 'staff', label: '店员', icon: '🧑‍🍳', enabledInM0: false, enabledInM1: false, enabledInM3: true },
    { id: 'map', label: '分店地图', icon: '🗺️', enabledInM0: false, enabledInM1: false, enabledInM3: false, enabledInM5: true },
    { id: 'fund', label: '梦想基金', icon: '🏺', enabledInM0: false, enabledInM1: false, enabledInM3: true },
    { id: 'settings', label: '设置', icon: '⚙️', enabledInM0: true, enabledInM1: true, enabledInM3: true }
  ]
} as const;

// ==================== M3 经营厚度：设备升级 (T3.2) ====================

export interface EquipmentLevelDef {
  level: number;
  label: string;
  description: string;
  brewSpeedMultiplier: number;
  brewSlots: number;
  upgradeCost: number;
}

export const EQUIPMENT_LEVELS: readonly EquipmentLevelDef[] = [
  {
    level: 1,
    label: '家用单头咖啡机',
    description: '开店时的老家伙，一次只能萃一杯。',
    brewSpeedMultiplier: 1,
    brewSlots: 1,
    upgradeCost: 0
  },
  {
    level: 2,
    label: '商用双头咖啡机',
    description: '双头并行萃取，同时做两杯；出品快 25%。',
    brewSpeedMultiplier: 0.75,
    brewSlots: 2,
    upgradeCost: 300
  },
  {
    level: 3,
    label: '大师级双头咖啡机',
    description: '温控与压力俱佳，出品快 45%，依旧双杯并行。',
    brewSpeedMultiplier: 0.55,
    brewSlots: 2,
    upgradeCost: 600
  }
] as const;

// ==================== M3 经营厚度：店员 (T3.5) ====================

export type StaffDuty = 'TAKE_ORDER' | 'BREW' | 'SERVE' | 'CHECKOUT' | 'AUTO_SUPPLY';

export const STAFF_CONFIG = {
  HIRE_FEE: 200,
  WAGE_RATE: 0.1,
  AUTO_SUPPLY_THRESHOLD: 4,
  AUTO_SUPPLY_COOLDOWN_SECONDS: 20,
  TASK_DURATIONS: {
    TAKE_ORDER: 1.2,
    SERVE: 2.0,
    CHECKOUT: 1.5
  },
  DUTY_LABELS: {
    TAKE_ORDER: '接单',
    BREW: '制作',
    SERVE: '上菜',
    CHECKOUT: '收银',
    AUTO_SUPPLY: '自动补货'
  } as Record<StaffDuty, string>,
  WORK_ANCHOR: { x: 860, y: 470 } // 吧台内侧工作位
} as const;

export interface StaffStoryChapter {
  id: string;
  title: string;
  text: string;
  trigger: 'on_hire' | 'first_auto_order' | 'orders_10';
}

export const STAFF_MEMBER_DEF = {
  id: 'staff_xiaoqing',
  name: '小晴',
  job: '兼职店员 / 美院学生',
  portraitIcon: '🧑‍🎨',
  description: '美院插画系的学生，课余来店里帮忙，总说店里的光线最适合画画。',
  stories: [
    {
      id: 'staff_story_1',
      title: '第一天的围裙',
      text: '小晴系上围裙时还有点手忙脚乱："我会好好记住每位客人喜欢的味道的！"她把配方手册翻得卷了边。',
      trigger: 'on_hire'
    },
    {
      id: 'staff_story_2',
      title: '偷画的速写',
      text: '打烊前你发现吧台上多了一张速写：橘猫趴在桌上，你端着杯子笑。小晴吐了吐舌头："练笔而已啦。"',
      trigger: 'first_auto_order'
    },
    {
      id: 'staff_story_3',
      title: '想留下来',
      text: '"其实……毕业以后我也想开一家这样的店。"小晴擦着杯子轻声说，"在这里打工，像提前遇见了未来的自己。"',
      trigger: 'orders_10'
    }
  ] as StaffStoryChapter[]
} as const;

// ==================== M3 经营厚度：梦想基金 (T3.6) ====================

export interface FundTierDef {
  id: string;
  label: string;
  minOrders: number;
  minRevenue: number;
  minStories: number;
  cap: number;
}

export const FUND_CONFIG = {
  REPAYMENT_RATE: 0.1,
  APPLY_AMOUNTS: [100, 300, 600],
  TIERS: [
    { id: 'tier_0', label: '起步阶段', minOrders: 0, minRevenue: 0, minStories: 0, cap: 200 },
    { id: 'tier_1', label: '小有名气', minOrders: 15, minRevenue: 400, minStories: 0, cap: 500 },
    { id: 'tier_2', label: '街坊挚爱', minOrders: 40, minRevenue: 1500, minStories: 2, cap: 1000 },
    { id: 'tier_3', label: '梦想启航', minOrders: 90, minRevenue: 4000, minStories: 5, cap: 2200 }
  ] as readonly FundTierDef[],
  SENIOR_NAME: '支持开店的前辈'
} as const;

// ==================== M3 经营厚度：常客 (T3.3) ====================

export interface RegularStorySnippet {
  id: string;
  title: string;
  text: string;
  favorRequired: number;
}

export interface RegularDef {
  id: string;
  name: string;
  job: string;
  portraitIcon: string;
  description: string;
  preferredRecipeId: string;
  exclusiveRecipeId: string;
  exclusiveFavorRequired: number;
  favorPerVisit: number;
  color: number;
  stories: RegularStorySnippet[];
}

/** 常客专属点单：不入配方树、不解锁售卖，仅对应常客好感达标后偶尔点单 */
export interface ExclusiveRecipeDef {
  id: string;
  regularId: string;
  name: string;
  ingredients: Record<string, number>;
  price: number;
  brewTimeSeconds: number;
}

export const EXCLUSIVE_RECIPE_DEFS: readonly ExclusiveRecipeDef[] = [
  { id: 'ex_caramel_cloud', regularId: 'regular_linwan', name: '焦糖云朵拿铁', ingredients: { coffee_beans: 1, milk: 1, syrup: 1 }, price: 40, brewTimeSeconds: 4.0 },
  { id: 'ex_orange_americano', regularId: 'regular_laozhou', name: '陈皮美式', ingredients: { coffee_beans: 1, fruits: 1 }, price: 30, brewTimeSeconds: 3.2 },
  { id: 'ex_jasmine_honey', regularId: 'regular_susu', name: '茉莉蜜露', ingredients: { tea_leaves: 1, syrup: 1 }, price: 32, brewTimeSeconds: 3.0 },
  { id: 'ex_double_espresso', regularId: 'regular_akai', name: '深夜双倍浓缩', ingredients: { coffee_beans: 2 }, price: 26, brewTimeSeconds: 3.5 },
  { id: 'ex_peach_sparkle', regularId: 'regular_xiaoya', name: '蜜桃气泡乌龙', ingredients: { tea_leaves: 1, fruits: 1, syrup: 1 }, price: 42, brewTimeSeconds: 4.2 }
] as const;

export const REGULAR_DEFS: readonly RegularDef[] = [
  {
    id: 'regular_linwan',
    name: '林晚',
    job: '自由插画师',
    portraitIcon: '👩‍🎨',
    description: '总坐在靠窗的位置画速写，画里最常出现的是那只橘猫。',
    preferredRecipeId: 'latte',
    exclusiveRecipeId: 'ex_caramel_cloud',
    exclusiveFavorRequired: 10,
    favorPerVisit: 2,
    color: 0xe84393,
    stories: [
      { id: 'linwan_s1', title: '速写本里的猫', favorRequired: 2, text: '“你的猫比模特还专业。”林晚把速写本转给你看——一整页都是橘猫的各种睡姿。' },
      { id: 'linwan_s2', title: '截稿日的港湾', favorRequired: 6, text: '截稿日前夜，林晚抱着电脑冲进店里：“老样子！只有这里的拿铁能救我的稿子。”' },
      { id: 'linwan_s3', title: '一张小画', favorRequired: 14, text: '林晚临走前留下一张小画：晨光里的咖啡馆门口，招牌下写着“每日研磨”。“送你，挂在吧台后面吧。”' }
    ]
  },
  {
    id: 'regular_laozhou',
    name: '老周',
    job: '退休语文教师',
    portraitIcon: '👴',
    description: '每天下午准时出现，点一杯美式，读一小时旧书。',
    preferredRecipeId: 'americano',
    exclusiveRecipeId: 'ex_orange_americano',
    exclusiveFavorRequired: 10,
    favorPerVisit: 2,
    color: 0x6c5ce7,
    stories: [
      { id: 'laozhou_s1', title: '旧书与美式', favorRequired: 2, text: '老周推了推老花镜：“美式要烫一点才好，就像旧书要慢慢读。”' },
      { id: 'laozhou_s2', title: '讲台下的故事', favorRequired: 6, text: '“以前站讲台，总盼着下课铃。”老周笑了笑，“现在倒好，盼着你们店门早点开。”' },
      { id: 'laozhou_s3', title: '陈皮的心意', favorRequired: 14, text: '老周从布包里掏出一小罐自家晒的陈皮：“泡在美式里试试？这是我老伴儿以前的喝法。”' }
    ]
  },
  {
    id: 'regular_susu',
    name: '苏苏',
    job: '隔壁花店店主',
    portraitIcon: '👩‍🌾',
    description: '指尖总带着淡淡的花香，会顺手帮你把窗台的绿植修剪整齐。',
    preferredRecipeId: 'jasmine_tea',
    exclusiveRecipeId: 'ex_jasmine_honey',
    exclusiveFavorRequired: 10,
    favorPerVisit: 2,
    color: 0x00b894,
    stories: [
      { id: 'susu_s1', title: '顺手修的枝叶', favorRequired: 2, text: '“你窗台那盆龟背竹有点徒长了。”苏苏变戏法似的拿出小剪刀，三两下修出漂亮的造型。' },
      { id: 'susu_s2', title: '花与茶的共性', favorRequired: 6, text: '“养花和泡茶一样，”苏苏捧着茉莉清茶，“都要等，急不得。”' },
      { id: 'susu_s3', title: '一束无名小花', favorRequired: 14, text: '打烊时吧台上多了一束小雏菊，卡片上写着：“给街角最温暖的店。——苏苏”' }
    ]
  },
  {
    id: 'regular_akai',
    name: '阿凯',
    job: '独立游戏开发者',
    portraitIcon: '👨‍💻',
    description: '背着贴满贴纸的电脑包，据说在做一款“关于等待的游戏”。',
    preferredRecipeId: 'espresso',
    exclusiveRecipeId: 'ex_double_espresso',
    exclusiveFavorRequired: 10,
    favorPerVisit: 2,
    color: 0x0984e3,
    stories: [
      { id: 'akai_s1', title: '浓缩续命', favorRequired: 2, text: '阿凯顶着黑眼圈推开门：“浓缩，双份……不，先来单份，我怕心跳过速。”' },
      { id: 'akai_s2', title: 'bug 与奶泡', favorRequired: 6, text: '“你知道吗，调奶泡和调 bug 一个道理，”阿凯盯着杯子，“温度不对，全盘皆输。”' },
      { id: 'akai_s3', title: '游戏的彩蛋', favorRequired: 14, text: '“我的游戏快做完了。”阿凯难得地笑了，“彩蛋里有一家咖啡馆，长得像这里。”' }
    ]
  },
  {
    id: 'regular_xiaoya',
    name: '小雅',
    job: '考研备考生',
    portraitIcon: '👧',
    description: '总带着一摞参考书，困了就趴在桌上小睡十分钟。',
    preferredRecipeId: 'peach_oolong',
    exclusiveRecipeId: 'ex_peach_sparkle',
    exclusiveFavorRequired: 10,
    favorPerVisit: 2,
    color: 0xfdcb6e,
    stories: [
      { id: 'xiaoya_s1', title: '十分钟的小睡', favorRequired: 2, text: '小雅趴在参考书上一觉睡到饮品凉掉，醒来慌忙道歉。你默默帮她换了一杯热的。' },
      { id: 'xiaoya_s2', title: '倒计时的日子', favorRequired: 6, text: '“还有一百天。”小雅在杯套上写了个小小的数字，“考完了我要来店里打一天游戏！”' },
      { id: 'xiaoya_s3', title: '放榜的消息', favorRequired: 14, text: '小雅举着手机冲进来，屏幕上是录取通知：“第一家就想来这里庆祝！”' }
    ]
  }
] as const;

export const REGULAR_CONFIG = {
  SPAWN_CHANCE: 0.45,
  EXCLUSIVE_ORDER_CHANCE: 0.5,
  EXCLUSIVE_RECIPE_PREFIX: 'ex_'
} as const;

// ==================== M3 经营厚度：装修 (T3.1) ====================

export interface DecorVariantDef {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export interface DecorSlotDef {
  id: string;
  name: string;
  sceneObjectId: string;
  icon: string;
  variants: DecorVariantDef[];
}

export const DECOR_SLOTS: readonly DecorSlotDef[] = [
  {
    id: 'slot_window_plants', name: '窗台绿植', sceneObjectId: 'window', icon: '🪴',
    variants: [
      { id: 'plant_monstera', name: '龟背竹与蕨丛', cost: 0, description: '开店时就有的老伙计们。' },
      { id: 'plant_pothos', name: '垂蔓绿萝', cost: 80, description: '垂下来的绿瀑布，风一吹轻轻晃。' },
      { id: 'plant_succulent', name: '多肉拼盘', cost: 120, description: '一排圆滚滚的小多肉，治愈力满分。' }
    ]
  },
  {
    id: 'slot_door', name: '门口装饰', sceneObjectId: 'door', icon: '🚪',
    variants: [
      { id: 'door_wood', name: '原木玻璃门', cost: 0, description: '朴素耐看的木框玻璃门。' },
      { id: 'door_lace', name: '蕾丝半帘', cost: 60, description: '阳光透过蕾丝洒下细碎的光斑。' },
      { id: 'door_wreath', name: '干花花环', cost: 100, description: '苏苏帮忙编的干花门环，带着淡香。' }
    ]
  },
  {
    id: 'slot_counter', name: '吧台台面', sceneObjectId: 'counter', icon: '🪵',
    variants: [
      { id: 'counter_oak', name: '原木吧台', cost: 0, description: '被擦得发亮的原木台面。' },
      { id: 'counter_walnut', name: '胡桃木吧台', cost: 150, description: '深色胡桃木，衬得咖啡杯更温润。' },
      { id: 'counter_cream', name: '奶油白吧台', cost: 200, description: '明亮的奶油色，店里一下子轻快起来。' }
    ]
  },
  {
    id: 'slot_pastry', name: '糕点柜', sceneObjectId: 'pastry_case', icon: '🥐',
    variants: [
      { id: 'pastry_glass', name: '玻璃展柜', cost: 0, description: '通透的玻璃柜，牛角包一览无余。' },
      { id: 'pastry_copper', name: '复古铜框柜', cost: 90, description: '铜框带着岁月的温度。' }
    ]
  },
  {
    id: 'slot_table_1', name: '1号桌样式', sceneObjectId: 'table_1', icon: '🪑',
    variants: [
      { id: 'table_wood', name: '原木方桌', cost: 0, description: '结实耐用的原木桌。' },
      { id: 'table_cloth', name: '布艺桌布', cost: 70, description: '铺上米色桌布，杯子放上去都安静了。' },
      { id: 'table_iron', name: '复古铁艺桌', cost: 110, description: '铸铁桌脚，有点欧洲街角的味道。' }
    ]
  },
  {
    id: 'slot_table_2', name: '2号桌样式', sceneObjectId: 'table_2', icon: '🪑',
    variants: [
      { id: 'table_wood', name: '原木方桌', cost: 0, description: '结实耐用的原木桌。' },
      { id: 'table_cloth', name: '布艺桌布', cost: 70, description: '铺上米色桌布，杯子放上去都安静了。' },
      { id: 'table_iron', name: '复古铁艺桌', cost: 110, description: '铸铁桌脚，有点欧洲街角的味道。' }
    ]
  },
  {
    id: 'slot_table_3', name: '3号桌样式', sceneObjectId: 'table_3', icon: '🪑',
    variants: [
      { id: 'table_wood', name: '原木方桌', cost: 0, description: '结实耐用的原木桌。' },
      { id: 'table_cloth', name: '布艺桌布', cost: 70, description: '铺上米色桌布，杯子放上去都安静了。' }
    ]
  },
  {
    id: 'slot_bookshelf', name: '右侧书架', sceneObjectId: 'bookshelf_right', icon: '📚',
    variants: [
      { id: 'shelf_dark', name: '深木书架', cost: 0, description: '高到屋顶的深色书架。' },
      { id: 'shelf_ladder', name: '阶梯书架', cost: 130, description: '带小梯子，最上层的画册也能够到。' }
    ]
  }
] as const;

export const SEASIDE_DECOR_SLOTS: readonly DecorSlotDef[] = [
  {
    id: 'sea_slot_table_1',
    name: '临窗桌摆件',
    sceneObjectId: 'table_1',
    icon: '🐚',
    variants: [
      { id: 'sea_table_clear', name: '清爽木桌', cost: 0, description: '把海景完整留在桌面上。' },
      { id: 'sea_shells', name: '海玻璃贝壳盏', cost: 120, description: '散步时拾来的贝壳，盛在海玻璃浅盏里。' }
    ]
  },
  {
    id: 'sea_slot_table_3',
    name: '前厅桌灯',
    sceneObjectId: 'table_3',
    icon: '🏮',
    variants: [
      { id: 'sea_lamp_clear', name: '午后自然光', cost: 0, description: '海风和日光就是最好的装饰。' },
      { id: 'sea_lantern', name: '藤编海蓝灯', cost: 140, description: '入夜后亮起一小团安静的海蓝色。' }
    ]
  }
] as const;

export interface DecorThemeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  tintColor: number;
  tintAlpha: number;
}

export const DECOR_THEMES: readonly DecorThemeDef[] = [
  { id: 'theme_wood', name: '暖阳原木', description: '开店之初的温暖木色。', cost: 0, tintColor: 0x000000, tintAlpha: 0 },
  { id: 'theme_matcha', name: '抹茶清新', description: '淡淡的抹茶绿，像雨后的庭院。', cost: 150, tintColor: 0xa8d5a2, tintAlpha: 0.08 },
  { id: 'theme_dusk', name: '暮色紫藤', description: '紫藤花架下的黄昏色调。', cost: 150, tintColor: 0xb8a9d9, tintAlpha: 0.08 },
  { id: 'theme_sea', name: '海盐蓝调', description: '一点点海盐蓝，预告远方的分店。', cost: 200, tintColor: 0xa9d0e8, tintAlpha: 0.08 }
] as const;

export const SEASIDE_DECOR_THEMES: readonly DecorThemeDef[] = [
  { id: 'sea_theme_breeze', name: '晴日海风', description: '分店最初的明亮海盐色。', cost: 0, tintColor: 0x000000, tintAlpha: 0 },
  { id: 'sea_theme_coral', name: '晚霞珊瑚', description: '浅浅珊瑚粉映在漂白木上。', cost: 220, tintColor: 0xf0a58c, tintAlpha: 0.08 }
] as const;

// ==================== M3 经营厚度：成就 (T3.7) ====================

export type AchievementCategory = 'business' | 'relation' | 'collection' | 'branch';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  isBranchPrerequisite?: boolean;
  condition:
    | { type: 'completedOrders'; threshold: number }
    | { type: 'totalRevenue'; threshold: number }
    | { type: 'unlockedLines'; threshold: number }
    | { type: 'regularsFavor'; count: number; favor: number }
    | { type: 'storiesSeen'; threshold: number }
    | { type: 'ownedVariants'; threshold: number }
    | { type: 'catPoses'; threshold: number };
  reward: { gold: number } | { badge: string };
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  {
    id: 'ach_first_order', category: 'business', name: '第一杯的心意',
    description: '完成第 1 笔订单。',
    condition: { type: 'completedOrders', threshold: 1 }, reward: { gold: 20 }
  },
  {
    id: 'ach_orders_10', category: 'business', name: '渐入佳境',
    description: '累计完成 10 笔订单。',
    condition: { type: 'completedOrders', threshold: 10 }, reward: { gold: 60 }
  },
  {
    id: 'ach_revenue_500', category: 'business', name: '小小营业额',
    description: '累计营业收入达到 500 金币。',
    condition: { type: 'totalRevenue', threshold: 500 }, reward: { gold: 80 }
  },
  {
    id: 'ach_story_1', category: 'relation', name: '倾听者',
    description: '读到第 1 段常客或店员的故事。',
    condition: { type: 'storiesSeen', threshold: 1 }, reward: { gold: 30 }
  },
  {
    id: 'ach_regular_friend', category: 'relation', name: '老街坊',
    description: '任意 1 位常客好感达到 10。',
    condition: { type: 'regularsFavor', count: 1, favor: 10 }, reward: { gold: 50 }
  },
  {
    id: 'ach_decor_3', category: 'collection', name: '布置一新',
    description: '拥有 3 件装修款式。',
    condition: { type: 'ownedVariants', threshold: 3 }, reward: { gold: 40 }
  },
  {
    id: 'ach_cat_poses', category: 'collection', name: '猫的睡姿收藏家',
    description: '见过橘猫 2 种不同的睡姿。',
    condition: { type: 'catPoses', threshold: 2 }, reward: { gold: 30 }
  },
  {
    id: 'ach_lines_3', category: 'branch', name: '三线齐备', isBranchPrerequisite: true,
    description: '三条配方线各解锁至少 1 款（分店前置）。',
    condition: { type: 'unlockedLines', threshold: 3 }, reward: { badge: 'master_menu' }
  },
  {
    id: 'ach_regulars_5', category: 'branch', name: '大家的店', isBranchPrerequisite: true,
    description: '5 位常客好感均达到 20（分店前置）。',
    condition: { type: 'regularsFavor', count: 5, favor: 20 }, reward: { badge: 'beloved_shop' }
  }
] as const;
