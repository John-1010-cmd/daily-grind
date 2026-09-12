import seasideSceneUrl from '../assets/scene/scene-seaside.webp';
import { ShopId } from '../config';
import { BranchManager } from '../shop';
import { ToastManager } from './toast';

export class MapModal {
  private modalEl: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private branchManager: BranchManager,
    private toast: ToastManager,
    private getActiveShopId: () => ShopId,
    private onTravel: (shopId: ShopId) => { ok: boolean; reason?: string; releasedTaskCount?: number }
  ) {}

  public open(): void {
    if (this.modalEl) return;
    this.render();
  }

  public close(): void {
    this.modalEl?.remove();
    this.modalEl = null;
  }

  private render(): void {
    this.close();
    const status = this.branchManager.getSeasideStatus();
    const prereqHtml = status.prerequisites.map((item) => `
      <li class="map-condition ${item.met ? 'met' : ''}">
        <span>${item.met ? '✓' : '○'} ${item.name}</span>
        <small>${item.description}</small>
      </li>
    `).join('');
    const activeShopId = this.getActiveShopId();
    const actionLabel = status.unlocked
      ? activeShopId === 'main' ? '前往海风分店' : '返回街角本店'
      : `准备海风分店 · 🪙${status.cost}`;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop interactive';
    backdrop.innerHTML = `
      <div class="modal-panel modal-panel-large paper-panel map-panel">
        <div class="modal-header">
          <div class="modal-title">🗺️ 分店地图</div>
          <button class="modal-close-btn" data-close title="关闭">&times;</button>
        </div>
        <div class="modal-body">
          <div class="map-branch-card ${status.unlocked ? 'unlocked' : ''}">
            <img src="${seasideSceneUrl}" alt="海风分店水彩场景预览" />
            <div class="map-branch-copy">
              <h3>海风分店</h3>
              <p>窗外是缓慢起伏的海。等菜单、街坊和准备金都稳稳当当，就去那里开一扇新门。</p>
              <ul>${prereqHtml}</ul>
              <div class="map-gold-progress">准备金：🪙${status.gold} / ${status.cost} ${status.hasEnoughGold ? '✓' : ''}</div>
              <button class="btn-action" data-action ${!status.unlocked && (!status.prerequisitesMet || !status.hasEnoughGold) ? 'disabled' : ''}>${actionLabel}</button>
              <div class="fund-tier-note">没有期限，也不会错过。等一切准备好再出发就好。</div>
            </div>
          </div>
        </div>
      </div>
    `;
    backdrop.addEventListener('pointerdown', (event) => event.stopPropagation());
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) this.close();
    });
    backdrop.querySelector('[data-close]')?.addEventListener('click', () => this.close());
    backdrop.querySelector('[data-action]')?.addEventListener('click', () => {
      if (!status.unlocked) {
        const result = this.branchManager.unlockSeaside();
        this.toast.show(result.ok ? '🌊 海风分店准备好了！地图上多了一处可以慢慢经营的地方。' : (result.reason ?? '暂时还不能准备分店'));
        this.render();
        return;
      }
      const target = activeShopId === 'main' ? 'seaside' : 'main';
      const result = this.onTravel(target);
      if (!result.ok) {
        this.toast.show(result.reason ?? '现在还不方便出发');
        return;
      }
      const releasedNote = result.releasedTaskCount
        ? `，${result.releasedTaskCount} 项尚未开始的工作已轻轻放回队列`
        : '';
      this.toast.show(`${target === 'seaside' ? '🌊 已来到海风分店' : '🏡 已回到街角本店'}${releasedNote}`);
      this.close();
    });
    this.root.appendChild(backdrop);
    this.modalEl = backdrop;
  }
}
