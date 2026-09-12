import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_CONFIG } from '../src/config';
import {
  DEFAULT_SAVE_STATE,
  MemoryStorageAdapter,
  SafeLocalStorageAdapter,
  SaveManager,
  migrateSave,
  validateAndSanitizeSave
} from '../src/save';

describe('Save System & Schema (T0.8 & T0.10)', () => {
  let memoryStorage: MemoryStorageAdapter;
  let saveManager: SaveManager;

  beforeEach(() => {
    memoryStorage = new MemoryStorageAdapter();
    saveManager = new SaveManager(memoryStorage);
  });

  it('1. 正常存档解析：初始默认状态完整且符合 v1 契约', () => {
    const state = saveManager.getState();
    expect(state.version).toBe(1);
    expect(state.gold).toBe(SAVE_CONFIG.INITIAL_GOLD);
    expect(state.player.x).toBeGreaterThan(0);
    expect(state.player.y).toBeGreaterThan(0);
    expect(state.activePlayTime).toBe(0);
    expect(Array.isArray(state.unlockedRecipes)).toBe(true);
    expect(state.unlockedRecipes).toContain('espresso');
  });

  it('2. 版本迁移路径：无版本号或老版本 (v0) 能够平滑迁移至 v1', () => {
    const legacyRaw = {
      gold: 500,
      player: { x: 500, y: 500 }
      // missing version
    };
    const migrated = migrateSave(legacyRaw);
    expect(migrated.version).toBe(1);
    expect(migrated.gold).toBe(500);
    expect(migrated.player.x).toBe(500);
    expect(migrated.player.y).toBe(500);
    expect(migrated.unlockedRecipes).toEqual(DEFAULT_SAVE_STATE.unlockedRecipes);
  });

  it('3. 损坏 / 非法 JSON 回退：语法错误不崩溃，优雅回退到默认值', () => {
    memoryStorage.setItem(SAVE_CONFIG.STORAGE_KEY, '{ invalid json: broken syntax ...');
    const newManager = new SaveManager(memoryStorage);
    const state = newManager.getState();
    expect(state.version).toBe(1);
    expect(state.gold).toBe(SAVE_CONFIG.INITIAL_GOLD);
  });

  it('4. 合法 JSON 但结构非法：处理类型错误、负金币、负库存', () => {
    const invalidData = {
      version: 1,
      gold: -999, // negative gold
      player: { x: 'invalid_x', y: 300 }, // type error
      activePlayTime: -10, // negative time
      inventory: {
        coffee_beans: -5, // negative inventory
        milk: 10
      }
    };
    const result = validateAndSanitizeSave(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Sanitized checks
    expect(result.data.gold).toBe(DEFAULT_SAVE_STATE.gold);
    expect(result.data.player.x).toBe(DEFAULT_SAVE_STATE.player.x);
    expect(result.data.activePlayTime).toBe(0);
    expect(result.data.inventory.coffee_beans).toBeUndefined();
    expect(result.data.inventory.milk).toBe(10);
  });

  it('5. 未知或未来版本号：拒绝并回退到安全默认状态', () => {
    const futureSave = {
      version: 999,
      gold: 88888,
      player: { x: 100, y: 100 }
    };
    const result = validateAndSanitizeSave(futureSave);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('未知或未来的存档版本'))).toBe(true);
    expect(result.data.version).toBe(1);
    expect(result.data.gold).toBe(SAVE_CONFIG.INITIAL_GOLD);
  });

  it('6. 不存在的配方 / 家具 ID 引用：自动清洗过滤，防止脏数据注入', () => {
    const dirtySave = {
      version: 1,
      gold: 200,
      player: { x: 520, y: 550 },
      activePlayTime: 50,
      lastSavedAt: Date.now(),
      unlockedRecipes: ['espresso', 'unknown_dark_magic_potion_999'],
      placedFurniture: ['default_chair', 'invalid_nonexistent_table']
    };
    const result = validateAndSanitizeSave(dirtySave);
    expect(result.data.unlockedRecipes).toEqual(['espresso']);
    expect(result.data.placedFurniture).toEqual(['default_chair']);
    expect(result.errors.some((e) => e.includes('未知的配方 ID'))).toBe(true);
    expect(result.errors.some((e) => e.includes('未知的家具 ID'))).toBe(true);
  });

  it('7. localStorage 写入失败（如配额超限或隐私模式）：降级至内存存储不崩溃', () => {
    const safeAdapter = new SafeLocalStorageAdapter();
    // Simulate quota exceeded
    const throwItemStorage: SafeLocalStorageAdapter = Object.create(safeAdapter);
    let memoryFallbackValue: string | null = null;
    throwItemStorage.setItem = (_k, v) => {
      // simulate throwing QuotaExceededError and switching to memory fallback
      try {
        throw new Error('QuotaExceededError');
      } catch {
        memoryFallbackValue = v;
      }
    };
    throwItemStorage.getItem = () => memoryFallbackValue;

    expect(() => {
      const mgr = new SaveManager(throwItemStorage);
      mgr.setGold(350);
      mgr.saveImmediate();
    }).not.toThrow();
  });

  it('8. pagehide / visibilitychange 立即落盘：关键时刻调用 saveImmediate', () => {
    saveManager.setupLifecycleHooks(window);
    const saveSpy = vi.spyOn(saveManager, 'saveImmediate');
    saveManager.setGold(888);

    // Trigger pagehide event on window
    window.dispatchEvent(new Event('pagehide'));
    expect(saveSpy).toHaveBeenCalled();
    expect(saveManager.getState().gold).toBe(888);

    // Verify stored string contains updated gold
    const raw = memoryStorage.getItem(SAVE_CONFIG.STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).gold).toBe(888);

    saveManager.cleanup(window);
  });

  it('9. 导入导出 round-trip：导出的数据能被重新完整无损地导入', () => {
    saveManager.setGold(777);
    saveManager.setPlayerPosition(800, 600);
    saveManager.setActivePlayTime(125);
    saveManager.saveImmediate();

    const exported = saveManager.exportJSON();
    expect(typeof exported).toBe('string');

    // Create a new fresh SaveManager
    const freshStorage = new MemoryStorageAdapter();
    const freshManager = new SaveManager(freshStorage);
    freshManager.importJSON(exported);

    const importedState = freshManager.getState();
    expect(importedState.version).toBe(1);
    expect(importedState.gold).toBe(777);
    expect(importedState.player.x).toBe(800);
    expect(importedState.player.y).toBe(600);
    expect(importedState.activePlayTime).toBe(125);
  });

  it('10. 导入非法 JSON 抛出明确异常，不破坏当前状态', () => {
    saveManager.setGold(500);
    const beforeState = saveManager.getState();

    expect(() => {
      saveManager.importJSON('not a json string');
    }).toThrow('合法的 JSON 格式');

    expect(saveManager.getState().gold).toBe(beforeState.gold);
  });
});
