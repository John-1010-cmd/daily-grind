import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import ownerUrl from '../assets/scene/owner-1x4.webp';
import { CHAR_ANIM_CONFIG } from '../config';

export class OwnerCharacter {
  public readonly container: Container;
  private shadow: Graphics;
  private characterSprite: Sprite;
  private readonly baseScaleX: number;
  private readonly baseScaleY: number;

  private walkPhase = 0;
  private idlePhase = 0;

  constructor() {
    this.container = new Container();
    this.container.label = 'OwnerCharacter';

    // 1. Shadow underneath
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 2, CHAR_ANIM_CONFIG.SHADOW_WIDTH, CHAR_ANIM_CONFIG.SHADOW_HEIGHT);
    this.shadow.fill({ color: 0x000000, alpha: 0.24 });
    this.container.addChild(this.shadow);

    this.characterSprite = new Sprite(Texture.from(ownerUrl));
    this.characterSprite.anchor.set(0.5, 1);
    this.characterSprite.width = CHAR_ANIM_CONFIG.OWNER_WIDTH;
    this.characterSprite.height = CHAR_ANIM_CONFIG.OWNER_HEIGHT;
    this.baseScaleX = this.characterSprite.scale.x;
    this.baseScaleY = this.characterSprite.scale.y;
    this.container.addChild(this.characterSprite);
  }

  public update(deltaSeconds: number, isMoving: boolean, facing: 'left' | 'right'): void {
    // Horizontal direction
    this.container.scale.x = facing === 'right' ? 1 : -1;

    if (isMoving) {
      this.walkPhase += deltaSeconds * CHAR_ANIM_CONFIG.WALK_CYCLE_SPEED;

      const bounce = Math.abs(Math.sin(this.walkPhase)) * CHAR_ANIM_CONFIG.BODY_BOUNCE_AMPLITUDE;
      this.characterSprite.y = -bounce;
      this.characterSprite.rotation = Math.sin(this.walkPhase) * CHAR_ANIM_CONFIG.BODY_TILT_AMPLITUDE;
    } else {
      this.idlePhase += deltaSeconds * CHAR_ANIM_CONFIG.IDLE_BREATH_SPEED;
      const breath = Math.sin(this.idlePhase) * CHAR_ANIM_CONFIG.IDLE_BREATH_SCALE;
      this.characterSprite.scale.y = this.baseScaleY * (1 + breath);
      this.characterSprite.scale.x = this.baseScaleX * (1 - breath * CHAR_ANIM_CONFIG.BREATH_WIDTH_FACTOR);
      this.characterSprite.y = 0;
      this.characterSprite.rotation = Math.sin(this.idlePhase * CHAR_ANIM_CONFIG.IDLE_TILT_SPEED_FACTOR) * CHAR_ANIM_CONFIG.IDLE_TILT_AMPLITUDE;
    }
  }

  public setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }
}
