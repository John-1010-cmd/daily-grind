import { FUND_CONFIG } from '../config';
import { EconomyLedger } from '../economy';
import { DreamFundManager, FundMetrics } from '../fund';
import { SaveManager } from '../save';
import { ToastManager } from './toast';

/**
 * 梦想基金面板（T3.6）：温柔化呈现——"支持开店的前辈"与储蓄罐。
 * 红线：UI 全程不出现"贷款"字样；零息、无期限、多笔共存。
 */
export class FundModal {
  private root: HTMLElement;
  private saveManager: SaveManager;
  private ledger: EconomyLedger;
  private fundManager: DreamFundManager;
  private getFundMetrics: () => FundMetrics;
  private toast: ToastManager;
  private isOpen = false;
  private modalEl: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    ledger: EconomyLedger,
    fundManager: DreamFundManager,
    getFundMetrics: () => FundMetrics,
    toast: ToastManager
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.ledger = ledger;
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
    const metrics = this.getFundMetrics();
    const tier = this.fundManager.getCurrentTier(metrics);
    const cap = this.fundManager.getCap(metrics);
    const outstanding = this.fundManager.getOutstanding();
    const loans = this.fundManager.getLoans();

    // 申请按钮
    let applyHtml = '';
    for (const amount of FUND_CONFIG.APPLY_AMOUNTS) {
      const check = this.fundManager.canApply(amount, metrics);
      applyHtml += `
        <button class="btn-action btn-buy" data-amount="${amount}" ${check.ok ? '' : 'disabled'}
          title="${check.ok ? '前辈乐意支持你' : check.reason}">
          支持 🪙${amount}
        </button>
      `;
    }

    // 借款列表（呈现为"前辈的心意"与还款罐进度）
    let loansHtml = '';
    if (loans.length === 0) {
      loansHtml = `<div class="fund-tier-note">前辈时常惦记着这家店。需要一点启动的心意时，随时开口就好。</div>`;
    } else {
      for (const loan of loans) {
        const pct = Math.round((loan.repaid / loan.amount) * 100);
        const done = loan.repaid >= loan.amount;
        loansHtml += `
          <div class="fund-loan-card ${done ? 'repaid' : ''}">
            <div>💌 前辈的心意 🪙${loan.amount} ${done ? '（已把心意存满 ✓）' : ''}</div>
            <div class="bar-bg"><div class="bar-fill" style="width: ${pct}%"></div></div>
            <div style="font-size:12px;color:#8c6239;margin-top:4px;">还款罐已存 🪙${loan.repaid} / ${loan.amount}（每笔营业收入自动存 10%，不用着急）</div>
          </div>
        `;
      }
    }

    backdrop.innerHTML = `
      <div class="modal-panel paper-panel" style="width: 560px;">
        <div class="modal-header">
          <div class="modal-title">🏺 梦想基金 · 支持开店的前辈</div>
          <button class="modal-close-btn" id="btn-close-fund" title="关闭">&times;</button>
        </div>
        <div class="modal-body">
          <div class="fund-tier-note">
            一位很欣赏你的前辈愿意支持这家店：<strong>没有利息、没有期限</strong>，
            每笔营业收入会自动存 10% 进还款罐，按心意送达的先后一笔笔存满。<br>
            当前阶段「${tier.label}」，前辈最多同时支持 <strong>🪙${cap}</strong>
            （还在路上的心意：🪙${outstanding}）。
          </div>
          <div class="supply-top-bar">
            <span>当前金币: <strong>🪙 ${gold}</strong></span>
            <div style="display:flex;gap:8px;">${applyHtml}</div>
          </div>
          ${loansHtml}
        </div>
      </div>
    `;

    this.root.appendChild(backdrop);

    backdrop.querySelector('#btn-close-fund')?.addEventListener('click', () => this.close());

    backdrop.querySelectorAll('[data-amount]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const amount = Number((e.currentTarget as HTMLElement).getAttribute('data-amount'));
        const res = this.fundManager.apply(amount, this.getFundMetrics());
        if (res.ok) {
          this.ledger.disburseFund(amount);
          this.toast.show(`💌 前辈的支持款 🪙${amount} 已放入钱箱，慢慢来，不着急还~`);
        } else {
          this.toast.show(res.reason ?? '前辈暂时爱莫能助');
        }
        this.render();
      });
    });
  }
}
