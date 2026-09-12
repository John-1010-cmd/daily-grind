import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import armLUrl from '../assets/characters/owner/owner-arm-l.png';
import armRUrl from '../assets/characters/owner/owner-arm-r.png';
import bodyUrl from '../assets/characters/owner/owner-body.png';
import headUrl from '../assets/characters/owner/owner-head.png';
import legLUrl from '../assets/characters/owner/owner-leg-l.png';
import legRUrl from '../assets/characters/owner/owner-leg-r.png';
import { CHAR_ANIM_CONFIG } from '../config';

export class OwnerCharacter {
  public readonly container: Container;
  private shadow: Graphics;
  private bodySprite: Sprite;
  private headSprite: Sprite;
  private armLSprite: Sprite;
  private armRSprite: Sprite;
  private legLSprite: Sprite;
  private legRSprite: Sprite;

  private walkPhase = 0;
  private idlePhase = 0;

  constructor() {
    this.container = new Container();
    this.container.label = 'OwnerCharacter';

    // 1. Shadow underneath
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 24, 16, 5);
    this.shadow.fill({ color: 0x000000, alpha: 0.24 });
    this.container.addChild(this.shadow);

    // 2. Limbs and Body sprites (layered back to front)
    // Left leg (behind body)
    this.legLSprite = new Sprite(Texture.from(legLUrl));
    this.legLSprite.anchor.set(0.5, 0.15);
    this.legLSprite.position.set(-5, 8);
    this.legLSprite.scale.set(0.65);
    this.container.addChild(this.legLSprite);

    // Right leg (behind body)
    this.legRSprite = new Sprite(Texture.from(legRUrl));
    this.legRSprite.anchor.set(0.5, 0.15);
    this.legRSprite.position.set(5, 8);
    this.legRSprite.scale.set(0.65);
    this.container.addChild(this.legRSprite);

    // Left arm (behind body)
    this.armLSprite = new Sprite(Texture.from(armLUrl));
    this.armLSprite.anchor.set(0.5, 0.15);
    this.armLSprite.position.set(-13, -8);
    this.armLSprite.scale.set(0.65);
    this.container.addChild(this.armLSprite);

    // Body (torso with apron)
    this.bodySprite = new Sprite(Texture.from(bodyUrl));
    this.bodySprite.anchor.set(0.5, 0.5);
    this.bodySprite.position.set(0, 0);
    this.bodySprite.scale.set(0.65);
    this.container.addChild(this.bodySprite);

    // Head
    this.headSprite = new Sprite(Texture.from(headUrl));
    this.headSprite.anchor.set(0.5, 0.95);
    this.headSprite.position.set(0, -14);
    this.headSprite.scale.set(0.65);
    this.container.addChild(this.headSprite);

    // Right arm (in front of body)
    this.armRSprite = new Sprite(Texture.from(armRUrl));
    this.armRSprite.anchor.set(0.5, 0.15);
    this.armRSprite.position.set(13, -8);
    this.armRSprite.scale.set(0.65);
    this.container.addChild(this.armRSprite);
  }

  public update(deltaSeconds: number, isMoving: boolean, facing: 'left' | 'right'): void {
    // Horizontal direction
    this.container.scale.x = facing === 'right' ? 1 : -1;

    if (isMoving) {
      this.walkPhase += deltaSeconds * CHAR_ANIM_CONFIG.WALK_CYCLE_SPEED;

      // Body vertical bounce
      const bounce = Math.abs(Math.sin(this.walkPhase)) * CHAR_ANIM_CONFIG.BODY_BOUNCE_AMPLITUDE;
      this.bodySprite.y = -bounce;

      // Body tilt
      const tilt = Math.sin(this.walkPhase) * CHAR_ANIM_CONFIG.BODY_TILT_AMPLITUDE;
      this.bodySprite.rotation = tilt;

      // Head slight bob
      this.headSprite.y = -14 - bounce * 0.6;
      this.headSprite.rotation = -tilt * 0.5;

      // Leg swings
      const legSwing = Math.sin(this.walkPhase) * CHAR_ANIM_CONFIG.LIMB_SWING_AMPLITUDE;
      this.legLSprite.rotation = legSwing;
      this.legRSprite.rotation = -legSwing;

      // Arm swings (opposite to legs)
      const armSwing = Math.sin(this.walkPhase) * (CHAR_ANIM_CONFIG.LIMB_SWING_AMPLITUDE * 0.85);
      this.armLSprite.rotation = -armSwing;
      this.armRSprite.rotation = armSwing;
    } else {
      this.idlePhase += deltaSeconds * CHAR_ANIM_CONFIG.IDLE_BREATH_SPEED;

      // Smoothly return limbs to zero
      this.legLSprite.rotation *= 0.85;
      this.legRSprite.rotation *= 0.85;
      this.armLSprite.rotation *= 0.85;
      this.armRSprite.rotation *= 0.85;

      // Gentle breathing scale
      const breath = Math.sin(this.idlePhase) * CHAR_ANIM_CONFIG.IDLE_BREATH_SCALE;
      this.bodySprite.scale.y = 0.65 * (1 + breath);
      this.bodySprite.scale.x = 0.65 * (1 - breath * 0.5);
      this.bodySprite.y = 0;
      this.bodySprite.rotation = 0;

      // Head subtle breath motion
      this.headSprite.y = -14 + Math.sin(this.idlePhase) * 0.5;
      this.headSprite.rotation = Math.sin(this.idlePhase * 0.5) * 0.02;
    }
  }

  public setPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }
}
