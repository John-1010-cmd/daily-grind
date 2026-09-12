import { DECOR_THEMES } from '../config';
import { DecorManager } from '../decor';
import { EconomyLedger } from '../economy';
import { DreamFundManager, FundMetrics } from '../fund';
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

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    ledger: EconomyLedger,
    decorManager: DecorManager,
    fundManager: DreamFundManager,
    getFundMetrics: () => FundMetrics,
    toast: ToastManager
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
    const outstanding = this.fundManager.getOutstanding();
    const metrics = this.getFundMetrics();
    const cap = this.fundManager.getCap(metrics);
    const progress = this.fundManager.getOverallProgress();

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
        const tail = owned
          ? selected ? ' ✓' : ''
          : ` <span class="cost">🪙${variant.cost}</span>`;
        chipsHtml += `
          <button class="decor-variant-chip ${cls}" data-slot="${slot.id}" data-variant="${variant.id}" data-owned="${owned}">
            ${variant.name}${tail}
          </button>
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
    for (const theme of DECOR_THEMES) {
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
            <span style="font-size:12px;color:#8c6239;">点击店里的家具也可直接轮换已拥有款式</span>
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
  }
}
