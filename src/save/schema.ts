import {
  INITIAL_INVENTORY,
  PLAYER_CONFIG,
  SAVE_CONFIG
} from '../config';

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
  };
  // ---- M3 新增 ----
  decor: {
    slotVariants: Record<string, string>;
    ownedVariants: string[];
    ownedThemes: string[];
    theme: string;
  };
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
    debugNavOverlay: false
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
  catPosesSeen: []
};

function defaultM3Fields(): Pick<
  SaveStateV2,
  'decor' | 'equipmentLevel' | 'regulars' | 'staff' | 'fund' | 'achievements' | 'stats' | 'catPosesSeen'
> {
  return {
    decor: { ...DEFAULT_SAVE_STATE.decor, slotVariants: {}, ownedVariants: [], ownedThemes: ['theme_wood'] },
    equipmentLevel: 1,
    regulars: {},
    staff: { hired: false, duties: [], storiesSeen: [], autoOrdersCompleted: 0 },
    fund: { loans: [], totalBorrowed: 0 },
    achievements: [],
    stats: { completedOrders: 0, totalRevenue: 0 },
    catPosesSeen: []
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
      data: { ...DEFAULT_SAVE_STATE, lastSavedAt: Date.now() },
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
      data: { ...DEFAULT_SAVE_STATE, lastSavedAt: Date.now() },
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
  const settings = {
    debugNavOverlay: false
  };
  if (obj.settings && typeof obj.settings === 'object') {
    const rawSettings = obj.settings as Record<string, unknown>;
    if (typeof rawSettings.debugNavOverlay === 'boolean') {
      settings.debugNavOverlay = rawSettings.debugNavOverlay;
    }
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
