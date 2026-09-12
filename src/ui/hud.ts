import { TimePeriodConfig, UI_CONFIG } from '../config';
import { EconomyLedger } from '../economy';
import { InventoryManager } from '../inventory';
import { SaveManager } from '../save';
import { DecorModal } from './decorModal';
import { FundModal } from './fundModal';
import { HandbookModal } from './handbookModal';
import { hudIconHtml } from './hudIcons';
import { RecipesModal } from './recipesModal';
import { SettingsModal } from './settings';
import { StaffModal } from './staffModal';
import { MapModal } from './mapModal';
import { SupplyModal } from './supplyModal';
import { ToastManager } from './toast';

export interface HudCallbacks {
  onToggleDebug: (enabled: boolean) => void;
  onResetGame?: () => void;
}

export interface HudM3Modals {
  decorModal: DecorModal;
  fundModal: FundModal;
  staffModal: StaffModal;
  handbookModal: HandbookModal;
  mapModal: MapModal;
}

export class Hud {
  private root: HTMLElement;
  private saveManager: SaveManager;
  private inventory: InventoryManager;
  private ledger: EconomyLedger;
  private toast: ToastManager;
  private callbacks: HudCallbacks;
  private audioManager: AudioManager;

  private goldValueEl!: HTMLElement;
  private periodIconEl!: HTMLElement;
  private periodLabelEl!: HTMLElement;
  private settingsModal: SettingsModal;
  private recipesModal: RecipesModal;
  private supplyModal: SupplyModal;
  private m3Modals: HudM3Modals | null = null;
  private debugBtnEl!: HTMLElement;

  private isDebugActive: boolean = false;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    inventory: InventoryManager,
    ledger: EconomyLedger,
    toast: ToastManager,
    callbacks: HudCallbacks,
    audioManager: AudioManager
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.inventory = inventory;
    this.ledger = ledger;
    this.toast = toast;
    this.callbacks = callbacks;
    this.audioManager = audioManager;
    this.isDebugActive = saveManager.getState().settings.debugNavOverlay;

    this.settingsModal = new SettingsModal(
      this.root,
      this.saveManager,
      this.toast,
      this.audioManager,
      () => {
        this.callbacks.onResetGame?.();
      }
    );

    this.recipesModal = new RecipesModal(
      this.root,
      this.saveManager,
      this.ledger,
      this.toast
    );

    this.supplyModal = new SupplyModal(
      this.root,
      this.inventory,
      this.ledger,
      this.saveManager,
      this.toast
    );

    this.render();
    this.bindSaveState();
  }

  public setM3Modals(modals: HudM3Modals): void {
    this.m3Modals = modals;
  }

  public getRecipesModal(): RecipesModal {
    return this.recipesModal;
  }

  public getSupplyModal(): SupplyModal {
    return this.supplyModal;
  }

  private render(): void {
    const hudLayer = document.createElement('div');
    hudLayer.className = 'hud-layer';

    // 1. Top Left: Gold + Time Period
    const hudLeft = document.createElement('div');
    hudLeft.className = 'hud-left';

    // Gold badge
    const goldBadge = document.createElement('div');
    goldBadge.className = 'hud-badge';
    goldBadge.title = '当前金币';
    goldBadge.innerHTML = `<span class="icon">🪙</span><span id="hud-gold-val">0</span>`;
    this.goldValueEl = goldBadge.querySelector('#hud-gold-val') as HTMLElement;
    hudLeft.appendChild(goldBadge);

    // Period badge
    const periodBadge = document.createElement('div');
    periodBadge.className = 'hud-badge';
    periodBadge.title = '当前时段（随游玩时长推移）';
    periodBadge.innerHTML = `<span class="icon" id="hud-period-icon">☀️</span><span id="hud-period-label">午后</span>`;
    this.periodIconEl = periodBadge.querySelector('#hud-period-icon') as HTMLElement;
    this.periodLabelEl = periodBadge.querySelector('#hud-period-label') as HTMLElement;
    hudLeft.appendChild(periodBadge);

    // 2. Top Right: Buttons row (配方 / 进货 / 装修 / 图鉴 / 分店地图 / 梦想基金 / 设置)
    const hudRight = document.createElement('div');
    hudRight.className = 'hud-right';

    for (const btnDef of UI_CONFIG.TOP_NAV_BUTTONS) {
      const flags = btnDef as { enabledInM3?: boolean; enabledInM5?: boolean };
      const isEnabled = Boolean(flags.enabledInM5 ?? flags.enabledInM3 ?? btnDef.enabledInM1);
      const btn = document.createElement('button');
      btn.className = `hud-btn ${isEnabled ? '' : 'disabled'}`;
      btn.title = btnDef.label;
      btn.innerHTML = `<span class="btn-icon">${hudIconHtml(btnDef.id, btnDef.icon)}</span><span>${btnDef.label}</span>`;

      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnDef.id === 'settings') {
          this.settingsModal.open();
        } else if (btnDef.id === 'recipes') {
          this.recipesModal.open();
        } else if (btnDef.id === 'supply') {
          this.supplyModal.open();
        } else if (btnDef.id === 'decor') {
          this.m3Modals?.decorModal.open();
        } else if (btnDef.id === 'fund') {
          this.m3Modals?.fundModal.open();
        } else if (btnDef.id === 'staff') {
          this.m3Modals?.staffModal.open();
        } else if (btnDef.id === 'handbook') {
          this.m3Modals?.handbookModal.open();
        } else if (btnDef.id === 'map') {
          this.m3Modals?.mapModal.open();
        }
      });

      hudRight.appendChild(btn);
    }

    hudLayer.appendChild(hudLeft);
    hudLayer.appendChild(hudRight);
    this.root.appendChild(hudLayer);

    // 3. Debug Overlay Toggle (Bottom Left)
    const debugBar = document.createElement('div');
    debugBar.className = 'debug-bar';
    const debugBtn = document.createElement('button');
    debugBtn.className = `debug-btn ${this.isDebugActive ? 'active' : ''}`;
    debugBtn.textContent = `导航调试图: ${this.isDebugActive ? '开' : '关'}`;
    this.debugBtnEl = debugBtn;

    debugBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    debugBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isDebugActive = !this.isDebugActive;
      this.debugBtnEl.className = `debug-btn ${this.isDebugActive ? 'active' : ''}`;
      this.debugBtnEl.textContent = `导航调试图: ${this.isDebugActive ? '开' : '关'}`;
      this.saveManager.setDebugNavOverlay(this.isDebugActive);
      this.callbacks.onToggleDebug(this.isDebugActive);
      this.toast.show(`导航调试视图已${this.isDebugActive ? '开启' : '关闭'}`);
    });

    debugBar.appendChild(debugBtn);
    this.root.appendChild(debugBar);
  }

  private bindSaveState(): void {
    this.saveManager.subscribe((state) => {
      if (this.goldValueEl) {
        this.goldValueEl.textContent = state.gold.toLocaleString('zh-CN');
      }
    });
  }

  public updatePeriod(period: TimePeriodConfig): void {
    if (this.periodIconEl && this.periodLabelEl) {
      this.periodIconEl.textContent = period.icon;
      this.periodLabelEl.textContent = period.label;
    }
  }

  public openSettings(): void {
    this.settingsModal.open();
  }

  public openRecipes(): void {
    this.recipesModal.open();
  }

  public openSupply(): void {
    this.supplyModal.open();
  }
}
import { AudioManager } from '../audio';
