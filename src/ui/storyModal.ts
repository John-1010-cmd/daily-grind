export interface StoryEntry {
  portraitIcon: string;
  portraitImage?: string;
  speaker: string;
  title: string;
  text: string;
}

/**
 * 剧情片段弹窗（T3.3 常客故事 / T3.5 店员剧情共用）。
 * 多段故事排队依次展示。
 */
export class StoryModal {
  private root: HTMLElement;
  private queue: StoryEntry[] = [];
  private modalEl: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  public enqueue(entry: StoryEntry): void {
    this.queue.push(entry);
    if (!this.modalEl) {
      this.showNext();
    }
  }

  public isShowing(): boolean {
    return this.modalEl !== null;
  }

  private showNext(): void {
    const entry = this.queue.shift();
    if (!entry) {
      this.modalEl = null;
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop interactive';
    this.modalEl = backdrop;

    backdrop.addEventListener('pointerdown', (e) => e.stopPropagation());

    const portraitHtml = entry.portraitImage
      ? `<img src="${entry.portraitImage}" alt="${entry.speaker}" />`
      : entry.portraitIcon;

    backdrop.innerHTML = `
      <div class="modal-panel paper-panel story-modal-panel">
        <div class="story-portrait">${portraitHtml}</div>
        <div class="story-title">${entry.speaker} · ${entry.title}</div>
        <div class="story-text">${entry.text}</div>
        <button class="btn-action" id="btn-story-next">${this.queue.length > 0 ? '继续' : '好的'}</button>
      </div>
    `;

    this.root.appendChild(backdrop);

    backdrop.querySelector('#btn-story-next')?.addEventListener('click', () => {
      backdrop.parentElement?.removeChild(backdrop);
      this.showNext();
    });
  }
}
