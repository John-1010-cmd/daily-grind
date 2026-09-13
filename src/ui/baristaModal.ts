import ownerUrl from '../assets/scene/owner-1x4.webp';
import { BARISTA_UI_CONFIG } from '../config';

export interface BaristaModalOptions {
  recipeName: string;
  onStart: () => boolean | void;
  onCancel?: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** 玩家亲手制作时的沉浸式吧台反馈；不包含失败判定或配方惩罚。 */
export class BaristaModal {
  private modalEl: HTMLElement | null = null;
  private completionTimer: number | null = null;

  constructor(private readonly root: HTMLElement) {}

  public isOpen(): boolean {
    return this.modalEl !== null;
  }

  public open(options: BaristaModalOptions): void {
    if (this.modalEl) return;
    const recipeName = escapeHtml(options.recipeName);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop interactive barista-backdrop';
    backdrop.innerHTML = `
      <section class="modal-panel paper-panel barista-panel" data-barista-panel aria-label="玩家吧台操作台">
        <button class="modal-close-btn barista-close" data-barista-close aria-label="暂不制作">&times;</button>
        <div class="barista-heading">
          <span class="barista-kicker">店主亲手制作</span>
          <h2>今天这杯「${recipeName}」</h2>
          <p data-barista-status>准备好后，和咖啡机一起慢慢把香气唤醒。</p>
        </div>
        <div class="barista-workbench" aria-hidden="true">
          <img class="barista-owner" src="${ownerUrl}" alt="" />
          <div class="barista-machine">
            <i class="barista-steam steam-one"></i><i class="barista-steam steam-two"></i>
            <div class="barista-dial"><span></span></div>
            <div class="barista-portafilter"></div>
            <div class="barista-cup">☕</div>
          </div>
        </div>
        <div class="barista-steps">
          <div data-barista-step><span>1</span><b>磨豆</b><small>听豆子沙沙落下</small></div>
          <div data-barista-step><span>2</span><b>压粉</b><small>轻轻压平粉床</small></div>
          <div data-barista-step><span>3</span><b>萃取</b><small>看琥珀色慢慢流出</small></div>
          <div data-barista-step><span>4</span><b>出杯</b><small>把温度稳稳接住</small></div>
        </div>
        <div class="barista-progress" aria-label="制作进度">
          <div data-barista-progress></div>
        </div>
        <button class="btn-action barista-start" data-barista-start>系好围裙，开始制作</button>
      </section>`;
    backdrop.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.root.appendChild(backdrop);
    this.modalEl = backdrop;

    backdrop.querySelector('[data-barista-close]')?.addEventListener('click', () => {
      options.onCancel?.();
      this.close();
    });
    backdrop.querySelector('[data-barista-start]')?.addEventListener('click', () => {
      const result = options.onStart();
      if (result === false) return;
      backdrop.querySelector('[data-barista-close]')?.remove();
      backdrop.querySelector('[data-barista-start]')?.remove();
      backdrop.querySelector('[data-barista-panel]')?.classList.add('is-working');
      const status = backdrop.querySelector('[data-barista-status]');
      if (status) status.textContent = '不用着急，每一步都会稳稳完成。';
      this.updateProgress(0);
    });
  }

  public updateProgress(progress: number): void {
    if (!this.modalEl) return;
    const normalized = Math.max(0, Math.min(1, progress));
    const fill = this.modalEl.querySelector('[data-barista-progress]') as HTMLElement | null;
    if (fill) fill.style.width = `${Math.round(normalized * 100)}%`;
    const steps = Array.from(this.modalEl.querySelectorAll('[data-barista-step]'));
    steps.forEach((step, index) => {
      const done = normalized >= BARISTA_UI_CONFIG.STEP_THRESHOLDS[index];
      const previousDone = index === 0 || normalized >= BARISTA_UI_CONFIG.STEP_THRESHOLDS[index - 1];
      step.classList.toggle('is-done', done);
      step.classList.toggle('is-active', !done && previousDone);
    });
  }

  public complete(): void {
    if (!this.modalEl) return;
    this.updateProgress(1);
    this.modalEl.querySelector('[data-barista-panel]')?.classList.add('is-complete');
    const status = this.modalEl.querySelector('[data-barista-status]');
    if (status) status.textContent = '香气刚刚好，这杯已经稳稳出杯。';
    this.completionTimer = window.setTimeout(() => this.close(), BARISTA_UI_CONFIG.COMPLETE_HOLD_MS);
  }

  public close(): void {
    if (this.completionTimer !== null) {
      window.clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
    this.modalEl?.remove();
    this.modalEl = null;
  }
}
