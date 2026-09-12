import { describe, expect, it } from 'vitest';
import { calculateCrossfadeTiming } from '../src/audio';
import { CatInteractionManager, toLocalDateKey } from '../src/cat';
import { AUDIO_CONFIG, CAT_GIFT_CONFIG, DECOR_SLOTS, TIME_PERIODS } from '../src/config';
import { DecorManager } from '../src/decor';
import { EconomyLedger } from '../src/economy';
import { MemoryStorageAdapter, SaveManager } from '../src/save';
import { calculateLightingFrame } from '../src/scene/lighting';
import { GameClock } from '../src/clock';

function setup(random: () => number = () => 0) {
  const saveManager = new SaveManager(new MemoryStorageAdapter());
  const ledger = new EconomyLedger(saveManager);
  const cat = new CatInteractionManager(saveManager, ledger, random);
  return { saveManager, ledger, cat };
}

describe('M4 氛围层与假时钟 (T4.1-T4.5)', () => {
  it('进店时段严格对齐注入的 wallClock', () => {
    const cases = [
      [7, 'dawn'], [14, 'noon'], [18, 'dusk'], [22, 'night'], [2, 'night']
    ] as const;
    for (const [hour, periodId] of cases) {
      const now = new Date(2026, 8, 12, hour).getTime();
      const clock = new GameClock(0, () => now);
      clock.alignWithWallClock();
      expect(clock.getCurrentPeriodInfo().period.id).toBe(periodId);
    }
  });

  it('activePlayTime 推进四时段且黄昏到夜晚平滑点亮灯串', () => {
    const clock = new GameClock(0);
    clock.alignWithWallClock(new Date(2026, 8, 12, 7));
    const ids: string[] = [];
    for (const period of TIME_PERIODS) {
      ids.push(clock.getCurrentPeriodInfo().period.id);
      clock.tick(period.durationSeconds * 1000);
    }
    expect(ids).toEqual(['dawn', 'noon', 'dusk', 'night']);

    const duskNearEnd = calculateLightingFrame(TIME_PERIODS[2], 2, 0.99);
    expect(duskNearEnd.nightStrength).toBeGreaterThan(0);
    expect(duskNearEnd.tintColor).not.toBe(TIME_PERIODS[2].tintColor);
  });

  it('同日首摸只领一次，跨日可再次领取', () => {
    const { cat, saveManager } = setup(() => 0);
    const day1 = new Date(2026, 8, 12, 10).getTime();
    const day2 = new Date(2026, 8, 13, 8).getTime();
    expect(cat.claimDailyGift(day1)).toEqual({ kind: 'fragment', amount: CAT_GIFT_CONFIG.FRAGMENT_AMOUNT });
    expect(cat.claimDailyGift(day1)).toBeNull();
    expect(cat.claimDailyGift(day2)).not.toBeNull();
    expect(saveManager.getState().cat.lastGiftDate).toBe(toLocalDateKey(day2));
  });

  it('系统时间回拨不会重复发放每日礼物', () => {
    const { cat, saveManager } = setup(() => 1);
    const later = new Date(2026, 8, 13, 10).getTime();
    const earlier = new Date(2026, 8, 12, 10).getTime();
    expect(cat.claimDailyGift(later)).toEqual({ kind: 'gold', amount: CAT_GIFT_CONFIG.GOLD_AMOUNT });
    const balance = saveManager.getState().gold;
    expect(cat.claimDailyGift(earlier)).toBeNull();
    expect(saveManager.getState().gold).toBe(balance);
  });

  it('睡姿收集幂等，摸猫眯眼姿可入图鉴', () => {
    const { cat, saveManager } = setup();
    expect(cat.recordPose('curled')).toBe(true);
    expect(cat.recordPose('curled')).toBe(false);
    expect(cat.recordPose('blink')).toBe(true);
    expect(saveManager.getState().catPosesSeen).toEqual(['curled', 'blink']);
  });

  it('碎片兑换只接受同样可用金币购买的普通款式', () => {
    const { saveManager } = setup();
    const decor = new DecorManager(saveManager);
    const slot = DECOR_SLOTS[0];
    const paidVariant = slot.variants.find((variant) => variant.cost > 0)!;
    saveManager.updateState((draft) => {
      draft.cat.decorationFragments = CAT_GIFT_CONFIG.FRAGMENT_EXCHANGE_COST;
    });

    expect(decor.exchangeVariantWithFragments(slot.id, slot.variants[0].id).ok).toBe(false);
    expect(decor.exchangeVariantWithFragments(slot.id, paidVariant.id).ok).toBe(true);
    expect(decor.isVariantOwned(slot.id, paidVariant.id)).toBe(true);
    expect(saveManager.getState().cat.decorationFragments).toBe(0);
  });

  it('BGM 调度窗口包含交叉淡化重叠，无静音缝隙', () => {
    const timing = calculateCrossfadeTiming(64.133);
    expect(timing.crossfade).toBe(AUDIO_CONFIG.BGM_CROSSFADE_SECONDS);
    expect(timing.stride).toBeLessThan(64.133);
    expect(64.133 - timing.stride).toBeCloseTo(timing.crossfade);
  });
});
