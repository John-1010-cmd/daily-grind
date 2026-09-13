import {
  AUDIO_CONFIG,
  FURNITURE_EXPANSION_CONFIG,
  INITIAL_INVENTORY,
  PLAYER_CONFIG,
  SAVE_CONFIG,
  SHOP_SIMULATION_CONFIG,
  ShopId
} from '../config';
import type { ShopSimulationState, SimOrderStage } from '../shop/types';

export interface FundLoanState {
  id: string;
  amount: number;
  repaid: number;
  appliedAt: number;
}

export interface RegularState {
  favor: number;
  visits: number;
  storiesSeen: string[];
}

export interface DecorSaveState {
  slotVariants: Record<string, string>;
  ownedVariants: string[];
  ownedThemes: string[];
  theme: string;
}

export interface ShopSaveState {
  unlocked: boolean;
  player: { x: number; y: number };
  lastSettledAt: number;
  simulation: ShopSimulationState;
  furniture: FurnitureSaveState;
}

export interface FurnitureSaveState {
  tableLevels: Record<string, number>;
  counterLevel: number;
  ownedUpgrades: string[];
}

export interface WorldSaveState {
  activeShopId: ShopId;
  shops: {
    main: ShopSaveState;
    seaside: ShopSaveState & { decor: DecorSaveState };
  };
}

export interface SaveStateV2 {
  version: 2;
  gold: number;
  player: {
    x: number;
    y: number;
  };
  activePlayTime: number;
  lastSavedAt: number;
  inventory: Record<string, number>;
  unlockedRecipes: string[];
  recipeMastery: Record<string, number>;
  placedFurniture: string[];
  settings: {
    debugNavOverlay: boolean;
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    muted: boolean;
  };
  // ---- M3 新增 ----
  decor: DecorSaveState;
  equipmentLevel: number;
  regulars: Record<string, RegularState>;
  staff: {
    hired: boolean;
    duties: string[];
    storiesSeen: string[];
    autoOrdersCompleted: number;
  };
  fund: {
    loans: FundLoanState[];
    totalBorrowed: number;
  };
  achievements: string[];
  stats: {
    completedOrders: number;
    totalRevenue: number;
  };
  catPosesSeen: string[];
  cat: {
    lastGiftDate: string | null;
    decorationFragments: number;
  };
  // ---- M5 分店链路（保持 schema v2 的向后兼容增量字段）----
  world: WorldSaveState;
}

export type SaveStateV1Legacy = Omit<SaveStateV2, 'version' | 'decor' | 'equipmentLevel' | 'regulars' | 'staff' | 'fund' | 'achievements' | 'stats' | 'catPosesSeen'> & { version: 1 };

export type SaveState = SaveStateV2;

export const DEFAULT_SAVE_STATE: SaveStateV2 = {
  version: 2,
  gold: SAVE_CONFIG.INITIAL_GOLD,
  player: {
    x: PLAYER_CONFIG.INITIAL_X,
    y: PLAYER_CONFIG.INITIAL_Y
  },
  activePlayTime: 0,
  lastSavedAt: Date.now(),
  inventory: { ...INITIAL_INVENTORY },
  unlockedRecipes: ['espresso'],
  recipeMastery: { espresso: 0 },
  placedFurniture: ['default_chair', 'default_table'],
  settings: {
    debugNavOverlay: false,
    masterVolume: AUDIO_CONFIG.DEFAULT_MASTER_VOLUME,
    musicVolume: AUDIO_CONFIG.DEFAULT_MUSIC_VOLUME,
    sfxVolume: AUDIO_CONFIG.DEFAULT_SFX_VOLUME,
    muted: false
  },
  decor: {
    slotVariants: {},
    ownedVariants: [],
    ownedThemes: ['theme_wood'],
    theme: 'theme_wood'
  },
  equipmentLevel: 1,
  regulars: {},
  staff: {
    hired: false,
    duties: [],
    storiesSeen: [],
    autoOrdersCompleted: 0
  },
  fund: {
    loans: [],
    totalBorrowed: 0
  },
  achievements: [],
  stats: {
    completedOrders: 0,
    totalRevenue: 0
  },
  catPosesSeen: [],
  cat: {
    lastGiftDate: null,
    decorationFragments: 0
  },
  world: {
    activeShopId: 'main',
    shops: {
      main: {
        unlocked: true,
        player: { x: PLAYER_CONFIG.INITIAL_X, y: PLAYER_CONFIG.INITIAL_Y },
        lastSettledAt: 0,
        furniture: {
          tableLevels: { ...FURNITURE_EXPANSION_CONFIG.defaultTableLevels },
          counterLevel: FURNITURE_EXPANSION_CONFIG.defaultCounterLevel,
          ownedUpgrades: Object.keys(FURNITURE_EXPANSION_CONFIG.defaultTableLevels).map((id) => `table:${id}:1`)
        },
        simulation: {
          shopId: 'main',
          rngState: SHOP_SIMULATION_CONFIG.MAIN_RNG_SEED,
          simulatedMs: 0,
          remainderMs: 0,
          nextCustomerInMs: SHOP_SIMULATION_CONFIG.INITIAL_CUSTOMER_DELAY_MS,
          nextCustomerId: 1,
          customers: [],
          completedOrders: 0
        }
      },
      seaside: {
        unlocked: false,
        player: { x: 680, y: 680 },
        lastSettledAt: 0,
        furniture: {
          tableLevels: { table_1: 1, table_2: 1, table_3: 1, table_4: 1 },
          counterLevel: FURNITURE_EXPANSION_CONFIG.defaultCounterLevel,
          ownedUpgrades: ['table:table_1:1', 'table:table_2:1', 'table:table_3:1', 'table:table_4:1']
        },
        simulation: {
          shopId: 'seaside',
          rngState: SHOP_SIMULATION_CONFIG.SEASIDE_RNG_SEED,
          simulatedMs: 0,
          remainderMs: 0,
          nextCustomerInMs: SHOP_SIMULATION_CONFIG.INITIAL_CUSTOMER_DELAY_MS,
          nextCustomerId: 1,
          customers: [],
          completedOrders: 0
        },
        decor: {
          slotVariants: {},
          ownedVariants: [],
          ownedThemes: ['sea_theme_breeze'],
          theme: 'sea_theme_breeze'
        }
      }
    }
  }
};

/** 深拷贝默认存档：浅拷贝会让多个 SaveManager 实例共享嵌套对象（fund/staff/decor 等）造成串档 */
export function cloneDefaultSaveState(): SaveStateV2 {
  return JSON.parse(JSON.stringify(DEFAULT_SAVE_STATE)) as SaveStateV2;
}

function defaultM3Fields(): Pick<
  SaveStateV2,
  'decor' | 'equipmentLevel' | 'regulars' | 'staff' | 'fund' | 'achievements' | 'stats' | 'catPosesSeen' | 'cat' | 'world'
> {
  return {
    decor: { ...DEFAULT_SAVE_STATE.decor, slotVariants: {}, ownedVariants: [], ownedThemes: ['theme_wood'] },
    equipmentLevel: 1,
    regulars: {},
    staff: { hired: false, duties: [], storiesSeen: [], autoOrdersCompleted: 0 },
    fund: { loans: [], totalBorrowed: 0 },
    achievements: [],
    stats: { completedOrders: 0, totalRevenue: 0 },
    catPosesSeen: [],
    cat: { lastGiftDate: null, decorationFragments: 0 },
    world: JSON.parse(JSON.stringify(DEFAULT_SAVE_STATE.world)) as WorldSaveState
  };
}

const SIM_ORDER_STAGES = new Set<SimOrderStage>([
  'WAITING_FOR_ORDER',
  'WAITING_TO_BREW',
  'BREWING',
  'WAITING_TO_SERVE',
  'ENJOYING_DRINK',
  'WAITING_TO_PAY',
  'LEAVING'
]);

function sanitizeShopSimulation(raw: unknown, fallback: ShopSimulationState): ShopSimulationState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return JSON.parse(JSON.stringify(fallback)) as ShopSimulationState;
  }
  const value = raw as Record<string, unknown>;
  const customers = Array.isArray(value.customers)
    ? value.customers.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const customer = item as Record<string, unknown>;
        if (
          typeof customer.id !== 'string' ||
          typeof customer.recipeId !== 'string' ||
          typeof customer.stage !== 'string' ||
          !SIM_ORDER_STAGES.has(customer.stage as SimOrderStage)
        ) return [];
        const reservedIngredients: Record<string, number> = {};
        if (customer.reservedIngredients && typeof customer.reservedIngredients === 'object' && !Array.isArray(customer.reservedIngredients)) {
          for (const [id, count] of Object.entries(customer.reservedIngredients as Record<string, unknown>)) {
            if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
              reservedIngredients[id] = Math.floor(count);
            }
          }
        }
        return [{
          id: customer.id,
          recipeId: customer.recipeId,
          stage: customer.stage as SimOrderStage,
          stageRemainingMs: typeof customer.stageRemainingMs === 'number' && Number.isFinite(customer.stageRemainingMs) ? Math.max(0, customer.stageRemainingMs) : 0,
          patienceRemainingMs: typeof customer.patienceRemainingMs === 'number' && Number.isFinite(customer.patienceRemainingMs) ? Math.max(0, customer.patienceRemainingMs) : SHOP_SIMULATION_CONFIG.PATIENCE_MS,
          reservedIngredients
        }];
      })
    : [];
  const nonNegative = (field: string, defaultValue: number): number => {
    const candidate = value[field];
    return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
      ? candidate
      : defaultValue;
  };
  return {
    shopId: fallback.shopId,
    rngState: Math.floor(nonNegative('rngState', fallback.rngState)) >>> 0,
    simulatedMs: nonNegative('simulatedMs', fallback.simulatedMs),
    remainderMs: Math.min(
      SHOP_SIMULATION_CONFIG.FIXED_TIMESTEP_MS - 1,
      nonNegative('remainderMs', fallback.remainderMs)
    ),
    nextCustomerInMs: nonNegative('nextCustomerInMs', fallback.nextCustomerInMs),
    nextCustomerId: Math.max(1, Math.floor(nonNegative('nextCustomerId', fallback.nextCustomerId))),
    customers,
    completedOrders: Math.floor(nonNegative('completedOrders', fallback.completedOrders))
  };
}

/**
 * Migration registry from older versions to v2.
 */
export function migrateSave(raw: Record<string, unknown>): SaveStateV2 {
  const rawVersion = typeof raw.version === 'number' ? raw.version : 0;

  let current: Record<string, unknown> = { ...raw };

  if (rawVersion < 1) {
    current = {
      ...DEFAULT_SAVE_STATE,
      ...current,
      lastSavedAt: typeof current.lastSavedAt === 'number' ? current.lastSavedAt : Date.now()
    };
  }

  // v1 -> v2: 补齐 M3 新增字段（装修/装备/常客/店员/基金/成就/统计/猫睡姿）
  if (rawVersion < 2) {
    current = {
      ...current,
      ...defaultM3Fields(),
      version: 2
    };
  }

  return validateAndSanitizeSave(current).data;
}

export interface ValidationResult {
  valid: boolean;
  data: SaveStateV2;
  errors: string[];
}

/**
 * Validates raw data strictly. If structure is invalid or corrupt,
 * provides detailed error messages and either sanitized state or fallback.
 */
export function validateAndSanitizeSave(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      data: { ...cloneDefaultSaveState(), lastSavedAt: Date.now() },
      errors: ['存档必须是一个非空 JSON 对象']
    };
  }

  let obj = raw as Record<string, unknown>;

  // Check version
  if (typeof obj.version !== 'number') {
    errors.push('缺少版本号或版本号类型非法');
  } else if (obj.version > SAVE_CONFIG.CURRENT_VERSION) {
    errors.push(`未知或未来的存档版本: ${obj.version} (当前最高版本: ${SAVE_CONFIG.CURRENT_VERSION})`);
    return {
      valid: false,
      data: { ...cloneDefaultSaveState(), lastSavedAt: Date.now() },
      errors
    };
  } else if (obj.version < SAVE_CONFIG.CURRENT_VERSION) {
    // 老版本：补齐 M3 默认字段并提升到当前版本号，随后走完整校验以暴露原始字段错误
    obj = { ...defaultM3Fields(), ...obj, version: SAVE_CONFIG.CURRENT_VERSION };
  }

  // Validate gold
  let gold = DEFAULT_SAVE_STATE.gold;
  if (typeof obj.gold !== 'number' || !Number.isFinite(obj.gold)) {
    errors.push('金币字段必须为有效数字');
  } else if (obj.gold < 0) {
    errors.push('金币不能为负数');
  } else {
    gold = Math.floor(obj.gold);
  }

  // Validate player coordinates
  let playerX = DEFAULT_SAVE_STATE.player.x;
  let playerY = DEFAULT_SAVE_STATE.player.y;
  if (!obj.player || typeof obj.player !== 'object') {
    errors.push('缺少 player 坐标对象');
  } else {
    const p = obj.player as Record<string, unknown>;
    if (typeof p.x !== 'number' || !Number.isFinite(p.x)) {
      errors.push('player.x 必须为有效数字');
    } else {
      playerX = p.x;
    }
    if (typeof p.y !== 'number' || !Number.isFinite(p.y)) {
      errors.push('player.y 必须为有效数字');
    } else {
      playerY = p.y;
    }
  }

  // Validate activePlayTime
  let activePlayTime = 0;
  if (typeof obj.activePlayTime !== 'number' || !Number.isFinite(obj.activePlayTime) || obj.activePlayTime < 0) {
    errors.push('activePlayTime 必须为非负数字');
  } else {
    activePlayTime = obj.activePlayTime;
  }

  // Validate lastSavedAt
  let lastSavedAt = Date.now();
  if (typeof obj.lastSavedAt !== 'number' || !Number.isFinite(obj.lastSavedAt) || obj.lastSavedAt < 0) {
    errors.push('lastSavedAt 必须为有效时间戳');
  } else {
    lastSavedAt = obj.lastSavedAt;
  }

  // Validate inventory (counts must be non-negative)
  const inventory: Record<string, number> = {};
  if (obj.inventory && typeof obj.inventory === 'object' && !Array.isArray(obj.inventory)) {
    const rawInv = obj.inventory as Record<string, unknown>;
    for (const [key, val] of Object.entries(rawInv)) {
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        inventory[key] = Math.floor(val);
      } else {
        errors.push(`物品 ${key} 的数量非法 (不能为负或非数字): ${val}`);
      }
    }
  } else if (obj.inventory !== undefined) {
    errors.push('inventory 必须为键值对对象');
  }

  // Validate unlockedRecipes (filter out invalid IDs)
  const validRecipeSet = new Set<string>(SAVE_CONFIG.VALID_RECIPE_IDS);
  const unlockedRecipes: string[] = [];
  if (Array.isArray(obj.unlockedRecipes)) {
    for (const id of obj.unlockedRecipes) {
      if (typeof id === 'string') {
        if (validRecipeSet.has(id)) {
          unlockedRecipes.push(id);
        } else {
          errors.push(`未知的配方 ID 引用: "${id}"，已自动剔除`);
        }
      }
    }
  } else if (obj.unlockedRecipes !== undefined) {
    errors.push('unlockedRecipes 必须为数组');
  }

  // Validate recipeMastery
  const recipeMastery: Record<string, number> = {};
  if (obj.recipeMastery && typeof obj.recipeMastery === 'object' && !Array.isArray(obj.recipeMastery)) {
    const rawMastery = obj.recipeMastery as Record<string, unknown>;
    for (const [key, val] of Object.entries(rawMastery)) {
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        recipeMastery[key] = Math.floor(val);
      }
    }
  }

  // Validate placedFurniture (filter out invalid IDs)
  const validFurnitureSet = new Set<string>(SAVE_CONFIG.VALID_FURNITURE_IDS);
  const placedFurniture: string[] = [];
  if (Array.isArray(obj.placedFurniture)) {
    for (const id of obj.placedFurniture) {
      if (typeof id === 'string') {
        if (validFurnitureSet.has(id)) {
          placedFurniture.push(id);
        } else {
          errors.push(`未知的家具 ID 引用: "${id}"，已自动剔除`);
        }
      }
    }
  } else if (obj.placedFurniture !== undefined) {
    errors.push('placedFurniture 必须为数组');
  }

  // Validate settings
  const settings: SaveStateV2['settings'] = {
    debugNavOverlay: false,
    masterVolume: AUDIO_CONFIG.DEFAULT_MASTER_VOLUME,
    musicVolume: AUDIO_CONFIG.DEFAULT_MUSIC_VOLUME,
    sfxVolume: AUDIO_CONFIG.DEFAULT_SFX_VOLUME,
    muted: false
  };
  if (obj.settings && typeof obj.settings === 'object') {
    const rawSettings = obj.settings as Record<string, unknown>;
    if (typeof rawSettings.debugNavOverlay === 'boolean') {
      settings.debugNavOverlay = rawSettings.debugNavOverlay;
    }
    const volumeKeys = ['masterVolume', 'musicVolume', 'sfxVolume'] as const;
    for (const key of volumeKeys) {
      const value = rawSettings[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        settings[key] = Math.max(0, Math.min(1, value));
      }
    }
    if (typeof rawSettings.muted === 'boolean') settings.muted = rawSettings.muted;
  }

  // ---- M3 新增字段（宽松清洗：非法则回落默认）----
  const m3 = defaultM3Fields();

  if (obj.decor && typeof obj.decor === 'object' && !Array.isArray(obj.decor)) {
    const d = obj.decor as Record<string, unknown>;
    if (d.slotVariants && typeof d.slotVariants === 'object' && !Array.isArray(d.slotVariants)) {
      for (const [k, v] of Object.entries(d.slotVariants as Record<string, unknown>)) {
        if (typeof v === 'string') m3.decor.slotVariants[k] = v;
      }
    }
    if (Array.isArray(d.ownedVariants)) {
      m3.decor.ownedVariants = d.ownedVariants.filter((v): v is string => typeof v === 'string');
    }
    if (Array.isArray(d.ownedThemes)) {
      const themes = d.ownedThemes.filter((v): v is string => typeof v === 'string');
      if (themes.length > 0) m3.decor.ownedThemes = themes;
    }
    if (typeof d.theme === 'string') m3.decor.theme = d.theme;
  }

  if (typeof obj.equipmentLevel === 'number' && Number.isFinite(obj.equipmentLevel) && obj.equipmentLevel >= 1) {
    m3.equipmentLevel = Math.floor(obj.equipmentLevel);
  }

  if (obj.regulars && typeof obj.regulars === 'object' && !Array.isArray(obj.regulars)) {
    for (const [k, v] of Object.entries(obj.regulars as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const r = v as Record<string, unknown>;
        m3.regulars[k] = {
          favor: typeof r.favor === 'number' && r.favor >= 0 ? Math.floor(r.favor) : 0,
          visits: typeof r.visits === 'number' && r.visits >= 0 ? Math.floor(r.visits) : 0,
          storiesSeen: Array.isArray(r.storiesSeen)
            ? r.storiesSeen.filter((s): s is string => typeof s === 'string')
            : []
        };
      }
    }
  }

  if (obj.staff && typeof obj.staff === 'object' && !Array.isArray(obj.staff)) {
    const s = obj.staff as Record<string, unknown>;
    m3.staff = {
      hired: s.hired === true,
      duties: Array.isArray(s.duties) ? s.duties.filter((v): v is string => typeof v === 'string') : [],
      storiesSeen: Array.isArray(s.storiesSeen)
        ? s.storiesSeen.filter((v): v is string => typeof v === 'string')
        : [],
      autoOrdersCompleted:
        typeof s.autoOrdersCompleted === 'number' && s.autoOrdersCompleted >= 0
          ? Math.floor(s.autoOrdersCompleted)
          : 0
    };
  }

  if (obj.fund && typeof obj.fund === 'object' && !Array.isArray(obj.fund)) {
    const f = obj.fund as Record<string, unknown>;
    if (Array.isArray(f.loans)) {
      for (const l of f.loans) {
        if (l && typeof l === 'object' && !Array.isArray(l)) {
          const loan = l as Record<string, unknown>;
          if (
            typeof loan.id === 'string' &&
            typeof loan.amount === 'number' && loan.amount > 0 &&
            typeof loan.repaid === 'number' && loan.repaid >= 0
          ) {
            m3.fund.loans.push({
              id: loan.id,
              amount: Math.floor(loan.amount),
              repaid: Math.min(Math.floor(loan.repaid), Math.floor(loan.amount)),
              appliedAt: typeof loan.appliedAt === 'number' ? loan.appliedAt : Date.now()
            });
          }
        }
      }
    }
    if (typeof f.totalBorrowed === 'number' && f.totalBorrowed >= 0) {
      m3.fund.totalBorrowed = Math.floor(f.totalBorrowed);
    }
  }

  if (Array.isArray(obj.achievements)) {
    m3.achievements = obj.achievements.filter((v): v is string => typeof v === 'string');
  }

  if (obj.stats && typeof obj.stats === 'object' && !Array.isArray(obj.stats)) {
    const st = obj.stats as Record<string, unknown>;
    if (typeof st.completedOrders === 'number' && st.completedOrders >= 0) {
      m3.stats.completedOrders = Math.floor(st.completedOrders);
    }
    if (typeof st.totalRevenue === 'number' && st.totalRevenue >= 0) {
      m3.stats.totalRevenue = Math.floor(st.totalRevenue);
    }
  }

  if (Array.isArray(obj.catPosesSeen)) {
    m3.catPosesSeen = obj.catPosesSeen.filter((v): v is string => typeof v === 'string');
  }

  if (obj.cat && typeof obj.cat === 'object' && !Array.isArray(obj.cat)) {
    const cat = obj.cat as Record<string, unknown>;
    if (typeof cat.lastGiftDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cat.lastGiftDate)) {
      m3.cat.lastGiftDate = cat.lastGiftDate;
    }
    if (typeof cat.decorationFragments === 'number' && cat.decorationFragments >= 0) {
      m3.cat.decorationFragments = Math.floor(cat.decorationFragments);
    }
  }

  if (obj.world && typeof obj.world === 'object' && !Array.isArray(obj.world)) {
    const world = obj.world as Record<string, unknown>;
    if (world.activeShopId === 'main' || world.activeShopId === 'seaside') {
      m3.world.activeShopId = world.activeShopId;
    }
    if (world.shops && typeof world.shops === 'object' && !Array.isArray(world.shops)) {
      const shops = world.shops as Record<string, unknown>;
      for (const shopId of ['main', 'seaside'] as const) {
        const rawShop = shops[shopId];
        if (!rawShop || typeof rawShop !== 'object' || Array.isArray(rawShop)) continue;
        const shop = rawShop as Record<string, unknown>;
        const target = m3.world.shops[shopId];
        if (typeof shop.unlocked === 'boolean') target.unlocked = shopId === 'main' || shop.unlocked;
        if (typeof shop.lastSettledAt === 'number' && Number.isFinite(shop.lastSettledAt) && shop.lastSettledAt >= 0) {
          target.lastSettledAt = shop.lastSettledAt;
        }
        if (shop.player && typeof shop.player === 'object' && !Array.isArray(shop.player)) {
          const player = shop.player as Record<string, unknown>;
          if (typeof player.x === 'number' && Number.isFinite(player.x)) target.player.x = player.x;
          if (typeof player.y === 'number' && Number.isFinite(player.y)) target.player.y = player.y;
        }
        target.simulation = sanitizeShopSimulation(shop.simulation, target.simulation);
        if (shop.furniture && typeof shop.furniture === 'object' && !Array.isArray(shop.furniture)) {
          const furniture = shop.furniture as Record<string, unknown>;
          if (furniture.tableLevels && typeof furniture.tableLevels === 'object' && !Array.isArray(furniture.tableLevels)) {
            for (const [key, value] of Object.entries(furniture.tableLevels as Record<string, unknown>)) {
              if (typeof value === 'number' && Number.isFinite(value)) {
                target.furniture.tableLevels[key] = Math.max(0, Math.min(2, Math.floor(value)));
              }
            }
          }
          if (typeof furniture.counterLevel === 'number' && Number.isFinite(furniture.counterLevel)) {
            target.furniture.counterLevel = Math.max(0, Math.min(3, Math.floor(furniture.counterLevel)));
          }
          if (Array.isArray(furniture.ownedUpgrades)) {
            target.furniture.ownedUpgrades = furniture.ownedUpgrades.filter((value): value is string => typeof value === 'string');
          }
        }
        if (shopId === 'seaside' && shop.decor && typeof shop.decor === 'object' && !Array.isArray(shop.decor)) {
          const decor = shop.decor as Record<string, unknown>;
          const targetDecor = m3.world.shops.seaside.decor;
          if (decor.slotVariants && typeof decor.slotVariants === 'object' && !Array.isArray(decor.slotVariants)) {
            for (const [key, value] of Object.entries(decor.slotVariants as Record<string, unknown>)) {
              if (typeof value === 'string') targetDecor.slotVariants[key] = value;
            }
          }
          if (Array.isArray(decor.ownedVariants)) {
            targetDecor.ownedVariants = decor.ownedVariants.filter((value): value is string => typeof value === 'string');
          }
          if (Array.isArray(decor.ownedThemes)) {
            const themes = decor.ownedThemes.filter((value): value is string => typeof value === 'string');
            if (themes.length > 0) targetDecor.ownedThemes = themes;
          }
          if (typeof decor.theme === 'string') targetDecor.theme = decor.theme;
        }
      }
      if (!m3.world.shops.seaside.unlocked) m3.world.activeShopId = 'main';
    }
  }

  const sanitizedData: SaveStateV2 = {
    version: 2,
    gold,
    player: { x: playerX, y: playerY },
    activePlayTime,
    lastSavedAt,
    inventory,
    unlockedRecipes: unlockedRecipes.length > 0 ? unlockedRecipes : [...DEFAULT_SAVE_STATE.unlockedRecipes],
    recipeMastery,
    placedFurniture: placedFurniture.length > 0 ? placedFurniture : [...DEFAULT_SAVE_STATE.placedFurniture],
    settings,
    ...m3
  };

  return {
    valid: errors.length === 0,
    data: sanitizedData,
    errors
  };
}
