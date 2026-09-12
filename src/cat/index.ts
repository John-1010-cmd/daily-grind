import { CAT_GIFT_CONFIG } from '../config';
import { EconomyLedger } from '../economy';
import { SaveManager } from '../save';
import { CatPose } from '../scene/catComponent';

export type CatGift =
  | { kind: 'gold'; amount: number }
  | { kind: 'fragment'; amount: number };

export function toLocalDateKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 猫咪收集与每日首摸礼物；wallClock 与随机源均可注入。 */
export class CatInteractionManager {
  constructor(
    private readonly saveManager: SaveManager,
    private readonly ledger: EconomyLedger,
    private readonly random: () => number = Math.random
  ) {}

  public recordPose(pose: CatPose): boolean {
    const seen = this.saveManager.getState().catPosesSeen;
    if (seen.includes(pose)) return false;
    this.saveManager.updateState((draft) => { draft.catPosesSeen.push(pose); });
    return true;
  }

  public claimDailyGift(wallClockMs: number): CatGift | null {
    const today = toLocalDateKey(wallClockMs);
    const last = this.saveManager.getState().cat.lastGiftDate;
    if (last !== null && today <= last) return null;

    if (this.random() < CAT_GIFT_CONFIG.FRAGMENT_CHANCE) {
      this.saveManager.updateState((draft) => {
        draft.cat.lastGiftDate = today;
        draft.cat.decorationFragments += CAT_GIFT_CONFIG.FRAGMENT_AMOUNT;
      });
      return { kind: 'fragment', amount: CAT_GIFT_CONFIG.FRAGMENT_AMOUNT };
    }

    this.saveManager.updateState((draft) => { draft.cat.lastGiftDate = today; });
    this.ledger.grantCatGift(CAT_GIFT_CONFIG.GOLD_AMOUNT);
    return { kind: 'gold', amount: CAT_GIFT_CONFIG.GOLD_AMOUNT };
  }
}
