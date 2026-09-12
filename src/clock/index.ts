import { CLOCK_CONFIG, TIME_PERIODS, TimePeriodConfig } from '../config';

export interface ClockSnapshot {
  activePlayTime: number; // in seconds
  wallClock: number; // in milliseconds
  offlineElapsed: number; // in seconds, [0, OFFLINE_MAX_SECONDS]
  currentPeriod: TimePeriodConfig;
  cycleProgress: number; // 0 to 1 inside current cycle
}

export class GameClock {
  private activePlayTime: number; // in seconds
  private paused: boolean = false;
  private customWallClock: (() => number) | null = null;
  private wallClockOffset: number = 0; // period offset determined at initial boot
  private initialAlignmentDone: boolean = false;

  constructor(initialActivePlayTime: number = 0, wallClockProvider?: () => number) {
    this.activePlayTime = Math.max(0, initialActivePlayTime);
    if (wallClockProvider) {
      this.customWallClock = wallClockProvider;
    }
  }

  public getWallClock(): number {
    if (this.customWallClock) {
      return this.customWallClock();
    }
    return Date.now();
  }

  public setWallClockProvider(provider: (() => number) | null): void {
    this.customWallClock = provider;
  }

  public getActivePlayTime(): number {
    return this.activePlayTime;
  }

  public setActivePlayTime(seconds: number): void {
    this.activePlayTime = Math.max(0, seconds);
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  /**
   * Advances active play time by deltaMs if not paused.
   */
  public tick(deltaMs: number): void {
    if (this.paused || deltaMs <= 0) {
      return;
    }
    this.activePlayTime += deltaMs / 1000;
  }

  /**
   * Calculates offline elapsed time in seconds since lastSavedAt (ms).
   * Negative values (e.g. clock rolled back) are clamped to 0.
   * Capped at CLOCK_CONFIG.OFFLINE_MAX_SECONDS (12 hours).
   */
  public getOfflineElapsed(lastSavedAtMs: number): number {
    if (!lastSavedAtMs || lastSavedAtMs <= 0) {
      return 0;
    }
    const currentMs = this.getWallClock();
    const elapsedSeconds = (currentMs - lastSavedAtMs) / 1000;
    if (elapsedSeconds < 0) {
      return 0;
    }
    return Math.min(elapsedSeconds, CLOCK_CONFIG.OFFLINE_MAX_SECONDS);
  }

  /**
   * Align period with wall clock for initial launch.
   */
  public alignWithWallClock(targetDate?: Date): void {
    const date = targetDate || new Date(this.getWallClock());
    const hour = date.getHours();

    let targetPeriodId: 'dawn' | 'noon' | 'dusk' | 'night' = 'noon';
    for (const mapping of CLOCK_CONFIG.HOUR_TO_PERIOD) {
      if (hour >= mapping.startHour && hour <= mapping.endHour) {
        targetPeriodId = mapping.periodId;
        break;
      }
    }

    // Find the cumulative start offset for the target period in the cycle
    let cumulative = 0;
    for (const p of TIME_PERIODS) {
      if (p.id === targetPeriodId) {
        this.wallClockOffset = cumulative;
        break;
      }
      cumulative += p.durationSeconds;
    }
    this.initialAlignmentDone = true;
  }

  /**
   * Determine the current time period and progress based on activePlayTime + wallClockOffset.
   */
  public getCurrentPeriodInfo(): { period: TimePeriodConfig; progress: number; periodIndex: number } {
    if (!this.initialAlignmentDone) {
      this.alignWithWallClock();
    }

    const totalCycle = TIME_PERIODS.reduce((sum, p) => sum + p.durationSeconds, 0);
    const effectiveTime = (this.wallClockOffset + this.activePlayTime) % totalCycle;

    let accumulated = 0;
    for (let i = 0; i < TIME_PERIODS.length; i++) {
      const p = TIME_PERIODS[i];
      if (effectiveTime < accumulated + p.durationSeconds) {
        const periodProgress = (effectiveTime - accumulated) / p.durationSeconds;
        return {
          period: p,
          progress: periodProgress,
          periodIndex: i
        };
      }
      accumulated += p.durationSeconds;
    }

    return {
      period: TIME_PERIODS[0],
      progress: 0,
      periodIndex: 0
    };
  }

  public getSnapshot(lastSavedAtMs: number = 0): ClockSnapshot {
    const periodInfo = this.getCurrentPeriodInfo();
    const totalCycle = TIME_PERIODS.reduce((sum, p) => sum + p.durationSeconds, 0);
    const cycleProgress = ((this.wallClockOffset + this.activePlayTime) % totalCycle) / totalCycle;

    return {
      activePlayTime: this.activePlayTime,
      wallClock: this.getWallClock(),
      offlineElapsed: this.getOfflineElapsed(lastSavedAtMs),
      currentPeriod: periodInfo.period,
      cycleProgress
    };
  }
}
