import { ACHIEVEMENT_DEFS, BRANCH_CONFIG } from '../config';
import { AchievementManager } from '../achievements';
import { EconomyLedger } from '../economy';
import { SaveManager } from '../save';

export interface BranchUnlockStatus {
  unlocked: boolean;
  gold: number;
  cost: number;
  hasEnoughGold: boolean;
  prerequisites: { id: string; name: string; description: string; met: boolean }[];
  prerequisitesMet: boolean;
}

export class BranchManager {
  constructor(
    private saveManager: SaveManager,
    private ledger: EconomyLedger,
    private achievementManager: AchievementManager
  ) {}

  public getSeasideStatus(): BranchUnlockStatus {
    const prerequisites = BRANCH_CONFIG.SEASIDE_PREREQUISITE_ACHIEVEMENT_IDS.map((id) => {
      const def = ACHIEVEMENT_DEFS.find((achievement) => achievement.id === id);
      return {
        id,
        name: def?.name ?? id,
        description: def?.description ?? '',
        met: this.achievementManager.isUnlocked(id)
      };
    });
    const gold = this.ledger.getBalance();
    return {
      unlocked: this.saveManager.getState().world.shops.seaside.unlocked,
      gold,
      cost: BRANCH_CONFIG.SEASIDE_UNLOCK_COST,
      hasEnoughGold: gold >= BRANCH_CONFIG.SEASIDE_UNLOCK_COST,
      prerequisites,
      prerequisitesMet: prerequisites.every((item) => item.met)
    };
  }

  public unlockSeaside(): { ok: boolean; reason?: string } {
    const status = this.getSeasideStatus();
    if (status.unlocked) return { ok: false, reason: '海风分店已经准备好了' };
    if (!status.prerequisitesMet) return { ok: false, reason: '再和街坊们相处一阵，开店的念想会慢慢清晰起来' };
    if (!status.hasEnoughGold) return { ok: false, reason: `开店准备金还差 🪙${status.cost - status.gold}` };

    this.ledger.settleBranchUnlock('海风分店', status.cost);
    this.saveManager.updateState((draft) => {
      draft.world.shops.seaside.unlocked = true;
    });
    return { ok: true };
  }
}
