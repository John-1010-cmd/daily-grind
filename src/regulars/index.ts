import {
  EXCLUSIVE_RECIPE_DEFS,
  ExclusiveRecipeDef,
  REGULAR_DEFS,
  RECIPE_DEFS,
  RecipeDef,
  RegularDef,
  RegularStorySnippet
} from '../config';
import { SaveManager } from '../save';
import { RegularState } from '../save/schema';

export interface VisitResult {
  newFavor: number;
  newStories: RegularStorySnippet[];
  exclusiveJustUnlocked: boolean;
}

/**
 * 常客与好感（T3.3）：固定偏好 / 好感度 / 剧情片段 / 专属点单。
 */
export class RegularManager {
  private saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  public getDef(regularId: string): RegularDef | undefined {
    return REGULAR_DEFS.find((r) => r.id === regularId);
  }

  public getState(regularId: string): RegularState {
    const state = this.saveManager.getState().regulars[regularId];
    return state ?? { favor: 0, visits: 0, storiesSeen: [] };
  }

  public getFavor(regularId: string): number {
    return this.getState(regularId).favor;
  }

  /** 该常客今天是否已遇见（图鉴点亮 = 至少光顾过一次） */
  public hasMet(regularId: string): boolean {
    return this.getState(regularId).visits > 0;
  }

  public isExclusiveUnlocked(regularId: string): boolean {
    const def = this.getDef(regularId);
    if (!def) return false;
    return this.getFavor(regularId) >= def.exclusiveFavorRequired;
  }

  public getExclusiveRecipe(regularId: string): ExclusiveRecipeDef | undefined {
    return EXCLUSIVE_RECIPE_DEFS.find((e) => e.regularId === regularId);
  }

  /** 专属点单转换为 Order 可用的 RecipeDef 形态（不入配方树） */
  public getExclusiveRecipeAsRecipeDef(regularId: string): RecipeDef | undefined {
    const ex = this.getExclusiveRecipe(regularId);
    if (!ex) return undefined;
    return {
      id: ex.id,
      name: ex.name,
      lineId: 'espresso',
      lineName: '常客专属',
      ingredients: ex.ingredients,
      price: ex.price,
      brewTimeSeconds: ex.brewTimeSeconds,
      unlockCost: 0
    };
  }

  /** 常客决定点单：好感达标后概率点专属，否则点固定偏好（缺货改点由顾客系统兜底） */
  public pickPreferredRecipeId(regularId: string, exclusiveRoll: number): string {
    const def = this.getDef(regularId);
    if (!def) {
      return RECIPE_DEFS[0].id;
    }
    if (this.isExclusiveUnlocked(regularId) && exclusiveRoll < 0.5) {
      return def.exclusiveRecipeId;
    }
    return def.preferredRecipeId;
  }

  /** 进店光顾一次（生成常客顾客时调用） */
  public markVisit(regularId: string): void {
    this.saveManager.updateState((draft) => {
      const cur = draft.regulars[regularId] ?? { favor: 0, visits: 0, storiesSeen: [] };
      cur.visits += 1;
      draft.regulars[regularId] = cur;
    });
  }

  /**
   * 订单完成（收银）后结算好感：返回新解锁的故事片段。
   */
  public onOrderCompleted(regularId: string): VisitResult {
    const def = this.getDef(regularId);
    if (!def) {
      return { newFavor: 0, newStories: [], exclusiveJustUnlocked: false };
    }

    const before = this.getState(regularId);
    const wasExclusive = before.favor >= def.exclusiveFavorRequired;
    const newFavor = before.favor + def.favorPerVisit;

    const newStories = def.stories.filter(
      (s) => before.favor < s.favorRequired && newFavor >= s.favorRequired
    );

    this.saveManager.updateState((draft) => {
      const cur = draft.regulars[regularId] ?? { favor: 0, visits: 0, storiesSeen: [] };
      cur.favor = newFavor;
      for (const s of newStories) {
        if (!cur.storiesSeen.includes(s.id)) {
          cur.storiesSeen.push(s.id);
        }
      }
      draft.regulars[regularId] = cur;
    });

    return {
      newFavor,
      newStories,
      exclusiveJustUnlocked: !wasExclusive && newFavor >= def.exclusiveFavorRequired
    };
  }

  /** 图鉴 / 成就统计：已读故事总数（常客侧） */
  public getTotalStoriesSeen(): number {
    const regulars = this.saveManager.getState().regulars;
    return Object.values(regulars).reduce((sum, r) => sum + r.storiesSeen.length, 0);
  }

  /** 好感达到指定值的常客人数（成就条件） */
  public countRegularsWithFavor(favor: number): number {
    return REGULAR_DEFS.filter((d) => this.getFavor(d.id) >= favor).length;
  }
}
