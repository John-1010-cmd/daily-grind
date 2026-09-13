import { CAT_GIFT_CONFIG, FURNITURE_EXPANSION_CONFIG, SHOP_SCENES, ShopId } from '../config';
import { DecorManager } from '../decor';
import { EconomyLedger } from '../economy';
import { DreamFundManager, FundMetrics } from '../fund';
import { FurnitureManager } from '../furniture';
import { SaveManager } from '../save';
import { ToastManager } from './toast';

/**
 * 装修面板（T3.1）：槽位款式总览 + 主题色调；顶部小还款进度条（T3.6 呈现要求）。
 * 半透明水彩纸质感、不遮挡店中央（面板居中但半透明）。
 */
export class DecorModal {
  private root: HTMLElement;
  private saveManager: SaveManager;
  private ledger: EconomyLedger;
  private decorManager: DecorManager;
  private fundManager: DreamFundManager;
  private getFundMetrics: () => FundMetrics;
  private toast: ToastManager;
  private isOpen = false;
  private modalEl: HTMLElement | null = null;
  /** 款式/主题变更后通知场景重绘覆盖层（main.ts 注入） */
  public onDecorChanged: (() => void) | null = null;
  public onFurnitureChanged: (() => void) | null = null;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    ledger: EconomyLedger,
    decorManager: DecorManager,
    fundManager: DreamFundManager,
    getFundMetrics: () => FundMetrics,
    toast: ToastManager,
    private readonly furnitureManager: FurnitureManager,
    private readonly getActiveShopId: () => ShopId
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.ledger = ledger;
    this.decorManager = decorManager;
    this.fundManager = fundManager;
    this.getFundMetrics = getFundMetrics;
    this.toast = toast;
  }

  public open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.render();
  }

  public setDecorManager(decorManager: DecorManager): void {
    this.decorManager = decorManager;
    if (this.isOpen) this.render();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.modalEl?.parentElement) {
      this.modalEl.parentElement.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }

  private render(): void {
    if (this.modalEl?.parentElement) {
      this.modalEl.parentElement.removeChild(this.modalEl);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop interactive';
    this.modalEl = backdrop;

    backdrop.addEventListener('pointerdown', (e) => e.stopPropagation());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    const gold = this.saveManager.getState().gold;
    const fragments = this.saveManager.getState().cat.decorationFragments;
    const outstanding = this.fundManager.getOutstanding();
    const metrics = this.getFundMetrics();
    const cap = this.fundManager.getCap(metrics);
    const progress = this.fundManager.getOverallProgress();
    const activeShopId = this.getActiveShopId();
    const furnitureState = this.saveManager.getState().world.shops[activeShopId].furniture;
    const tableSlotIds = [...new Set(SHOP_SCENES[activeShopId].tableSeats.map((seat) => seat.tableId))];
    const tableExpansionHtml = tableSlotIds.map((slotId, index) => {
      const currentLevel = furnitureState.tableLevels[slotId] ?? 0;
      const ownedLevel = this.furnitureManager.getOwnedTableLevel(activeShopId, slotId);
      const current = FURNITURE_EXPANSION_CONFIG.table[currentLevel];
      const next = FURNITURE_EXPANSION_CONFIG.table[ownedLevel + 1];
      const canStore = currentLevel > 0;
      const canPlace = currentLevel === 0 && ownedLevel > 0;
      return `
        <div class="furniture-upgrade-card">
          <div><strong>餐桌槽位 ${index + 1}</strong><small>${current.name} · ${current.operationsImpact}</small></div>
          <div class="furniture-actions">
            ${next ? `<button class="btn-action" data-table-upgrade="${slotId}">预览并置办 ${next.name} · 🪙${next.cost}</button>` : '<span class="furniture-max">已完整升级</span>'}
            ${canStore ? `<button class="btn-action btn-muted" data-table-level="${slotId}" data-level="0">免费收起</button>` : ''}
            ${canPlace ? `<button class="btn-action" data-table-level="${slotId}" data-level="${ownedLevel}">免费摆回</button>` : ''}
          </div>
        </div>`;
    }).join('');
    const counterLevel = furnitureState.counterLevel;
    const counterCurrent = FURNITURE_EXPANSION_CONFIG.counter[counterLevel];
    const counterOwned = this.furnitureManager.getOwnedCounterLevel(activeShopId);
    const counterNext = FURNITURE_EXPANSION_CONFIG.counter[counterOwned + 1];

    // 还款罐小进度条（多笔时合计）
    const fundBarHtml = `
      <div class="fund-mini-bar">
        <span>🏺 还款罐</span>
        <div class="bar-bg"><div class="bar-fill" style="width: ${Math.round(progress * 100)}%"></div></div>
        <span>${outstanding > 0 ? `待存 🪙${outstanding} / 额度 ${cap}` : '暂无待还款项'}</span>
      </div>
    `;

    // 槽位款式
    let slotsHtml = '';
    for (const slot of this.decorManager.getSlots()) {
      const selectedId = this.decorManager.getSelectedVariantId(slot.id);
      let chipsHtml = '';
      for (const variant of slot.variants) {
        const owned = this.decorManager.isVariantOwned(slot.id, variant.id);
        const selected = variant.id === selectedId;
        const cls = selected ? 'selected' : owned ? '' : 'locked';
        const tail = owned ? (selected ? ' ✓' : '') : ` <span class="cost">🪙${variant.cost}</span>`;
        chipsHtml += `
          <div class="decor-variant-option">
            <button class="decor-variant-chip ${cls}" data-slot="${slot.id}" data-variant="${variant.id}" data-owned="${owned}">
              ${variant.name}${tail}
            </button>
            ${!owned && variant.cost > 0 ? `
              <button class="decor-fragment-btn" data-exchange-slot="${slot.id}" data-exchange-variant="${variant.id}"
                ${fragments < CAT_GIFT_CONFIG.FRAGMENT_EXCHANGE_COST ? 'disabled' : ''}>
                🧩${CAT_GIFT_CONFIG.FRAGMENT_EXCHANGE_COST} 兑换
              </button>
            ` : ''}
          </div>
        `;
      }
      slotsHtml += `
        <div class="decor-slot-card">
          <div class="decor-slot-head">${slot.icon} ${slot.name}</div>
          <div class="decor-variant-row">${chipsHtml}</div>
        </div>
      `;
    }

    // 主题色调
    let themesHtml = '';
    for (const theme of this.decorManager.getThemes()) {
      const owned = this.decorManager.isThemeOwned(theme.id);
      const selected = this.decorManager.getTheme().id === theme.id;
      const cls = selected ? 'selected' : owned ? '' : 'locked';
      const tail = owned ? (selected ? ' ✓' : '') : ` <span class="cost">🪙${theme.cost}</span>`;
      themesHtml += `
        <button class="decor-variant-chip ${cls}" data-theme="${theme.id}" data-owned="${owned}" title="${theme.description}">
          ${theme.name}${tail}
        </button>
      `;
    }

    backdrop.innerHTML = `
      <div class="modal-panel modal-panel-large paper-panel">
        <div class="modal-header">
          <div class="modal-title">🛋️ 店面布置与装修</div>
          <button class="modal-close-btn" id="btn-close-decor" title="关闭">&times;</button>
        </div>
        <div class="modal-body">
          ${fundBarHtml}
          <div class="supply-top-bar">
            <span>当前金币: <strong>🪙 ${gold}</strong></span>
            <span>装饰碎片: <strong>🧩 ${fragments}</strong></span>
            <span style="font-size:12px;color:#8c6239;">点击店里的家具也可直接轮换已拥有款式</span>
          </div>
          <div class="fund-tier-note">碎片仅来自摸猫的小礼物，可提前换到同样能用金币购买的普通款式；没有限定款或连续签到。</div>
          <div class="decor-slot-card furniture-expansion-section">
            <div class="decor-slot-head">🪚 经营扩建 · ${SHOP_SCENES[activeShopId].name}</div>
            <div class="fund-tier-note">固定槽位布置，家具一经置办永久拥有；移动、收起和摆回都不收费，也没有施工等待。</div>
            ${tableExpansionHtml}
            <div class="furniture-upgrade-card">
              <div><strong>吧台工作链</strong><small>${counterCurrent.name} · ${counterCurrent.operationsImpact}</small></div>
              <div class="furniture-actions">
                ${counterNext ? `<button class="btn-action" data-counter-upgrade>预览并置办 ${counterNext.name} · 🪙${counterNext.cost}</button>` : '<span class="furniture-max">已完整升级</span>'}
              </div>
            </div>
          </div>
          <div class="recipe-scroll-area" style="max-height: 300px; overflow-y: auto;">
            ${slotsHtml}
          </div>
          <div class="decor-slot-card">
            <div class="decor-slot-head">🎨 整店主题色调</div>
            <div class="decor-variant-row">${themesHtml}</div>
          </div>
        </div>
      </div>
    `;

    this.root.appendChild(backdrop);

    backdrop.querySelector('#btn-close-decor')?.addEventListener('click', () => this.close());

    backdrop.querySelectorAll('.decor-variant-chip[data-slot]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const slotId = el.getAttribute('data-slot')!;
        const variantId = el.getAttribute('data-variant')!;
        const owned = el.getAttribute('data-owned') === 'true';

        if (owned) {
          this.decorManager.selectVariant(slotId, variantId);
          this.toast.show('已换上新款式，店里感觉不一样了~');
        } else {
          const res = this.decorManager.purchaseVariant(slotId, variantId, this.ledger);
          if (res.ok) {
            this.toast.show('🎉 置办了新款式，马上布置好！');
          } else {
            this.toast.show(res.reason ?? '暂时无法购买');
          }
        }
        this.onDecorChanged?.();
        this.render();
      });
    });

    backdrop.querySelectorAll('.decor-variant-chip[data-theme]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const themeId = el.getAttribute('data-theme')!;
        const owned = el.getAttribute('data-owned') === 'true';

        if (owned) {
          this.decorManager.selectTheme(themeId);
          this.toast.show('整店色调已切换，氛围焕然一新~');
        } else {
          const res = this.decorManager.purchaseTheme(themeId, this.ledger);
          if (res.ok) {
            this.toast.show('🎨 新主题色调已布置完成！');
          } else {
            this.toast.show(res.reason ?? '暂时无法购买');
          }
        }
        this.onDecorChanged?.();
        this.render();
      });
    });

    backdrop.querySelectorAll('.decor-fragment-btn[data-exchange-slot]').forEach((button) => {
      button.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const result = this.decorManager.exchangeVariantWithFragments(
          el.getAttribute('data-exchange-slot')!,
          el.getAttribute('data-exchange-variant')!
        );
        this.toast.show(result.ok ? '🧩 碎片化成了新布置，已经替你摆好啦！' : (result.reason ?? '暂时无法兑换'));
        if (result.ok) this.onDecorChanged?.();
        this.render();
      });
    });

    backdrop.querySelectorAll('[data-table-upgrade]').forEach((button) => {
      button.addEventListener('click', (e) => {
        const slotId = (e.currentTarget as HTMLElement).getAttribute('data-table-upgrade')!;
        const result = this.furnitureManager.upgradeTable(activeShopId, slotId);
        this.toast.show(result.ok ? FURNITURE_EXPANSION_CONFIG.purchaseSuccessCopy : (result.reason ?? '暂时无法置办'));
        if (result.ok) this.onFurnitureChanged?.();
        this.render();
      });
    });

    backdrop.querySelectorAll('[data-table-level]').forEach((button) => {
      button.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const result = this.furnitureManager.setTableLevel(
          activeShopId,
          el.getAttribute('data-table-level')!,
          Number(el.getAttribute('data-level'))
        );
        this.toast.show(result.ok ? '已经替你免费调整好位置啦。' : (result.reason ?? '暂时无法调整'));
        if (result.ok) this.onFurnitureChanged?.();
        this.render();
      });
    });

    backdrop.querySelector('[data-counter-upgrade]')?.addEventListener('click', () => {
      const result = this.furnitureManager.upgradeCounter(activeShopId);
      this.toast.show(result.ok ? FURNITURE_EXPANSION_CONFIG.purchaseSuccessCopy : (result.reason ?? '暂时无法扩建'));
      if (result.ok) this.onFurnitureChanged?.();
      this.render();
    });
  }
}
