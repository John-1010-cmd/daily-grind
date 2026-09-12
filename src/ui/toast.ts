import { UI_CONFIG } from '../config';

export class ToastManager {
  private container: HTMLElement;

  constructor(parent: HTMLElement) {
    let existing = parent.querySelector('.toast-container') as HTMLElement;
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'toast-container';
      parent.appendChild(existing);
    }
    this.container = existing;
  }

  public show(message: string, durationMs: number = UI_CONFIG.TOAST_DURATION_MS): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 300);
    }, durationMs);
  }
}
