import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import customerUrl from '../assets/scene/customer-1x4.webp';
import customerSeatedUrl from '../assets/scene/customer-seated-1x4.webp';
import customerDrinkingUrl from '../assets/scene/customer-drinking-1x4.webp';
import customerEatingUrl from '../assets/scene/customer-eating-1x4.webp';
import customerPhoneUrl from '../assets/scene/customer-phone-1x4.webp';
import { CHAR_ANIM_CONFIG } from '../config';

/** 将颜色向白色混合，避免深色 tint 把浅色衣服压得过暗 */
export function softenTint(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

export type CustomerActivity = 'idle' | 'phone' | 'drinking' | 'eating';

/**
 * 路人/常客顾客角色（T3.8 批次 C）。
 * 结构与 OwnerCharacter 相同：部件贴图 + 程序化走路/呼吸动画；
 * 躯干/手臂/腿按顾客色 tint 出换色变体，头部保持原色。
 */
export class CustomerCharacter {
  public readonly container: Container;
  private characterSprite: Sprite;
  private baseScaleX: number;
  private baseScaleY: number;
  private pose: 'standing' | 'sitting' = 'standing';
  private activity: CustomerActivity = 'idle';
  private showingActionFrame = false;
  private textureKey = 'standing';

  private walkPhase = 0;
  private idlePhase = 0;
  private activityPhase = 0;

  constructor(tint: number) {
    this.container = new Container();
    this.container.label = 'CustomerCharacter';

    const shadow = new Graphics();
    shadow.ellipse(0, 2, CHAR_ANIM_CONFIG.SHADOW_WIDTH, CHAR_ANIM_CONFIG.SHADOW_HEIGHT);
    shadow.fill({ color: 0x000000, alpha: 0.22 });
    this.container.addChild(shadow);

    this.characterSprite = new Sprite(Texture.from(customerUrl));
    this.characterSprite.anchor.set(0.5, 1);
    this.characterSprite.width = CHAR_ANIM_CONFIG.CUSTOMER_WIDTH;
    this.characterSprite.height = CHAR_ANIM_CONFIG.CUSTOMER_HEIGHT;
    this.baseScaleX = this.characterSprite.scale.x;
    this.baseScaleY = this.characterSprite.scale.y;
    this.characterSprite.tint = softenTint(tint, CHAR_ANIM_CONFIG.CUSTOMER_TINT_SOFTEN);
    this.container.addChild(this.characterSprite);
  }

  public setPose(pose: 'standing' | 'sitting'): void {
    if (this.pose === pose) return;
    this.pose = pose;
    this.showingActionFrame = false;
    this.applyTexture();
  }

  public setActivity(activity: CustomerActivity): void {
    if (this.activity === activity) return;
    this.activity = activity;
    this.activityPhase = 0;
    this.showingActionFrame = activity !== 'idle';
    this.applyTexture();
  }

  public getActivity(): CustomerActivity {
    return this.activity;
  }

  private applyTexture(): void {
    const textureKey = this.pose === 'standing'
      ? 'standing'
      : this.showingActionFrame && this.activity !== 'idle'
        ? this.activity
        : 'sitting';
    if (textureKey === this.textureKey) return;
    this.textureKey = textureKey;
    const textureUrl = textureKey === 'standing'
      ? customerUrl
      : textureKey === 'drinking'
        ? customerDrinkingUrl
        : textureKey === 'eating'
          ? customerEatingUrl
          : textureKey === 'phone'
            ? customerPhoneUrl
          : customerSeatedUrl;
    this.characterSprite.texture = Texture.from(textureUrl);
    this.characterSprite.width = this.pose === 'sitting'
      ? CHAR_ANIM_CONFIG.CUSTOMER_SEATED_WIDTH
      : CHAR_ANIM_CONFIG.CUSTOMER_WIDTH;
    this.characterSprite.height = this.pose === 'sitting'
      ? CHAR_ANIM_CONFIG.CUSTOMER_SEATED_HEIGHT
      : CHAR_ANIM_CONFIG.CUSTOMER_HEIGHT;
    this.baseScaleX = this.characterSprite.scale.x;
    this.baseScaleY = this.characterSprite.scale.y;
  }

  public update(deltaSeconds: number, isMoving: boolean, facing: 'left' | 'right'): void {
    this.container.scale.x = facing === 'right' ? 1 : -1;

    if (isMoving) {
      this.walkPhase += deltaSeconds * CHAR_ANIM_CONFIG.WALK_CYCLE_SPEED;

      const bounce = Math.abs(Math.sin(this.walkPhase)) * CHAR_ANIM_CONFIG.BODY_BOUNCE_AMPLITUDE;
      this.characterSprite.y = -bounce;
      this.characterSprite.rotation = Math.sin(this.walkPhase) * CHAR_ANIM_CONFIG.BODY_TILT_AMPLITUDE;
    } else if (this.pose === 'sitting' && this.activity !== 'idle') {
      this.activityPhase += deltaSeconds * CHAR_ANIM_CONFIG.CONSUME_CYCLE_SPEED;
      const actionFrame = Math.sin(this.activityPhase) > CHAR_ANIM_CONFIG.CONSUME_ACTION_THRESHOLD;
      if (actionFrame !== this.showingActionFrame) {
        this.showingActionFrame = actionFrame;
        this.applyTexture();
      }
      this.characterSprite.y = -Math.abs(Math.sin(this.activityPhase)) * CHAR_ANIM_CONFIG.CONSUME_BOB_AMPLITUDE;
      this.characterSprite.rotation = Math.sin(this.activityPhase) * CHAR_ANIM_CONFIG.CONSUME_TILT_AMPLITUDE;
    } else {
      if (this.showingActionFrame) {
        this.showingActionFrame = false;
        this.applyTexture();
      }
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
