import { REGULAR_DEFS, RECIPE_DEFS } from '../config';
import { AchievementManager } from '../achievements';
import { DecorManager } from '../decor';
import { RegularManager } from '../regulars';
import { SaveManager } from '../save';
import { drinkIconHtml } from './drinkIcons';

type HandbookTab = 'regulars' | 'drinks' | 'furniture' | 'cat' | 'achievements';

const TAB_DEFS: { id: HandbookTab; label: string }[] = [
  { id: 'regulars', label: '常客' },
  { id: 'drinks', label: '饮品' },
  { id: 'furniture', label: '家具' },
  { id: 'cat', label: '猫咪' },
  { id: 'achievements', label: '成就' }
];

const CAT_POSE_ENTRIES = [
  { id: 'curled', name: '蜷卧团子睡', icon: '🐱', description: '把自己团成一颗橘色毛线球。' },
  { id: 'stretch', name: '侧卧伸展睡', icon: '😺', description: '四脚朝天伸懒腰式睡法。' },
  { id: 'blink', name: '眯眼打盹', icon: '😽', description: '被摸舒服了，眯起眼睛呼噜呼噜。' }
];

/**
 * 图鉴面板（T3.4）：常客 / 饮品 / 家具 / 猫咪 + 成就页签。
 */
export class HandbookModal {
  private root: HTMLElement;
  private saveManager: SaveManager;
  private regularManager: RegularManager;
  private decorManager: DecorManager;
  private achievementManager: AchievementManager;
  private isOpen = false;
  private modalEl: HTMLElement | null = null;
  private activeTab: HandbookTab = 'regulars';

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    regularManager: RegularManager,
    decorManager: DecorManager,
    achievementManager: AchievementManager
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.regularManager = regularManager;
    this.decorManager = decorManager;
    this.achievementManager = achievementManager;
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

    const tabsHtml = TAB_DEFS.map(
      (t) => `<button class="tab-btn ${t.id === this.activeTab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
    ).join('');

    backdrop.innerHTML = `
      <div class="modal-panel modal-panel-large paper-panel">
        <div class="modal-header">
          <div class="modal-title">📕 咖啡馆图鉴</div>
          <button class="modal-close-btn" id="btn-close-handbook" title="关闭">&times;</button>
        </div>
        <div class="modal-body">
          <div class="tab-bar">${tabsHtml}</div>
          <div class="recipe-scroll-area" style="max-height: 380px; overflow-y: auto;">
            ${this.renderTabContent()}
          </div>
        </div>
      </div>
    `;

    this.root.appendChild(backdrop);

    backdrop.querySelector('#btn-close-handbook')?.addEventListener('click', () => this.close());

    backdrop.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.activeTab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as HandbookTab;
        this.render();
      });
    });
  }

  private renderTabContent(): string {
    switch (this.activeTab) {
      case 'regulars':
        return this.renderRegulars();
      case 'drinks':
        return this.renderDrinks();
      case 'furniture':
        return this.renderFurniture();
      case 'cat':
        return this.renderCat();
      case 'achievements':
        return this.renderAchievements();
    }
  }

  private renderRegulars(): string {
    const cards = REGULAR_DEFS.map((def) => {
      const met = this.regularManager.hasMet(def.id);
      const favor = this.regularManager.getFavor(def.id);
      const state = this.regularManager.getState(def.id);
      const storiesTotal = def.stories.length;
      const storiesSeen = state.storiesSeen.length;
      const exclusive = this.regularManager.isExclusiveUnlocked(def.id);

      return `
        <div class="handbook-card ${met ? '' : 'locked'}">
          <div class="hb-icon">${met ? def.portraitIcon : '❔'}</div>
          <div class="hb-name">${met ? def.name : '？？？'}</div>
          <div class="hb-sub">${met ? def.job : '还未光顾过的神秘客人'}</div>
          ${met ? `
            <div class="hb-favor">好感 ❤ ${favor}</div>
            <div class="hb-sub">故事 ${storiesSeen}/${storiesTotal}${exclusive ? ' · 专属点单已解锁' : ''}</div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `<div class="handbook-grid">${cards}</div>`;
  }

  private renderDrinks(): string {
    const save = this.saveManager.getState();
    const cards = RECIPE_DEFS.map((r) => {
      const unlocked = save.unlockedRecipes.includes(r.id);
      const sold = save.recipeMastery[r.id] || 0;
      const icon = r.lineId === 'espresso' ? '☕' : r.lineId === 'tea' ? '🍵' : '🥐';
      return `
        <div class="handbook-card ${unlocked ? '' : 'locked'}">
          <div class="hb-icon">${unlocked ? drinkIconHtml(r.id, icon, 48) : '❔'}</div>
          <div class="hb-name">${unlocked ? r.name : '？？？'}</div>
          <div class="hb-sub">${unlocked ? `${r.lineName} · 已售 ${sold} 杯` : '尚未研习的配方'}</div>
        </div>
      `;
    }).join('');

    return `<div class="handbook-grid">${cards}</div>`;
  }

  private renderFurniture(): string {
    const cards: string[] = [];
    for (const slot of this.decorManager.getSlots()) {
      for (const variant of slot.variants) {
        const owned = this.decorManager.isVariantOwned(slot.id, variant.id);
        const selected = this.decorManager.getSelectedVariantId(slot.id) === variant.id;
        cards.push(`
          <div class="handbook-card ${owned ? '' : 'locked'}">
            <div class="hb-icon">${owned ? slot.icon : '❔'}</div>
            <div class="hb-name">${owned ? variant.name : '？？？'}</div>
            <div class="hb-sub">${owned ? `${slot.name}${selected ? ' · 布置中' : ''}` : '还未置办的款式'}</div>
          </div>
        `);
      }
    }
    return `<div class="handbook-grid">${cards.join('')}</div>`;
  }

  private renderCat(): string {
    const seen = new Set(this.saveManager.getState().catPosesSeen);
    const cards = CAT_POSE_ENTRIES.map((p) => {
      const found = seen.has(p.id);
      return `
        <div class="handbook-card ${found ? '' : 'locked'}">
          <div class="hb-icon">${found ? p.icon : '❔'}</div>
          <div class="hb-name">${found ? p.name : '？？？'}</div>
          <div class="hb-sub">${found ? p.description : '还没见过这种睡姿'}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="fund-tier-note">橘猫的睡姿本身就是收集品——它换地方、换姿势时留意看看。</div>
      <div class="handbook-grid">${cards}</div>
    `;
  }

  private renderAchievements(): string {
    const defs = this.achievementManager.getAllDefs();
    const categoryNames: Record<string, string> = {
      business: '经营',
      relation: '关系',
      collection: '收集',
      branch: '分店'
    };

    const cards = defs.map((def) => {
      const unlocked = this.achievementManager.isUnlocked(def.id);
      const rewardText = 'gold' in def.reward ? `🪙+${def.reward.gold}` : `徽章「${def.reward.badge}」`;
      return `
        <div class="handbook-card ${unlocked ? '' : 'locked'}">
          <div class="hb-icon">${unlocked ? '🏅' : '🔒'}</div>
          <div class="hb-name">${def.name}</div>
          <div class="hb-sub">【${categoryNames[def.category]}】${def.description}</div>
          <div class="hb-favor">${unlocked ? `已达成 · ${rewardText}` : rewardText}</div>
        </div>
      `;
    }).join('');

    return `<div class="handbook-grid">${cards}</div>`;
  }
}
