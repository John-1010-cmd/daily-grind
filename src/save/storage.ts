export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

export class SafeLocalStorageAdapter implements StorageAdapter {
  private fallback: MemoryStorageAdapter = new MemoryStorageAdapter();
  private usingFallback: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.usingFallback = true;
        return;
      }
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      this.usingFallback = false;
    } catch {
      this.usingFallback = true;
    }
  }

  public isUsingFallback(): boolean {
    return this.usingFallback;
  }

  public getItem(key: string): string | null {
    if (this.usingFallback) {
      return this.fallback.getItem(key);
    }
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('读取 localStorage 失败，已降级至内存存储:', e);
      return this.fallback.getItem(key);
    }
  }

  public setItem(key: string, value: string): void {
    if (this.usingFallback) {
      this.fallback.setItem(key, value);
      return;
    }
    try {
      window.localStorage.setItem(key, value);
      // Keep fallback in sync
      this.fallback.setItem(key, value);
    } catch (e) {
      console.warn('写入 localStorage 失败（可能已满或处于隐私模式），已降级至内存存储:', e);
      this.usingFallback = true;
      this.fallback.setItem(key, value);
    }
  }

  public removeItem(key: string): void {
    this.fallback.removeItem(key);
    if (!this.usingFallback) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore error on remove
      }
    }
  }
}
