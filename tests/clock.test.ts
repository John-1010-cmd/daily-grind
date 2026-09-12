import { describe, expect, it } from 'vitest';
import { GameClock } from '../src/clock';
import { CLOCK_CONFIG } from '../src/config';

describe('Three-Clock System & Lighting Cycle (T0.6 & T0.7)', () => {
  it('1. activePlayTime 正常推进与暂停挂起', () => {
    const clock = new GameClock(0);
    expect(clock.getActivePlayTime()).toBe(0);

    // 运行 1000ms
    clock.tick(1000);
    expect(clock.getActivePlayTime()).toBeCloseTo(1, 2);

    // 页面隐藏时暂停
    clock.pause();
    expect(clock.isPaused()).toBe(true);
    clock.tick(5000);
    // 暂停期间时间不增加
    expect(clock.getActivePlayTime()).toBeCloseTo(1, 2);

    // 页面切回时恢复
    clock.resume();
    expect(clock.isPaused()).toBe(false);
    clock.tick(2000);
    expect(clock.getActivePlayTime()).toBeCloseTo(3, 2);
  });

  it('2. 可注入假时钟与 wallClock 查询', () => {
    let fakeNow = 1700000000000;
    const clock = new GameClock(0, () => fakeNow);
    expect(clock.getWallClock()).toBe(fakeNow);

    fakeNow += 60000;
    expect(clock.getWallClock()).toBe(fakeNow);
  });

  it('3. offlineElapsed 行为验证：正常计算、时间回拨按 0、上限 12 小时', () => {
    let fakeNow = 1700000000000;
    const clock = new GameClock(0, () => fakeNow);

    // 正常经过 3600 秒 (1 小时)
    const lastSaved = fakeNow - 3600 * 1000;
    expect(clock.getOfflineElapsed(lastSaved)).toBe(3600);

    // 系统时间回拨（当前时间比存档时间还早）-> 负值按 0
    const futureSaved = fakeNow + 10000;
    expect(clock.getOfflineElapsed(futureSaved)).toBe(0);

    // 超过 12 小时（如 24 小时）-> 封顶 12 小时 (43200 秒)
    const oneDayAgo = fakeNow - 24 * 3600 * 1000;
    expect(clock.getOfflineElapsed(oneDayAgo)).toBe(CLOCK_CONFIG.OFFLINE_MAX_SECONDS);
  });

  it('4. 现实时间联动：进店时段对齐 wallClock', () => {
    const clock = new GameClock(0);

    // 早上 7 点 -> 清晨 (dawn)
    clock.alignWithWallClock(new Date('2026-09-12T07:30:00'));
    expect(clock.getCurrentPeriodInfo().period.id).toBe('dawn');

    // 下午 14 点 -> 午后 (noon)
    clock.alignWithWallClock(new Date('2026-09-12T14:00:00'));
    expect(clock.getCurrentPeriodInfo().period.id).toBe('noon');

    // 傍晚 18 点 -> 黄昏 (dusk)
    clock.alignWithWallClock(new Date('2026-09-12T18:15:00'));
    expect(clock.getCurrentPeriodInfo().period.id).toBe('dusk');

    // 夜间 22 点 -> 夜晚 (night)
    clock.alignWithWallClock(new Date('2026-09-12T22:00:00'));
    expect(clock.getCurrentPeriodInfo().period.id).toBe('night');

    // 凌晨 2 点 -> 夜晚 (night)
    clock.alignWithWallClock(new Date('2026-09-12T02:00:00'));
    expect(clock.getCurrentPeriodInfo().period.id).toBe('night');
  });

  it('5. activePlayTime 驱动四时段循环轮转', () => {
    const clock = new GameClock(0);
    // 从清晨开始
    clock.alignWithWallClock(new Date('2026-09-12T08:00:00'));
    expect(clock.getCurrentPeriodInfo().period.id).toBe('dawn');

    // 推进清晨时长（120秒）后进入午后
    clock.tick(120 * 1000 + 1000);
    expect(clock.getCurrentPeriodInfo().period.id).toBe('noon');

    // 推进午后时长（180秒）后进入黄昏
    clock.tick(180 * 1000 + 1000);
    expect(clock.getCurrentPeriodInfo().period.id).toBe('dusk');

    // 推进黄昏时长（120秒）后进入夜晚
    clock.tick(120 * 1000 + 1000);
    expect(clock.getCurrentPeriodInfo().period.id).toBe('night');

    // 推进夜晚时长（180秒）后重新回到清晨
    clock.tick(180 * 1000 + 1000);
    expect(clock.getCurrentPeriodInfo().period.id).toBe('dawn');
  });
});
