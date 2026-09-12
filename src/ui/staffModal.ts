import { STAFF_CONFIG, STAFF_MEMBER_DEF, StaffDuty } from '../config';
import { SaveManager } from '../save';
import { StaffMember } from '../staff';
import { ToastManager } from './toast';

/**
 * 店员面板（T3.5）：雇佣 / 职责指派 / 剧情线 / 工资说明。
 */
export class StaffModal {
  private root: HTMLElement;
  private saveManager: SaveManager;
  private staffMember: StaffMember;
  private toast: ToastManager;
  private isOpen = false;
  private modalEl: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    staffMember: StaffMember,
    toast: ToastManager
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.staffMember = staffMember;
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
    const hired = this.staffMember.isHired();
    const duties = new Set(this.staffMember.getDuties());
    const autoOrders = this.saveManager.getState().staff.autoOrdersCompleted;

    let bodyHtml = '';

    if (!hired) {
      const canHire = this.staffMember.canHire();
      bodyHtml = `
        <div class="staff-hero">
          <div class="staff-avatar">${STAFF_MEMBER_DEF.portraitIcon}</div>
          <div>
            <div style="font-weight:700;font-size:16px;">${STAFF_MEMBER_DEF.name} · ${STAFF_MEMBER_DEF.job}</div>
            <div style="font-size:13px;color:#8c6239;margin-top:4px;">${STAFF_MEMBER_DEF.description}</div>
          </div>
        </div>
        <div class="fund-tier-note">
          雇佣后小晴会在店里自动帮忙，你可以指派她的职责。<br>
          一次性雇佣费 🪙${STAFF_CONFIG.HIRE_FEE}；入职后她从每笔营业收入拿 ${Math.round(STAFF_CONFIG.WAGE_RATE * 100)}% 作为工资——没收入时她不拿钱，也从不抱怨。
        </div>
        <div class="supply-top-bar">
          <span>当前金币: <strong>🪙 ${gold}</strong></span>
          <button class="btn-action btn-buy" id="btn-hire" ${canHire.ok ? '' : 'disabled'}>
            邀请小晴来帮忙（🪙${STAFF_CONFIG.HIRE_FEE}）
          </button>
        </div>
        ${canHire.ok ? '' : `<div style="font-size:12px;color:#a08a70;">${canHire.reason}</div>`}
      `;
    } else {
      const dutyRows = (Object.keys(STAFF_CONFIG.DUTY_LABELS) as StaffDuty[])
        .map(
          (duty) => `
          <label class="staff-duty-row">
            <input type="checkbox" data-duty="${duty}" ${duties.has(duty) ? 'checked' : ''} />
            <span>${STAFF_CONFIG.DUTY_LABELS[duty]}</span>
            <span style="font-size:12px;color:#a08a70;">${
              duty === 'AUTO_SUPPLY' ? '（不抢订单任务，空闲且库存低时才采购）' : ''
            }</span>
          </label>
        `
        )
        .join('');

      const storiesHtml = STAFF_MEMBER_DEF.stories
        .map((s) => {
          const seen = this.staffMember.getStoriesSeen().includes(s.id);
          return `<div class="fund-loan-card ${seen ? '' : 'repaid'}">
            ${seen ? `📖 <strong>${s.title}</strong>：${s.text}` : '🔒 还未读到的故事……'}
          </div>`;
        })
        .join('');

      const busyLabel = this.staffMember.getCurrentWorkLabel();

      bodyHtml = `
        <div class="staff-hero">
          <div class="staff-avatar">${STAFF_MEMBER_DEF.portraitIcon}</div>
          <div>
            <div style="font-weight:700;font-size:16px;">${STAFF_MEMBER_DEF.name} 在岗中</div>
            <div style="font-size:13px;color:#8c6239;margin-top:4px;">
              ${busyLabel ? `正在：${busyLabel}` : '待命中'} · 已自动完成订单 ${autoOrders} 笔 · 工资为营业收入的 ${Math.round(STAFF_CONFIG.WAGE_RATE * 100)}%
            </div>
          </div>
        </div>
        <div class="setting-label">职责指派</div>
        ${dutyRows}
        <div class="setting-label" style="margin-top:14px;">小晴的故事</div>
        ${storiesHtml}
      `;
    }

    backdrop.innerHTML = `
      <div class="modal-panel paper-panel" style="width: 560px;">
        <div class="modal-header">
          <div class="modal-title">🧑‍🍳 店员伙伴</div>
          <button class="modal-close-btn" id="btn-close-staff" title="关闭">&times;</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    `;

    this.root.appendChild(backdrop);

    backdrop.querySelector('#btn-close-staff')?.addEventListener('click', () => this.close());

    backdrop.querySelector('#btn-hire')?.addEventListener('click', () => {
      if (this.staffMember.hire()) {
        this.toast.show(`🎉 ${STAFF_MEMBER_DEF.name} 正式入职！去面板里给她指派职责吧~`);
        this.render();
      } else {
        this.toast.show('金币还不够雇佣费，再攒一攒~');
      }
    });

    backdrop.querySelectorAll('input[data-duty]').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const el = e.currentTarget as HTMLInputElement;
        const duty = el.getAttribute('data-duty') as StaffDuty;
        this.staffMember.setDuty(duty, el.checked);
        this.toast.show(
          el.checked
            ? `已把「${STAFF_CONFIG.DUTY_LABELS[duty]}」交给小晴`
            : `小晴不再负责「${STAFF_CONFIG.DUTY_LABELS[duty]}」`
        );
      });
    });
  }
}
