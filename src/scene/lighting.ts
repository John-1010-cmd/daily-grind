import { Container, Graphics } from 'pixi.js';
import { GameClock } from '../clock';
import { LIGHTING_CONFIG, SCREEN_CONFIG, TIME_PERIODS, TimePeriodConfig } from '../config';

export interface LightingFrame {
  period: TimePeriodConfig;
  tintColor: number;
  tintAlpha: number;
  nightStrength: number;
}

function channel(color: number, shift: number): number {
  return (color >> shift) & 0xff;
}

function mixColor(from: number, to: number, amount: number): number {
  const mix = (shift: number) => Math.round(channel(from, shift) + (channel(to, shift) - channel(from, shift)) * amount);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

function smoothstep(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

/** 纯函数，供假时钟测试与 Pixi adapter 共用。 */
export function calculateLightingFrame(
  period: TimePeriodConfig,
  periodIndex: number,
  progress: number
): LightingFrame {
  const transitionStart = 1 - LIGHTING_CONFIG.TRANSITION_PORTION;
  const blend = progress <= transitionStart
    ? 0
    : smoothstep((progress - transitionStart) / LIGHTING_CONFIG.TRANSITION_PORTION);
  const next = TIME_PERIODS[(periodIndex + 1) % TIME_PERIODS.length];
  const tintColor = mixColor(period.tintColor, next.tintColor, blend);
  const tintAlpha = period.tintAlpha + (next.tintAlpha - period.tintAlpha) * blend;
  const currentNight = period.id === 'night' ? 1 : 0;
  const nextNight = next.id === 'night' ? 1 : 0;
  const nightStrength = currentNight + (nextNight - currentNight) * blend;

  return { period, tintColor, tintAlpha, nightStrength };
}

export class LightingSystem {
  private container: Container;
  private ambientOverlay: Graphics;
  private stringLayer: Graphics;
  private glowLayer: Graphics;
  private clock: GameClock;

  constructor(clock: GameClock) {
    this.clock = clock;
    this.container = new Container();
    this.container.label = 'LightingLayer';
    // Overlay must not block Pixi pointer events on children below
    this.container.eventMode = 'none';

    this.ambientOverlay = new Graphics();
    this.stringLayer = new Graphics();
    this.glowLayer = new Graphics();
    this.ambientOverlay.eventMode = 'none';
    this.stringLayer.eventMode = 'none';
    this.glowLayer.eventMode = 'none';
    this.glowLayer.blendMode = 'add';
    this.container.addChild(this.ambientOverlay, this.stringLayer, this.glowLayer);

    this.update(0);
  }

  public getDisplayObject(): Container {
    return this.container;
  }

  public getCurrentPeriod(): TimePeriodConfig {
    return this.clock.getCurrentPeriodInfo().period;
  }

  public update(_deltaSeconds: number): TimePeriodConfig {
    const { period, progress, periodIndex } = this.clock.getCurrentPeriodInfo();
    const frame = calculateLightingFrame(period, periodIndex, progress);

    this.ambientOverlay.clear();
    this.ambientOverlay.rect(0, 0, SCREEN_CONFIG.DESIGN_WIDTH, SCREEN_CONFIG.DESIGN_HEIGHT);
    this.ambientOverlay.fill({
      color: frame.tintColor,
      alpha: frame.tintAlpha
    });

    this.stringLayer.clear();
    this.glowLayer.clear();
    if (frame.nightStrength > 0) {
      for (const segment of LIGHTING_CONFIG.STRING_SEGMENTS) {
        this.stringLayer.moveTo(segment[0].x, segment[0].y);
        for (let i = 1; i < segment.length; i++) {
          this.stringLayer.lineTo(segment[i].x, segment[i].y);
        }
        this.stringLayer.stroke({
          color: LIGHTING_CONFIG.STRING_COLOR,
          width: LIGHTING_CONFIG.STRING_WIDTH,
          alpha: 0.55 * frame.nightStrength
        });
      }

      for (const [index, lamp] of LIGHTING_CONFIG.STRING_LIGHTS.entries()) {
        const pulse = 1 + LIGHTING_CONFIG.NIGHT_PULSE_AMPLITUDE * Math.sin(
          this.clock.getActivePlayTime() * LIGHTING_CONFIG.NIGHT_PULSE_SPEED + index * 0.9
        );
        const strength = Math.max(
          LIGHTING_CONFIG.NIGHT_MIN_GLOW_STRENGTH,
          frame.nightStrength
        ) * frame.nightStrength * pulse;
        this.glowLayer.circle(lamp.x, lamp.y, LIGHTING_CONFIG.BULB_HALO_RADIUS);
        this.glowLayer.fill({ color: LIGHTING_CONFIG.BULB_COLOR, alpha: LIGHTING_CONFIG.BULB_HALO_ALPHA * strength });
        this.glowLayer.circle(lamp.x, lamp.y, LIGHTING_CONFIG.BULB_CORE_RADIUS);
        this.glowLayer.fill({ color: LIGHTING_CONFIG.BULB_COLOR, alpha: LIGHTING_CONFIG.BULB_CORE_ALPHA * strength });
      }
    }

    return period;
  }
}
