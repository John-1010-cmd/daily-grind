import {
  ACHIEVEMENT_DEFS,
  AchievementDef,
  RECIPE_DEFS
} from '../config';
import { EconomyLedger } from '../economy';
import { SaveManager } from '../save';
import { RegularState } from '../save/schema';

/** 成就判定上下文（全部由不可购买 / 真实游玩指标构成） */
export interface AchievementMetrics {
  completedOrders: number;
  totalRevenue: number;
  unlockedRecipeIds: readonly string[];
  regulars: Record<string, RegularState>;
  ownedVariantCount: number;
  catPoseCount: number;
  storiesSeenCount: number;
}

/**
 * 成就系统最小集（T3.7）：纯荣誉 + 轻奖励（金币或徽章），
 * 不产装饰碎片、无排行榜、无限时（红线 3）。分店前置成就在这里定义，供 M5 查询。
 */
export class AchievementManager {
  private saveManager: SaveManager;
  private ledger: EconomyLedger | null;

  constructor(saveManager: SaveManager, ledger: EconomyLedger | null = null) {
    this.saveManager = saveManager;
    this.ledger = ledger;
  }

  public isUnlocked(achievementId: string): boolean {
    return this.saveManager.getState().achievements.includes(achievementId);
  }

  public getUnlockedIds(): readonly string[] {
    return this.saveManager.getState().achievements;
  }

  public getAllDefs(): readonly AchievementDef[] {
    return ACHIEVEMENT_DEFS;
  }

  private checkCondition(def: AchievementDef, m: AchievementMetrics): boolean {
    const c = def.condition;
    switch (c.type) {
      case 'completedOrders':
        return m.completedOrders >= c.threshold;
      case 'totalRevenue':
        return m.totalRevenue >= c.threshold;
      case 'unlockedLines': {
        const lines = new Set(
          RECIPE_DEFS.filter((r) => m.unlockedRecipeIds.includes(r.id)).map((r) => r.lineId)
        );
        return lines.size >= c.threshold;
      }
      case 'regularsFavor': {
        const count = Object.values(m.regulars).filter((r) => r.favor >= c.favor).length;
        return count >= c.count;
      }
      case 'storiesSeen':
        return m.storiesSeenCount >= c.threshold;
      case 'ownedVariants':
        return m.ownedVariantCount >= c.threshold;
      case 'catPoses':
        return m.catPoseCount >= c.threshold;
      default:
        return false;
    }
  }

  /**
   * 评估并解锁成就：返回本次新解锁的成就（金币奖励经账本人账）。
   */
  public evaluate(metrics: AchievementMetrics): AchievementDef[] {
    const newlyUnlocked: AchievementDef[] = [];

    for (const def of ACHIEVEMENT_DEFS) {
      if (this.isUnlocked(def.id)) continue;
      if (!this.checkCondition(def, metrics)) continue;

      this.saveManager.updateState((draft) => {
        if (!draft.achievements.includes(def.id)) {
          draft.achievements.push(def.id);
        }
      });

      if ('gold' in def.reward && this.ledger) {
        this.ledger.grantAchievementReward(def.name, def.reward.gold);
      }

      newlyUnlocked.push(def);
    }

    return newlyUnlocked;
  }

  /** 分店前置成就是否全部达成（M5 直接查询此接口，第 11、12 节） */
  public isBranchPrereqMet(): boolean {
    return ACHIEVEMENT_DEFS.filter((d) => d.isBranchPrerequisite).every((d) =>
      this.isUnlocked(d.id)
    );
  }
}
