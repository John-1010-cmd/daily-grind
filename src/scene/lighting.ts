import { Container, Graphics } from 'pixi.js';
import { GameClock } from '../clock';
import { SCREEN_CONFIG, TimePeriodConfig } from '../config';

export class LightingSystem {
  private container: Container;
  private overlay: Graphics;
  private clock: GameClock;

  constructor(clock: GameClock) {
    this.clock = clock;
    this.container = new Container();
    this.container.label = 'LightingLayer';
    // Overlay must not block Pixi pointer events on children below
    this.container.eventMode = 'none';

    this.overlay = new Graphics();
    this.overlay.eventMode = 'none';
    this.container.addChild(this.overlay);

    this.update(0);
  }

  public getDisplayObject(): Container {
    return this.container;
  }

  public getCurrentPeriod(): TimePeriodConfig {
    return this.clock.getCurrentPeriodInfo().period;
  }

  public update(_deltaSeconds: number): TimePeriodConfig {
    const { period } = this.clock.getCurrentPeriodInfo();

    // Redraw overlay
    this.overlay.clear();
    this.overlay.rect(0, 0, SCREEN_CONFIG.DESIGN_WIDTH, SCREEN_CONFIG.DESIGN_HEIGHT);
    this.overlay.fill({
      color: period.tintColor,
      alpha: period.tintAlpha
    });

    // For night, add subtle ambient warm glow spots simulating the string lights
    if (period.id === 'night') {
      // Warm string lights glowing across top
      const lampGlowPositions = [
        { x: 350, y: 150 },
        { x: 550, y: 100 },
        { x: 750, y: 80 },
        { x: 950, y: 100 },
        { x: 1150, y: 120 }
      ];
      for (const lamp of lampGlowPositions) {
        this.overlay.circle(lamp.x, lamp.y, 45);
        this.overlay.fill({
          color: 0xffd166,
          alpha: 0.12 * (1 + 0.1 * Math.sin(this.clock.getActivePlayTime() * 3 + lamp.x))
        });
      }
    }

    return period;
  }
}
