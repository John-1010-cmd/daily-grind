import bgmUrl from '../assets/audio/bgm-lofi.mp3';
import cupUrl from '../assets/audio/sfx-cup.mp3';
import extractionUrl from '../assets/audio/sfx-extraction.mp3';
import grinderUrl from '../assets/audio/sfx-grinder.mp3';
import purrUrl from '../assets/audio/sfx-purr.mp3';
import steamUrl from '../assets/audio/sfx-steam.mp3';
import { AUDIO_CONFIG } from '../config';

export type SfxId = keyof typeof AUDIO_CONFIG.SFX_WINDOWS;

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

const SOURCES: Record<'bgm' | SfxId, string> = {
  bgm: bgmUrl,
  grinder: grinderUrl,
  extraction: extractionUrl,
  steam: steamUrl,
  cup: cupUrl,
  purr: purrUrl
};

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function calculateCrossfadeTiming(durationSeconds: number): { crossfade: number; stride: number } {
  const crossfade = Math.min(AUDIO_CONFIG.BGM_CROSSFADE_SECONDS, durationSeconds / 4);
  return {
    crossfade,
    stride: Math.max(durationSeconds - crossfade, crossfade)
  };
}

/** Web Audio 混音器：用户首次交互后解锁，BGM 以双音源交叉淡化调度。 */
export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private buffers = new Map<keyof typeof SOURCES, AudioBuffer>();
  private unlockPromise: Promise<void> | null = null;
  private schedulerId: number | null = null;
  private nextBgmStart = 0;
  private bgmScheduled = false;
  private settings: AudioSettings;

  constructor(settings: AudioSettings) {
    this.settings = { ...settings };
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public async unlock(): Promise<void> {
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = this.initialize();
    return this.unlockPromise;
  }

  private async initialize(): Promise<void> {
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;
    this.context = new AudioContextCtor();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.applySettings();
    await this.context.resume();

    await Promise.all(Object.entries(SOURCES).map(async ([id, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const buffer = await this.context!.decodeAudioData(bytes);
        this.buffers.set(id as keyof typeof SOURCES, buffer);
      } catch (error) {
        console.warn(`音频 ${id} 加载失败，已静默跳过：`, error);
      }
    }));

    if (this.buffers.has('bgm')) this.startBgm();
  }

  public setSettings(next: AudioSettings): void {
    this.settings = {
      masterVolume: clampVolume(next.masterVolume),
      musicVolume: clampVolume(next.musicVolume),
      sfxVolume: clampVolume(next.sfxVolume),
      muted: Boolean(next.muted)
    };
    this.applySettings();
  }

  private applySettings(): void {
    if (!this.context || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const at = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.masterVolume, at, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, at, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, at, 0.02);
  }

  private startBgm(): void {
    if (!this.context || this.bgmScheduled) return;
    this.bgmScheduled = true;
    this.nextBgmStart = this.context.currentTime + AUDIO_CONFIG.START_LATENCY_SECONDS;
    this.scheduleBgmAhead();
    this.schedulerId = window.setInterval(
      () => this.scheduleBgmAhead(),
      AUDIO_CONFIG.BGM_SCHEDULER_INTERVAL_MS
    );
  }

  private scheduleBgmAhead(): void {
    if (!this.context || !this.musicGain) return;
    const buffer = this.buffers.get('bgm');
    if (!buffer) return;
    const { crossfade, stride } = calculateCrossfadeTiming(buffer.duration);
    const horizon = this.context.currentTime + AUDIO_CONFIG.BGM_SCHEDULE_AHEAD_SECONDS;

    while (this.nextBgmStart <= horizon) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.musicGain);
      gain.gain.setValueAtTime(0, this.nextBgmStart);
      gain.gain.linearRampToValueAtTime(1, this.nextBgmStart + crossfade);
      gain.gain.setValueAtTime(1, this.nextBgmStart + buffer.duration - crossfade);
      gain.gain.linearRampToValueAtTime(0, this.nextBgmStart + buffer.duration);
      source.start(this.nextBgmStart);
      source.stop(this.nextBgmStart + buffer.duration);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      this.nextBgmStart += stride;
    }
  }

  public playSfx(id: SfxId): boolean {
    if (!this.context || !this.sfxGain) return false;
    const buffer = this.buffers.get(id);
    if (!buffer) return false;
    const windowDef = AUDIO_CONFIG.SFX_WINDOWS[id];
    const offset = Math.min(windowDef.offsetSeconds, Math.max(0, buffer.duration - 0.05));
    const duration = Math.min(windowDef.durationSeconds, buffer.duration - offset);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain);
    source.start(this.context.currentTime + AUDIO_CONFIG.START_LATENCY_SECONDS, offset, duration);
    source.onended = () => source.disconnect();
    return true;
  }

  public playPreparationSequence(): void {
    for (const cue of AUDIO_CONFIG.PREPARATION_SEQUENCE) {
      window.setTimeout(() => this.playSfx(cue.id), cue.delayMs);
    }
  }

  public dispose(): void {
    if (this.schedulerId !== null) window.clearInterval(this.schedulerId);
    this.schedulerId = null;
    void this.context?.close();
    this.context = null;
  }
}
