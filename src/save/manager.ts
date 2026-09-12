import { SAVE_CONFIG } from '../config';
import { ShopId } from '../config';
import {
  cloneDefaultSaveState,
  SaveStateV2,
  validateAndSanitizeSave
} from './schema';
import { SafeLocalStorageAdapter, StorageAdapter } from './storage';

export type StateListener = (state: Readonly<SaveStateV2>) => void;

export class SaveManager {
  private storage: StorageAdapter;
  private state: SaveStateV2;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<StateListener> = new Set();
  private boundVisibilityHandler: (() => void) | null = null;
  private boundPageHideHandler: (() => void) | null = null;

  constructor(storageAdapter?: StorageAdapter) {
    this.storage = storageAdapter ?? new SafeLocalStorageAdapter();
    this.state = this.loadFromStorage();
  }

  public getState(): Readonly<SaveStateV2> {
    return this.state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('SaveManager listener error:', err);
      }
    }
  }

  public updateState(updater: (draft: SaveStateV2) => void): void {
    updater(this.state);
    this.notifyListeners();
    this.requestAutoSave();
  }

  public setGold(gold: number): void {
    this.updateState((draft) => {
      draft.gold = Math.max(0, Math.floor(gold));
    });
  }

  public setPlayerPosition(x: number, y: number): void {
    this.updateState((draft) => {
      draft.player.x = x;
      draft.player.y = y;
    });
  }

  public setShopPlayerPosition(shopId: ShopId, x: number, y: number): void {
    this.updateState((draft) => {
      draft.world.shops[shopId].player.x = x;
      draft.world.shops[shopId].player.y = y;
      if (shopId === 'main') {
        draft.player.x = x;
        draft.player.y = y;
      }
    });
  }

  public setActivePlayTime(seconds: number): void {
    this.updateState((draft) => {
      draft.activePlayTime = Math.max(0, seconds);
    });
  }

  public setDebugNavOverlay(show: boolean): void {
    this.updateState((draft) => {
      draft.settings.debugNavOverlay = show;
    });
  }

  private loadFromStorage(): SaveStateV2 {
    const raw = this.storage.getItem(SAVE_CONFIG.STORAGE_KEY);
    if (!raw) {
      const initial = { ...cloneDefaultSaveState(), lastSavedAt: Date.now() };
      this.writeToStorage(initial);
      return initial;
    }

    try {
      const parsed = JSON.parse(raw);
      const validation = validateAndSanitizeSave(parsed);
      if (!validation.valid) {
        console.warn('存档格式校验修正:', validation.errors);
      }
      return validation.data;
    } catch (e) {
      console.error('存档 JSON 损坏，已回退至初始默认状态:', e);
      const fallback = { ...cloneDefaultSaveState(), lastSavedAt: Date.now() };
      this.writeToStorage(fallback);
      return fallback;
    }
  }

  private writeToStorage(data: SaveStateV2): void {
    try {
      const serialized = JSON.stringify(data);
      this.storage.setItem(SAVE_CONFIG.STORAGE_KEY, serialized);
    } catch (e) {
      console.warn('写入存档失败:', e);
    }
  }

  public requestAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      return;
    }
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.saveImmediate();
    }, SAVE_CONFIG.AUTOSAVE_THROTTLE_MS);
  }

  public saveImmediate(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.state.lastSavedAt = Date.now();
    this.writeToStorage(this.state);
  }

  public exportJSON(): string {
    // Return formatted JSON string
    return JSON.stringify(this.state, null, 2);
  }

  public importJSON(jsonStr: string): SaveStateV2 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('导入失败：不是合法的 JSON 格式');
    }

    const validation = validateAndSanitizeSave(parsed);
    // If version is future/unknown or fundamentally corrupt and validation.valid is false with fatal errors
    if (!validation.valid && validation.errors.some((e) => e.includes('未知或未来的存档版本'))) {
      throw new Error(`导入失败：${validation.errors[0]}`);
    }

    this.state = validation.data;
    this.saveImmediate();
    this.notifyListeners();
    return this.state;
  }

  public resetToDefault(): SaveStateV2 {
    this.state = {
      ...cloneDefaultSaveState(),
      lastSavedAt: Date.now()
    };
    this.saveImmediate();
    this.notifyListeners();
    return this.state;
  }

  public setupLifecycleHooks(targetWindow: Window = window): void {
    if (typeof targetWindow === 'undefined') return;

    this.boundVisibilityHandler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.saveImmediate();
      }
    };

    this.boundPageHideHandler = () => {
      this.saveImmediate();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    }
    targetWindow.addEventListener('pagehide', this.boundPageHideHandler);
    targetWindow.addEventListener('beforeunload', this.boundPageHideHandler);
  }

  public cleanup(targetWindow: Window = window): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.boundVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
    if (this.boundPageHideHandler && typeof targetWindow !== 'undefined') {
      targetWindow.removeEventListener('pagehide', this.boundPageHideHandler);
      targetWindow.removeEventListener('beforeunload', this.boundPageHideHandler);
      this.boundPageHideHandler = null;
    }
  }
}
