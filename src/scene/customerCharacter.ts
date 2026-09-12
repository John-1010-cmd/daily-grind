import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import armLUrl from '../assets/characters/passenger/passenger-arm-l.png';
import armRUrl from '../assets/characters/passenger/passenger-arm-r.png';
import bodyUrl from '../assets/characters/passenger/passenger-body.png';
import headUrl from '../assets/characters/passenger/passenger-head.png';
import legLUrl from '../assets/characters/passenger/passenger-leg-l.png';
import legRUrl from '../assets/characters/passenger/passenger-leg-r.png';
import { CHAR_ANIM_CONFIG } from '../config';

const PART_SCALE = 0.55;

/** 将颜色向白色混合，避免深色 tint 把浅色衣服压得过暗 */
export function softenTint(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/**
 * 路人/常客顾客角色（T3.8 批次 C）。
 * 结构与 OwnerCharacter 相同：部件贴图 + 程序化走路/呼吸动画；
 * 躯干/手臂/腿按顾客色 tint 出换色变体，头部保持原色。
 */
export class CustomerCharacter {
  public readonly container: Container;
  private bodySprite: Sprite;
  private headSprite: Sprite;
  private armLSprite: Sprite;
  private armRSprite: Sprite;
  private legLSprite: Sprite;
  private legRSprite: Sprite;

  private walkPhase = 0;
  private idlePhase = 0;

  constructor(tint: number) {
    this.container = new Container();
    this.container.label = 'CustomerCharacter';

    const shadow = new Graphics();
    shadow.ellipse(0, 24, 16, 5);
    shadow.fill({ color: 0x000000, alpha: 0.22 });
    this.container.addChild(shadow);

    const limbTint = softenTint(tint, 0.3);

    this.legLSprite = new Sprite(Texture.from(legLUrl));
    this.legLSprite.anchor.set(0.5, 0.08);
    this.legLSprite.scale.set(PART_SCALE);
    this.legLSprite.position.set(-5, 2);
    this.legLSprite.tint = limbTint;
    this.container.addChild(this.legLSprite);

    this.legRSprite = new Sprite(Texture.from(legRUrl));
    this.legRSprite.anchor.set(0.5, 0.08);
    this.legRSprite.scale.set(PART_SCALE);
    this.legRSprite.position.set(5, 2);
    this.legRSprite.tint = limbTint;
    this.container.addChild(this.legRSprite);

    this.armLSprite = new Sprite(Texture.from(armLUrl));
    this.armLSprite.anchor.set(0.5, 0.12);
    this.armLSprite.scale.set(PART_SCALE);
    this.armLSprite.position.set(-14, -10);
    this.armLSprite.tint = limbTint;
    this.container.addChild(this.armLSprite);

    this.bodySprite = new Sprite(Texture.from(bodyUrl));
    this.bodySprite.anchor.set(0.5, 0.5);
    this.bodySprite.scale.set(PART_SCALE);
    this.bodySprite.position.set(0, -3);
    this.bodySprite.tint = tint;
    this.container.addChild(this.bodySprite);

    this.headSprite = new Sprite(Texture.from(headUrl));
    this.headSprite.anchor.set(0.5, 0.95);
    this.headSprite.scale.set(PART_SCALE);
    this.headSprite.position.set(0, -16);
    this.container.addChild(this.headSprite);

    this.armRSprite = new Sprite(Texture.from(armRUrl));
    this.armRSprite.anchor.set(0.5, 0.12);
    this.armRSprite.scale.set(PART_SCALE);
    this.armRSprite.position.set(14, -10);
    this.armRSprite.tint = limbTint;
    this.container.addChild(this.armRSprite);
  }

  public update(deltaSeconds: number, isMoving: boolean, facing: 'left' | 'right'): void {
    this.container.scale.x = facing === 'right' ? 1 : -1;

    if (isMoving) {
      this.walkPhase += deltaSeconds * CHAR_ANIM_CONFIG.WALK_CYCLE_SPEED;

      const bounce = Math.abs(Math.sin(this.walkPhase)) * CHAR_ANIM_CONFIG.BODY_BOUNCE_AMPLITUDE;
      this.bodySprite.y = -3 - bounce;

      const tilt = Math.sin(this.walkPhase) * CHAR_ANIM_CONFIG.BODY_TILT_AMPLITUDE;
      this.bodySprite.rotation = tilt;

      this.headSprite.y = -16 - bounce * 0.6;
      this.headSprite.rotation = -tilt * 0.5;

      const legSwing = Math.sin(this.walkPhase) * CHAR_ANIM_CONFIG.LIMB_SWING_AMPLITUDE;
      this.legLSprite.rotation = legSwing;
      this.legRSprite.rotation = -legSwing;

      const armSwing = Math.sin(this.walkPhase) * (CHAR_ANIM_CONFIG.LIMB_SWING_AMPLITUDE * 0.85);
      this.armLSprite.rotation = -armSwing;
      this.armRSprite.rotation = armSwing;
    } else {
      this.idlePhase += deltaSeconds * CHAR_ANIM_CONFIG.IDLE_BREATH_SPEED;

      this.legLSprite.rotation *= 0.85;
      this.legRSprite.rotation *= 0.85;
      this.armLSprite.rotation *= 0.85;
      this.armRSprite.rotation *= 0.85;

      const breath = Math.sin(this.idlePhase) * CHAR_ANIM_CONFIG.IDLE_BREATH_SCALE;
      this.bodySprite.scale.y = PART_SCALE * (1 + breath);
      this.bodySprite.scale.x = PART_SCALE * (1 - breath * 0.5);
      this.bodySprite.y = -3;
      this.bodySprite.rotation = 0;

      this.headSprite.y = -16 + Math.sin(this.idlePhase) * 0.5;
      this.headSprite.rotation = Math.sin(this.idlePhase * 0.5) * 0.02;
    }
  }

  public setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }
}
