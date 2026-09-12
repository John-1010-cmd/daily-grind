import { RECIPE_DEFS } from '../config';
import { EconomyLedger } from '../economy';
import { EquipmentManager } from '../equipment';
import { SaveManager } from '../save';
import { ToastManager } from './toast';

export class RecipesModal {
  private root: HTMLElement;
  private saveManager: SaveManager;
  private ledger: EconomyLedger;
  private toast: ToastManager;
  private equipmentManager: EquipmentManager | null = null;
  private isOpen = false;
  private modalEl: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    ledger: EconomyLedger,
    toast: ToastManager
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.ledger = ledger;
    this.toast = toast;
  }

  public setEquipmentManager(equipmentManager: EquipmentManager): void {
    this.equipmentManager = equipmentManager;
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
    const unlockedSet = new Set<string>(state.unlockedRecipes);
    const mastery = state.recipeMastery || {};
    const currentGold = state.gold;

    const lines = [
      { id: 'espresso', name: '☕ 意式咖啡线' },
      { id: 'tea', name: '🍃 茶饮特调线' },
      { id: 'bakery', name: '🥐 甜点烘焙线' }
    ];

    let linesHtml = '';
    for (const line of lines) {
      const recipesInLine = RECIPE_DEFS.filter((r) => r.lineId === line.id);
      let cardsHtml = '';

      for (const recipe of recipesInLine) {
        const isUnlocked = unlockedSet.has(recipe.id);
        const soldCount = mastery[recipe.id] || 0;

        // Check prerequisites
        let prereqMet = true;
        let prereqText = '';
        if (recipe.prerequisiteRecipeId && recipe.prerequisiteMasteryCount) {
          const prereqRecipe = RECIPE_DEFS.find((r) => r.id === recipe.prerequisiteRecipeId);
          const prereqSoldCount = mastery[recipe.prerequisiteRecipeId] || 0;
          if (prereqSoldCount < recipe.prerequisiteMasteryCount) {
            prereqMet = false;
            prereqText = `需先售出 ${recipe.prerequisiteMasteryCount} 杯【${prereqRecipe?.name || ''}】(当前:${prereqSoldCount})`;
          }
        }

        const canAfford = currentGold >= recipe.unlockCost;
        const canUnlock = !isUnlocked && prereqMet && canAfford;

        const ingredientList = Object.entries(recipe.ingredients)
          .map(([k, v]) => `${k === 'coffee_beans' ? '咖啡豆' : k === 'milk' ? '牛奶' : k === 'tea_leaves' ? '茶叶' : k === 'fruits' ? '水果' : k === 'syrup' ? '糖浆' : '烘焙粉'}x${v}`)
          .join(', ');

        cardsHtml += `
          <div class="recipe-card ${isUnlocked ? 'unlocked' : 'locked'}">
            <div class="recipe-header">
              <div class="recipe-name">${recipe.name}</div>
              <div class="recipe-price">🪙 售价 ${recipe.price}</div>
            </div>
            <div class="recipe-meta">
              <span>原料: ${ingredientList}</span> | <span>制作耗时: ${recipe.brewTimeSeconds}秒</span>
            </div>
            <div class="recipe-footer">
              ${
                isUnlocked
                  ? `<div class="recipe-status success">✓ 已解锁 (累计售出 ${soldCount} 杯)</div>`
                  : `
                    <div class="recipe-lock-info">
                      ${prereqText ? `<div class="prereq-note">${prereqText}</div>` : ''}
                      <button class="btn-action btn-unlock" data-recipe-id="${recipe.id}" ${canUnlock ? '' : 'disabled'}>
                        解锁配方 (🪙 ${recipe.unlockCost})
                      </button>
                    </div>
                  `
              }
            </div>
          </div>
        `;
      }

      linesHtml += `
        <div class="recipe-line-group">
          <div class="recipe-line-title">${line.name}</div>
          <div class="recipe-grid">${cardsHtml}</div>
        </div>
      `;
    }

    backdrop.innerHTML = `
      <div class="modal-panel modal-panel-large">
        <div class="modal-header">
          <div class="modal-title">📖 咖啡馆配方研习手册</div>
          <button class="modal-close-btn" id="btn-close-recipes" title="关闭">&times;</button>
        </div>
        <div class="modal-body recipe-modal-body">
          <div class="recipe-intro-bar">
            <span>当前金币: <strong>🪙 ${currentGold}</strong></span>
            <span>已解锁: <strong>${unlockedSet.size} / ${RECIPE_DEFS.length} 款</strong></span>
          </div>
          ${this.renderEquipmentSection(currentGold)}
          <div class="recipe-scroll-area">
            ${linesHtml}
          </div>
        </div>
      </div>
    `;

    this.root.appendChild(backdrop);

    backdrop.querySelector('#btn-close-recipes')?.addEventListener('click', () => this.close());

    backdrop.querySelector('#btn-upgrade-equipment')?.addEventListener('click', () => {
      if (!this.equipmentManager) return;
      const next = this.equipmentManager.getNextDef();
      if (this.equipmentManager.upgrade(this.ledger)) {
        this.toast.show(`🎉 设备升级为【${next?.label}】！制作更快${next && next.brewSlots > 1 ? '，可同时做两杯' : ''}~`);
        this.render();
      } else {
        this.toast.show('金币还不够升级设备，多做几单吧~');
      }
    });

    backdrop.querySelectorAll('.btn-unlock').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const recipeId = target.getAttribute('data-recipe-id');
        if (!recipeId) return;
        this.unlockRecipe(recipeId);
      });
    });
  }

  private renderEquipmentSection(currentGold: number): string {
    if (!this.equipmentManager) return '';
    const current = this.equipmentManager.getCurrentDef();
    const next = this.equipmentManager.getNextDef();
    if (!next) {
      return `
        <div class="fund-tier-note">
          ⚙️ 当前设备：<strong>${current.label}</strong>（已是最高级，出品快 ${Math.round((1 - current.brewSpeedMultiplier) * 100)}%，双杯并行）
        </div>
      `;
    }
    const canAfford = currentGold >= next.upgradeCost;
    return `
      <div class="fund-tier-note" style="display:flex;align-items:center;gap:12px;">
        <div style="flex:1;">
          ⚙️ 当前设备：<strong>${current.label}</strong> — ${current.description}<br>
          下一级：<strong>${next.label}</strong> — ${next.description}
        </div>
        <button class="btn-action btn-buy" id="btn-upgrade-equipment" ${canAfford ? '' : 'disabled'}>
          升级设备（🪙${next.upgradeCost}）
        </button>
      </div>
    `;
  }

  private unlockRecipe(recipeId: string): void {
    const recipe = RECIPE_DEFS.find((r) => r.id === recipeId);
    if (!recipe) return;

    const currentGold = this.saveManager.getState().gold;
    if (currentGold < recipe.unlockCost) {
      this.toast.show('金币不足，多做几单再来解锁吧！');
      return;
    }

    // Settle expense
    this.ledger.settleRecipeUnlock(recipe.name, recipe.unlockCost);

    // Save unlock
    this.saveManager.updateState((draft) => {
      if (!draft.unlockedRecipes.includes(recipe.id)) {
        draft.unlockedRecipes.push(recipe.id);
      }
      if (!draft.recipeMastery) draft.recipeMastery = {};
      if (draft.recipeMastery[recipe.id] === undefined) {
        draft.recipeMastery[recipe.id] = 0;
      }
    });

    this.toast.show(`🎉 恭喜解锁新配方【${recipe.name}】！`);
    // Re-render modal to reflect changes
    this.render();
  }
}
