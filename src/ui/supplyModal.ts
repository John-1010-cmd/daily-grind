import {
  EMERGENCY_PACKAGE_CONFIG,
  INGREDIENT_DEFS,
  RECIPE_DEFS,
  SUPPLY_BATCH_DISCOUNTS
} from '../config';
import { EconomyLedger } from '../economy';
import { InventoryManager } from '../inventory';
import { SaveManager } from '../save';
import { ToastManager } from './toast';

export class SupplyModal {
  private root: HTMLElement;
  private inventory: InventoryManager;
  private ledger: EconomyLedger;
  private saveManager: SaveManager;
  private toast: ToastManager;
  private isOpen = false;
  private modalEl: HTMLElement | null = null;
  private selectedBatchIndex = 0; // default 10 units

  constructor(
    root: HTMLElement,
    inventory: InventoryManager,
    ledger: EconomyLedger,
    saveManager: SaveManager,
    toast: ToastManager
  ) {
    this.root = root;
    this.inventory = inventory;
    this.ledger = ledger;
    this.saveManager = saveManager;
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
    if (this.modalEl && this.modalEl.parentElement) {
      this.modalEl.parentElement.removeChild(this.modalEl);
      this.modalEl = null;
    }
  }

  private render(): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop interactive';
    this.modalEl = backdrop;

    backdrop.addEventListener('pointerdown', (e) => e.stopPropagation());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.close();
      }
    });

    const state = this.saveManager.getState();
    const currentGold = state.gold;
    const unlockedDefs = RECIPE_DEFS.filter((r) => state.unlockedRecipes.includes(r.id));
    const isEmergencyEligible = this.inventory.isEmergencyEligible(currentGold, unlockedDefs);

    const batch = SUPPLY_BATCH_DISCOUNTS[this.selectedBatchIndex];

    // Batch selector buttons
    let batchButtonsHtml = '';
    SUPPLY_BATCH_DISCOUNTS.forEach((b, idx) => {
      batchButtonsHtml += `
        <button class="btn-batch ${idx === this.selectedBatchIndex ? 'active' : ''}" data-batch-index="${idx}">
          ${b.label}
        </button>
      `;
    });

    // Ingredient cards
    let ingredientCardsHtml = '';
    for (const def of INGREDIENT_DEFS) {
      const stock = this.inventory.getStock(def.id);
      const reserved = this.inventory.getReserved(def.id);
      const available = this.inventory.getAvailable(def.id);

      const unitCost = def.unitPrice;
      const totalCost = Math.round(unitCost * batch.amount * batch.discountRate);
      const canAfford = currentGold >= totalCost;

      ingredientCardsHtml += `
        <div class="supply-card">
          <div class="supply-card-left">
            <div class="supply-icon">${def.icon}</div>
            <div class="supply-info">
              <div class="supply-name">${def.name}</div>
              <div class="supply-stock">可用库存: <strong>${available}</strong> (总存:${stock}${reserved > 0 ? `, 预占:${reserved}` : ''})</div>
            </div>
          </div>
          <div class="supply-card-right">
            <div class="supply-cost">🪙 ${totalCost} (${batch.amount}份)</div>
            <button class="btn-action btn-buy" data-ingredient-id="${def.id}" data-cost="${totalCost}" data-amount="${batch.amount}" ${canAfford ? '' : 'disabled'}>
              立即进货
            </button>
          </div>
        </div>
      `;
    }

    const emergencyList = Object.entries(EMERGENCY_PACKAGE_CONFIG.ITEMS)
      .map(([k, v]) => `${k === 'coffee_beans' ? '咖啡豆' : k === 'milk' ? '牛奶' : '茶叶'}x${v}`)
      .join(', ');

    backdrop.innerHTML = `
      <div class="modal-panel modal-panel-large">
        <div class="modal-header">
          <div class="modal-title">📦 原料进货仓储</div>
          <button class="modal-close-btn" id="btn-close-supply" title="关闭">&times;</button>
        </div>
        <div class="modal-body supply-modal-body">
          <div class="supply-top-bar">
            <span>当前金币: <strong>🪙 ${currentGold}</strong></span>
            <div class="batch-selector">${batchButtonsHtml}</div>
          </div>

          <!-- 应急原料包裹区域 (T1.7 兜底机制) -->
          <div class="emergency-box ${isEmergencyEligible ? 'highlight' : 'dim'}">
            <div class="emergency-icon">🎁</div>
            <div class="emergency-info">
              <div class="emergency-title">前辈的应急小包裹（无死局兜底）</div>
              <div class="emergency-desc">
                ${
                  isEmergencyEligible
                    ? `检测到金币不足以采购且原料已耗尽！前辈送来一份基础原料包（${emergencyList}），助你重新开工！`
                    : `经营顺利中。当金币低于 🪙${EMERGENCY_PACKAGE_CONFIG.MIN_TRIGGER_GOLD} 且无原料可出杯时自动激活免费领取。`
                }
              </div>
            </div>
            <button class="btn-action btn-emergency" id="btn-claim-emergency" ${isEmergencyEligible ? '' : 'disabled'}>
              ${isEmergencyEligible ? '免费领取应急包裹' : '无需申请'}
            </button>
          </div>

          <div class="supply-grid">
            ${ingredientCardsHtml}
          </div>
        </div>
      </div>
    `;

    this.root.appendChild(backdrop);

    backdrop.querySelector('#btn-close-supply')?.addEventListener('click', () => this.close());

    backdrop.querySelectorAll('.btn-batch').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const idx = Number(target.getAttribute('data-batch-index'));
        if (!isNaN(idx)) {
          this.selectedBatchIndex = idx;
          this.render();
        }
      });
    });

    backdrop.querySelectorAll('.btn-buy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const ingId = target.getAttribute('data-ingredient-id');
        const cost = Number(target.getAttribute('data-cost'));
        const amount = Number(target.getAttribute('data-amount'));
        if (!ingId || isNaN(cost) || isNaN(amount)) return;
        this.buySupplies(ingId, amount, cost);
      });
    });

    backdrop.querySelector('#btn-claim-emergency')?.addEventListener('click', () => {
      const success = this.inventory.claimEmergencyPackage(currentGold, unlockedDefs);
      if (success) {
        // Sync inventory to save
        this.saveManager.updateState((draft) => {
          draft.inventory = this.inventory.getAllStock();
        });
        this.toast.show('🎉 已成功领取前辈的应急原料小包裹！继续经营吧~');
        this.render();
      }
    });
  }

  private buySupplies(ingredientId: string, amount: number, cost: number): void {
    const currentGold = this.saveManager.getState().gold;
    if (currentGold < cost) {
      this.toast.show('金币不足以购买此规格！');
      return;
    }

    const def = INGREDIENT_DEFS.find((i) => i.id === ingredientId);
    if (!def) return;

    // Settle expense via ledger
    this.ledger.settleSupplyPurchase(def.name, amount, cost);

    // Add to inventory
    this.inventory.addStock(ingredientId, amount);

    // Sync save state
    this.saveManager.updateState((draft) => {
      draft.inventory = this.inventory.getAllStock();
    });

    this.toast.show(`已成功进货【${def.name}】x${amount}，花费 🪙${cost}`);
    this.render();
  }
}
