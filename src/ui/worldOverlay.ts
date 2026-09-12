import { Customer } from '../customer';
import { Order } from '../order';

export interface WorldOverlayData {
  customers: readonly Customer[];
  activeOrders: readonly Order[];
  brewingOrder: Order | null;
  guideStepText: string | null;
}

export class WorldOverlay {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    let el = parent.querySelector('#world-overlay') as HTMLElement;
    if (!el) {
      el = document.createElement('div');
      el.id = 'world-overlay';
      el.className = 'world-overlay-layer';
      parent.appendChild(el);
    }
    this.container = el;
  }

  public update(data: WorldOverlayData): void {
    let html = '';

    // 1. Onboarding Guide Bubble (T1.8 首次进入最小引导)
    if (data.guideStepText) {
      html += `
        <div class="guide-banner">
          <span class="guide-icon">💡</span>
          <span class="guide-text">${data.guideStepText}</span>
        </div>
      `;
    }

    // 2. Brewing Progress Bar over Counter
    if (data.brewingOrder) {
      const pct = Math.min(100, Math.round(data.brewingOrder.brewProgress * 100));
      html += `
        <div class="brewing-widget" style="left: 985px; top: 330px;">
          <div class="brewing-label">☕ 正在萃取【${data.brewingOrder.recipe.name}】</div>
          <div class="brewing-bar-bg">
            <div class="brewing-bar-fill" style="width: ${pct}%;"></div>
          </div>
          <div class="brewing-pct">${pct}%</div>
        </div>
      `;
    }

    // 3. Customer Badges and Speech Bubbles
    for (const c of data.customers) {
      if (c.state === 'LEFT') continue;

      let statusBadge = '';
      if (c.state === 'WAITING_FOR_ORDER') {
        statusBadge = '<div class="cust-status-badge badge-order">💬 点击接单</div>';
      } else if (c.state === 'WAITING_FOR_DRINK') {
        statusBadge = `<div class="cust-status-badge badge-wait">⏳ 等待【${c.chosenRecipe?.name || '咖啡'}】</div>`;
      } else if (c.state === 'ENJOYING_DRINK') {
        statusBadge = '<div class="cust-status-badge badge-enjoy">😋 品尝中...</div>';
      } else if (c.state === 'WAITING_TO_PAY') {
        statusBadge = '<div class="cust-status-badge badge-pay">🪙 点击收银</div>';
      }

      let speechBubble = '';
      if (c.bubbleText) {
        speechBubble = `
          <div class="speech-bubble">
            <div class="bubble-text">${c.bubbleText}</div>
            <div class="bubble-arrow"></div>
          </div>
        `;
      }

      html += `
        <div class="customer-overlay-item" style="left: ${c.pos.x}px; top: ${c.pos.y - 40}px;">
          ${speechBubble}
          ${statusBadge}
        </div>
      `;
    }

    this.container.innerHTML = html;
  }
}
