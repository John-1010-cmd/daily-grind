import {
  INITIAL_INVENTORY,
  PLAYER_CONFIG,
  SAVE_CONFIG
} from '../config';

export interface SaveStateV1 {
  version: 1;
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
}

export type SaveState = SaveStateV1;

export const DEFAULT_SAVE_STATE: SaveStateV1 = {
  version: 1,
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
  }
};

/**
 * Migration registry from older versions to v1.
 */
export function migrateSave(raw: Record<string, unknown>): SaveStateV1 {
  const rawVersion = typeof raw.version === 'number' ? raw.version : 0;

  let current = { ...raw };

  // Example migration step: version 0 (unversioned legacy) -> version 1
  if (rawVersion < 1) {
    current = {
      ...DEFAULT_SAVE_STATE,
      ...current,
      version: 1,
      lastSavedAt: typeof current.lastSavedAt === 'number' ? current.lastSavedAt : Date.now()
    };
  }

  // Future migrations:
  // if (rawVersion === 1) { current = migrateV1ToV2(current); }

  return validateAndSanitizeSave(current).data;
}

export interface ValidationResult {
  valid: boolean;
  data: SaveStateV1;
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

  const obj = raw as Record<string, unknown>;

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
    // Migrate older version
    return {
      valid: true,
      data: migrateSave(obj),
      errors
    };
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

  const sanitizedData: SaveStateV1 = {
    version: 1,
    gold,
    player: { x: playerX, y: playerY },
    activePlayTime,
    lastSavedAt,
    inventory,
    unlockedRecipes: unlockedRecipes.length > 0 ? unlockedRecipes : [...DEFAULT_SAVE_STATE.unlockedRecipes],
    recipeMastery,
    placedFurniture: placedFurniture.length > 0 ? placedFurniture : [...DEFAULT_SAVE_STATE.placedFurniture],
    settings
  };

  return {
    valid: errors.length === 0,
    data: sanitizedData,
    errors
  };
}
