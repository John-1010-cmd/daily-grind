import { describe, expect, it } from 'vitest';
import { PERFORMANCE_BUDGETS, SCREEN_CONFIG } from '../src/config';

describe('M6 可调性能预算', () => {
  it('量化门槛与设计文档一致', () => {
    expect(PERFORMANCE_BUDGETS.FIRST_SCREEN_GZIP_MAX_BYTES).toBe(6 * 1024 * 1024);
    expect(PERFORMANCE_BUDGETS.TTI_MAX_MS).toBe(5_000);
    expect(PERFORMANCE_BUDGETS.MIN_FPS_1080P).toBe(50);
    expect(PERFORMANCE_BUDGETS.MIN_TOUCH_TARGET_PX).toBe(44);
    expect(PERFORMANCE_BUDGETS.FAST_4G_SIMULATION.downloadBytesPerSecond).toBeGreaterThan(0);
    expect(PERFORMANCE_BUDGETS.FAST_4G_SIMULATION.roundTripMs).toBeGreaterThan(0);
  });

  it('横屏测量视口有效且桌面视口覆盖 1080p', () => {
    expect(PERFORMANCE_BUDGETS.MOBILE_LANDSCAPE_VIEWPORT.width).toBeGreaterThan(
      PERFORMANCE_BUDGETS.MOBILE_LANDSCAPE_VIEWPORT.height
    );
    expect(PERFORMANCE_BUDGETS.DESKTOP_VIEWPORT.width).toBeGreaterThanOrEqual(
      SCREEN_CONFIG.DESIGN_WIDTH
    );
    expect(PERFORMANCE_BUDGETS.DESKTOP_VIEWPORT.height).toBe(1080);
  });
});
