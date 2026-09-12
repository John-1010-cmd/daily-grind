import {
  DECOR_SLOTS,
  DECOR_THEMES,
  CAT_GIFT_CONFIG,
  DecorSlotDef,
  DecorThemeDef,
  DecorVariantDef
} from '../config';
import { EconomyLedger } from '../economy';
import { SaveManager } from '../save';

/**
 * 装修系统（T3.1）：固定槽位 + 款式变体 + 整店主题色调。
 * 装饰碎片兑换不在本里程碑（M4 随摸猫礼物一并落地，产出先于消费）。
 */
export class DecorManager {
  private saveManager: SaveManager;

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;
  }

  public getSlots(): readonly DecorSlotDef[] {
    return DECOR_SLOTS;
  }

  public getSlot(slotId: string): DecorSlotDef | undefined {
    return DECOR_SLOTS.find((s) => s.id === slotId);
  }

  public getDefaultVariant(slot: DecorSlotDef): DecorVariantDef {
    return slot.variants[0];
  }

  public getSelectedVariantId(slotId: string): string {
    const slot = this.getSlot(slotId);
    const saved = this.saveManager.getState().decor.slotVariants[slotId];
    if (slot && saved && slot.variants.some((v) => v.id === saved)) {
      return saved;
    }
    return slot ? this.getDefaultVariant(slot).id : '';
  }

  public getSelectedVariant(slotId: string): DecorVariantDef | undefined {
    const slot = this.getSlot(slotId);
    if (!slot) return undefined;
    const id = this.getSelectedVariantId(slotId);
    return slot.variants.find((v) => v.id === id);
  }

  public isVariantOwned(slotId: string, variantId: string): boolean {
    const slot = this.getSlot(slotId);
    const variant = slot?.variants.find((v) => v.id === variantId);
    if (!variant) return false;
    if (variant.cost <= 0) return true; // 默认款式永远拥有
    return this.saveManager.getState().decor.ownedVariants.includes(variantId);
  }

  /** 已拥有款式总数（含默认款，成就统计用） */
  public getOwnedVariantCount(): number {
    let count = 0;
    for (const slot of DECOR_SLOTS) {
      for (const v of slot.variants) {
        if (this.isVariantOwned(slot.id, v.id)) count++;
      }
    }
    return count;
  }

  public purchaseVariant(slotId: string, variantId: string, ledger: EconomyLedger): { ok: boolean; reason?: string } {
    const slot = this.getSlot(slotId);
    const variant = slot?.variants.find((v) => v.id === variantId);
    if (!slot || !variant) return { ok: false, reason: '款式不存在' };
    if (this.isVariantOwned(slotId, variantId)) return { ok: false, reason: '已拥有该款式' };
    if (ledger.getBalance() < variant.cost) {
      return { ok: false, reason: `金币不足（需 🪙${variant.cost}）` };
    }

    ledger.settleDecorPurchase(variant.name, variant.cost);
    this.saveManager.updateState((draft) => {
      draft.decor.ownedVariants.push(variantId);
      draft.decor.slotVariants[slotId] = variantId; // 购买即换上
    });
    return { ok: true };
  }

  public selectVariant(slotId: string, variantId: string): boolean {
    if (!this.isVariantOwned(slotId, variantId)) return false;
    this.saveManager.updateState((draft) => {
      draft.decor.slotVariants[slotId] = variantId;
    });
    return true;
  }

  /** 碎片只换金币也可购买的普通款式，不创建碎片独占内容。 */
  public exchangeVariantWithFragments(slotId: string, variantId: string): { ok: boolean; reason?: string } {
    const slot = this.getSlot(slotId);
    const variant = slot?.variants.find((v) => v.id === variantId);
    if (!slot || !variant || variant.cost <= 0) return { ok: false, reason: '该款式不可兑换' };
    if (this.isVariantOwned(slotId, variantId)) return { ok: false, reason: '已拥有该款式' };
    const fragments = this.saveManager.getState().cat.decorationFragments;
    if (fragments < CAT_GIFT_CONFIG.FRAGMENT_EXCHANGE_COST) {
      return { ok: false, reason: `装饰碎片不足（需 🧩${CAT_GIFT_CONFIG.FRAGMENT_EXCHANGE_COST}）` };
    }
    this.saveManager.updateState((draft) => {
      draft.cat.decorationFragments -= CAT_GIFT_CONFIG.FRAGMENT_EXCHANGE_COST;
      if (!draft.decor.ownedVariants.includes(variantId)) draft.decor.ownedVariants.push(variantId);
      draft.decor.slotVariants[slotId] = variantId;
    });
    return { ok: true };
  }

  /** 点击家具直接切换：在已拥有款式中循环 */
  public cycleVariant(slotId: string): DecorVariantDef | null {
    const slot = this.getSlot(slotId);
    if (!slot) return null;
    const owned = slot.variants.filter((v) => this.isVariantOwned(slotId, v.id));
    if (owned.length === 0) return null;
    const currentId = this.getSelectedVariantId(slotId);
    const idx = owned.findIndex((v) => v.id === currentId);
    const next = owned[(idx + 1) % owned.length];
    this.selectVariant(slotId, next.id);
    return next;
  }

  // ---------- 主题色调 ----------

  public getTheme(): DecorThemeDef {
    const id = this.saveManager.getState().decor.theme;
    return DECOR_THEMES.find((t) => t.id === id) ?? DECOR_THEMES[0];
  }

  public isThemeOwned(themeId: string): boolean {
    const theme = DECOR_THEMES.find((t) => t.id === themeId);
    if (!theme) return false;
    if (theme.cost <= 0) return true;
    return this.saveManager.getState().decor.ownedThemes.includes(themeId);
  }

  public purchaseTheme(themeId: string, ledger: EconomyLedger): { ok: boolean; reason?: string } {
    const theme = DECOR_THEMES.find((t) => t.id === themeId);
    if (!theme) return { ok: false, reason: '主题不存在' };
    if (this.isThemeOwned(themeId)) return { ok: false, reason: '已拥有该主题' };
    if (ledger.getBalance() < theme.cost) {
      return { ok: false, reason: `金币不足（需 🪙${theme.cost}）` };
    }
    ledger.settleDecorPurchase(`${theme.name}（主题色调）`, theme.cost);
    this.saveManager.updateState((draft) => {
      draft.decor.ownedThemes.push(themeId);
      draft.decor.theme = themeId;
    });
    return { ok: true };
  }

  public selectTheme(themeId: string): boolean {
    if (!this.isThemeOwned(themeId)) return false;
    this.saveManager.updateState((draft) => {
      draft.decor.theme = themeId;
    });
    return true;
  }
}
