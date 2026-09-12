import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import catBlinkUrl from '../assets/cat/cat-blink.png';
import catCurledUrl from '../assets/cat/cat-curled.png';
import catStretchUrl from '../assets/cat/cat-stretch.png';
import { CAT_CONFIG, CAT_SPOTS, CatSpotDef, Point } from '../config';

export type CatPose = 'curled' | 'stretch' | 'blink';

export class CatComponent {
  public readonly container: Container;
  private shadow: Graphics;
  private sprite: Sprite;

  private textureCurled: Texture;
  private textureStretch: Texture;
  private textureBlink: Texture;

  private currentPose: CatPose = 'curled';
  private currentSpot: CatSpotDef = CAT_SPOTS[0];
  private poseTimer: number = CAT_CONFIG.POSE_CHANGE_INTERVAL;
  private relocateTimer: number = CAT_CONFIG.RELOCATE_INTERVAL;
  private blinkTimer: number = 0;
  private breathPhase: number = 0;

  constructor() {
    this.container = new Container();
    this.container.label = 'OrangeCat';

    this.textureCurled = Texture.from(catCurledUrl);
    this.textureStretch = Texture.from(catStretchUrl);
    this.textureBlink = Texture.from(catBlinkUrl);

    // Subtle soft shadow underneath cat
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 16, 28, 8);
    this.shadow.fill({ color: 0x000000, alpha: 0.22 });
    this.container.addChild(this.shadow);

    this.sprite = new Sprite(this.textureCurled);
    this.sprite.anchor.set(0.5, 0.75);
    this.container.addChild(this.sprite);

    this.updatePosition();
  }

  public getCurrentSpot(): CatSpotDef {
    return this.currentSpot;
  }

  public getCurrentPose(): CatPose {
    return this.currentPose;
  }

  public getInteractPoint(): Point {
    return this.currentSpot.interactPoint;
  }

  public pet(): { text: string; pose: CatPose } {
    this.currentPose = 'blink';
    this.sprite.texture = this.textureBlink;
    this.blinkTimer = CAT_CONFIG.CLICK_PURR_DURATION;
    return {
      text: '橘猫满足地眯起双眼，喉咙里发出温润的呼噜呼噜声~',
      pose: 'blink'
    };
  }

  public setPose(pose: CatPose): void {
    this.currentPose = pose;
    if (pose === 'curled') {
      this.sprite.texture = this.textureCurled;
    } else if (pose === 'stretch') {
      this.sprite.texture = this.textureStretch;
    } else {
      this.sprite.texture = this.textureBlink;
    }
  }

  public relocate(targetSpotId?: string): CatSpotDef {
    const availableSpots = CAT_SPOTS.filter((s) => s.id !== this.currentSpot.id);
    const nextSpot = targetSpotId
      ? CAT_SPOTS.find((s) => s.id === targetSpotId) || availableSpots[0]
      : availableSpots[Math.floor(Math.random() * availableSpots.length)];

    this.currentSpot = nextSpot;
    this.updatePosition();
    this.setPose(Math.random() > 0.5 ? 'curled' : 'stretch');
    return this.currentSpot;
  }

  private updatePosition(): void {
    this.container.position.set(this.currentSpot.pos.x, this.currentSpot.pos.y);
  }

  public update(deltaSeconds: number): void {
    this.breathPhase += deltaSeconds * CAT_CONFIG.BREATH_SPEED;

    // Gentle breathing scale
    const breath = Math.sin(this.breathPhase) * 0.025;
    this.sprite.scale.set(1 + breath, 1 - breath * 0.5);

    // Handle temporary petting blink state
    if (this.blinkTimer > 0) {
      this.blinkTimer -= deltaSeconds;
      if (this.blinkTimer <= 0) {
        this.setPose('curled');
      }
      return;
    }

    // Pose switching timer
    this.poseTimer -= deltaSeconds;
    if (this.poseTimer <= 0) {
      this.poseTimer = CAT_CONFIG.POSE_CHANGE_INTERVAL + Math.random() * 8;
      const nextPose: CatPose = this.currentPose === 'curled' ? 'stretch' : 'curled';
      this.setPose(nextPose);
    }

    // Relocate to another spot timer
    this.relocateTimer -= deltaSeconds;
    if (this.relocateTimer <= 0) {
      this.relocateTimer = CAT_CONFIG.RELOCATE_INTERVAL + Math.random() * 30;
      this.relocate();
    }
  }
}
