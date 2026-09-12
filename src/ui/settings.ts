import { AudioManager } from '../audio';
import { AUDIO_CONFIG } from '../config';
import { SaveManager } from '../save';
import { ToastManager } from './toast';

export class SettingsModal {
  private root: HTMLElement;
  private saveManager: SaveManager;
  private toast: ToastManager;
  private isOpen: boolean = false;
  private modalEl: HTMLElement | null = null;
  private onResetCallback?: () => void;
  private audioManager: AudioManager;

  constructor(
    root: HTMLElement,
    saveManager: SaveManager,
    toast: ToastManager,
    audioManager: AudioManager,
    onReset?: () => void
  ) {
    this.root = root;
    this.saveManager = saveManager;
    this.toast = toast;
    this.audioManager = audioManager;
    this.onResetCallback = onReset;
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

    // Prevent any clicks from bubbling down to Pixi canvas
    backdrop.addEventListener('pointerdown', (e) => e.stopPropagation());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.close();
      }
    });

    const state = this.saveManager.getState();
    const playMinutes = Math.floor(state.activePlayTime / 60);
    const playSeconds = Math.floor(state.activePlayTime % 60);

    backdrop.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <div class="modal-title">⚙️ 游戏设置与数据管理</div>
          <button class="modal-close-btn" id="btn-close-settings" title="关闭">&times;</button>
        </div>
        <div class="modal-body">
          <div class="setting-row">
            <div class="setting-label">存档规格信息</div>
            <div class="setting-desc">
              Schema 版本号: <strong>v${state.version}</strong> | 
              当前金币: <strong>${state.gold}</strong> | 
              在线时长: <strong>${playMinutes}分${playSeconds}秒</strong>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-label">声音</div>
            <div class="audio-setting-grid">
              <label for="audio-master">总音量 <output id="audio-master-value">${Math.round(state.settings.masterVolume * 100)}%</output></label>
              <input id="audio-master" type="range" min="0" max="1" step="${AUDIO_CONFIG.VOLUME_STEP}" value="${state.settings.masterVolume}">
              <label for="audio-music">背景音乐 <output id="audio-music-value">${Math.round(state.settings.musicVolume * 100)}%</output></label>
              <input id="audio-music" type="range" min="0" max="1" step="${AUDIO_CONFIG.VOLUME_STEP}" value="${state.settings.musicVolume}">
              <label for="audio-sfx">制作与互动音效 <output id="audio-sfx-value">${Math.round(state.settings.sfxVolume * 100)}%</output></label>
              <input id="audio-sfx" type="range" min="0" max="1" step="${AUDIO_CONFIG.VOLUME_STEP}" value="${state.settings.sfxVolume}">
            </div>
            <button class="btn-action ${state.settings.muted ? 'btn-muted' : ''}" id="btn-toggle-mute">
              ${state.settings.muted ? '🔇 已静音，点击恢复' : '🔊 一键静音'}
            </button>
            <div class="setting-desc">首次点击或按键后音乐才会开始；所有声音随时可关闭。</div>
          </div>

          <div class="setting-row">
            <div class="setting-label">存档 JSON 导出 / 导入</div>
            <div class="setting-desc">复制下方数据进行备份，或粘贴已有存档 JSON 后点击导入：</div>
            <textarea class="modal-textarea" id="save-json-area" placeholder="在此粘贴或查看存档 JSON...">${this.saveManager.exportJSON()}</textarea>
          </div>

          <div class="setting-row">
            <div class="btn-row">
              <button class="btn-action" id="btn-copy-export">📋 复制导出到剪贴板</button>
              <button class="btn-action" id="btn-download-export">💾 下载存档文件</button>
              <button class="btn-action" id="btn-import-save">📥 从文本框导入</button>
              <button class="btn-action btn-danger" id="btn-reset-save">🔄 重置初始存档</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.appendChild(backdrop);

    // Event listeners
    backdrop.querySelector('#btn-close-settings')?.addEventListener('click', () => this.close());

    const bindVolume = (inputId: string, outputId: string, key: 'masterVolume' | 'musicVolume' | 'sfxVolume') => {
      const input = backdrop.querySelector(`#${inputId}`) as HTMLInputElement;
      const output = backdrop.querySelector(`#${outputId}`) as HTMLOutputElement;
      input.addEventListener('input', () => {
        const value = Number(input.value);
        output.value = `${Math.round(value * 100)}%`;
        this.saveManager.updateState((draft) => { draft.settings[key] = value; });
        this.audioManager.setSettings(this.saveManager.getState().settings);
      });
    };
    bindVolume('audio-master', 'audio-master-value', 'masterVolume');
    bindVolume('audio-music', 'audio-music-value', 'musicVolume');
    bindVolume('audio-sfx', 'audio-sfx-value', 'sfxVolume');

    backdrop.querySelector('#btn-toggle-mute')?.addEventListener('click', () => {
      this.saveManager.updateState((draft) => { draft.settings.muted = !draft.settings.muted; });
      this.audioManager.setSettings(this.saveManager.getState().settings);
      this.toast.show(this.saveManager.getState().settings.muted ? '所有声音已静音' : '声音已恢复');
      this.close();
      this.open();
    });

    backdrop.querySelector('#btn-copy-export')?.addEventListener('click', async () => {
      const jsonArea = backdrop.querySelector('#save-json-area') as HTMLTextAreaElement;
      const json = this.saveManager.exportJSON();
      jsonArea.value = json;
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(json);
          this.toast.show('已成功将存档 JSON 复制到剪贴板！');
        } else {
          jsonArea.select();
          document.execCommand('copy');
          this.toast.show('已选中并复制存档数据！');
        }
      } catch {
        jsonArea.select();
        this.toast.show('请手动复制文本框中的数据');
      }
    });

    backdrop.querySelector('#btn-download-export')?.addEventListener('click', () => {
      const json = this.saveManager.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-grind-save-v${state.version}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.show('已触发存档文件下载');
    });

    backdrop.querySelector('#btn-import-save')?.addEventListener('click', () => {
      const jsonArea = backdrop.querySelector('#save-json-area') as HTMLTextAreaElement;
      const val = jsonArea.value.trim();
      if (!val) {
        this.toast.show('请先在文本框中粘贴存档 JSON');
        return;
      }
      try {
        this.saveManager.importJSON(val);
        this.toast.show('存档导入成功！');
        this.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.toast.show(msg);
      }
    });

    backdrop.querySelector('#btn-reset-save')?.addEventListener('click', () => {
      if (window.confirm('确认要重置存档吗？当前进度将恢复为新开局。')) {
        this.saveManager.resetToDefault();
        this.toast.show('存档已重置为初始状态！');
        this.onResetCallback?.();
        this.close();
      }
    });
  }
}
