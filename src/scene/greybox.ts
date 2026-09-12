import {
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture
} from 'pixi.js';
import {
  PLAYER_CONFIG,
  Point,
  SCREEN_CONFIG,
  SceneObjectConfig,
  SHOP_SCENES,
  ShopSceneDefinition
} from '../config';
import { Customer, CustomerManager } from '../customer';
import { DecorManager } from '../decor';
import { CatComponent } from './catComponent';
import { CustomerCharacter } from './customerCharacter';
import {
  DECOR_SLOT_PLACEMENTS,
  DECOR_SPRITE_URLS,
  DECOR_VARIANT_PLACEMENT_OVERRIDES
} from './decorSprites';
import {
  NavGraph,
  clampToWalkable,
  distance,
  findHitObject,
  isPointInWalkable
} from './nav';
import { OwnerCharacter } from './ownerCharacter';
import { SHOP_SCENE_BACKGROUND_URLS } from './shopSceneAssets';

export interface GreyboxCallbacks {
  onObjectInteract: (obj: SceneObjectConfig) => void;
  onCustomerInteract?: (customer: Customer) => void;
  onCatInteract?: (cat: CatComponent) => void;
  onPositionChanged: (pos: Point) => void;
}

export class GreyboxScene {
  public readonly container: Container;
  private backgroundLayer: Container;
  private objectsLayer: Container;
  private decorLayer: Container;
  private customersLayer: Container;
  private playerLayer: Container;
  private debugLayer: Container;

  private ownerCharacter: OwnerCharacter;
  private catComponent: CatComponent;
  private customersGraphic: Graphics;
  private customerSprites: Map<string, CustomerCharacter> = new Map();
  private playerPos: Point;
  private targetPath: Point[] = [];
  private pendingInteractObject: SceneObjectConfig | null = null;
  private pendingCustomer: Customer | null = null;
  private pendingCat: boolean = false;
  private facing: 'left' | 'right' = 'right';

  private navGraph: NavGraph;
  private callbacks: GreyboxCallbacks;
  private keysPressed: Set<string> = new Set();
  private isDebugVisible: boolean = false;
  private customerManager: CustomerManager | null = null;
  private decorManager: DecorManager | null = null;
  private sceneDefinition: ShopSceneDefinition;

  private clickFeedbackGraphic: Graphics;
  private clickFeedbackTime: number = 0;

  constructor(
    initialPosition: Point,
    callbacks: GreyboxCallbacks,
    initialDebugState: boolean = false,
    sceneDefinition: ShopSceneDefinition = SHOP_SCENES.main
  ) {
    this.playerPos = { ...initialPosition };
    this.callbacks = callbacks;
    this.isDebugVisible = initialDebugState;
    this.sceneDefinition = sceneDefinition;
    this.navGraph = new NavGraph(
      sceneDefinition.navWaypoints,
      sceneDefinition.navEdges,
      sceneDefinition.walkableZones
    );

    this.container = new Container();
    this.container.label = 'GreyboxScene';

    this.backgroundLayer = new Container();
    this.objectsLayer = new Container();
    this.decorLayer = new Container();
    this.customersLayer = new Container();
    this.playerLayer = new Container();
    this.debugLayer = new Container();

    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.objectsLayer);
    this.container.addChild(this.decorLayer);
    this.container.addChild(this.customersLayer);
    this.container.addChild(this.playerLayer);
    this.container.addChild(this.debugLayer);

    // 1. Finished Watercolor Scene Base (T2.3)
    this.buildSceneBackground();

    // 2. Finished Cat Component (T2.6)
    this.catComponent = new CatComponent();
    this.objectsLayer.addChild(this.catComponent.container);
    this.catComponent.container.visible = sceneDefinition.catEnabled;

    // 3. Customer Rendering Layer
    this.customersGraphic = new Graphics();
    this.customersLayer.addChild(this.customersGraphic);

    // 4. Finished Owner Character with Procedural Tweening (T2.4 & T2.5)
    this.ownerCharacter = new OwnerCharacter();
    this.ownerCharacter.setPosition(this.playerPos.x, this.playerPos.y);
    this.playerLayer.addChild(this.ownerCharacter.container);

    // Click feedback
    this.clickFeedbackGraphic = new Graphics();
    this.container.addChild(this.clickFeedbackGraphic);

    this.updateDebugOverlay();
  }

  public setCustomerManager(mgr: CustomerManager): void {
    this.customerManager = mgr;
  }

  public setSceneDefinition(sceneDefinition: ShopSceneDefinition): void {
    this.sceneDefinition = sceneDefinition;
    this.navGraph = new NavGraph(
      sceneDefinition.navWaypoints,
      sceneDefinition.navEdges,
      sceneDefinition.walkableZones
    );
    this.targetPath = [];
    this.pendingInteractObject = null;
    this.pendingCustomer = null;
    this.pendingCat = false;
    this.customerSprites.forEach((sprite) => sprite.container.destroy({ children: true }));
    this.customerSprites.clear();
    this.customersLayer.removeChildren();
    this.customersGraphic = new Graphics();
    this.customersLayer.addChild(this.customersGraphic);
    this.catComponent.container.visible = sceneDefinition.catEnabled;
    this.buildSceneBackground();
    this.setPlayerPosition(sceneDefinition.playerStart);
    this.updateDebugOverlay();
  }

  public setDecorManager(mgr: DecorManager): void {
    this.decorManager = mgr;
    this.refreshDecor();
  }

  /**
   * 装修覆盖层重绘（T3.1 / T3.8 批次 D）：
   * 选中非默认款式的槽位叠加水彩物件贴图；主题色调罩染在 main.ts 的舞台层处理。
   */
  public refreshDecor(): void {
    this.decorLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!this.decorManager) return;

    for (const slot of this.decorManager.getSlots()) {
      const variantId = this.decorManager.getSelectedVariantId(slot.id);
      const url = DECOR_SPRITE_URLS[variantId];
      if (!url) continue; // 默认款式沿用底图烘焙家具
      const placement =
        DECOR_VARIANT_PLACEMENT_OVERRIDES[variantId] ?? DECOR_SLOT_PLACEMENTS[slot.id];
      if (!placement) continue;

      const sprite = new Sprite(Texture.from(url));
      sprite.anchor.set(placement.anchorX ?? 0.5, placement.anchorY ?? 0.5);
      sprite.position.set(placement.x, placement.y);
      sprite.width = placement.width; // 高度按比例自适应
      this.decorLayer.addChild(sprite);
    }
  }

  public getCatComponent(): CatComponent {
    return this.catComponent;
  }

  private buildSceneBackground(): void {
    this.backgroundLayer.removeChildren().forEach((child) => child.destroy());
    const bgSprite = new Sprite(
      Texture.from(SHOP_SCENE_BACKGROUND_URLS[this.sceneDefinition.backgroundKey])
    );
    bgSprite.width = SCREEN_CONFIG.DESIGN_WIDTH;
    bgSprite.height = SCREEN_CONFIG.DESIGN_HEIGHT;
    this.backgroundLayer.addChild(bgSprite);
  }

  private drawCustomers(deltaSeconds: number): void {
    this.customersGraphic.clear();
    if (!this.customerManager) return;

    // 顾客本体：水彩部件 sprite（T3.8 批次 C），按顾客色 tint 换色
    const active = this.customerManager.getCustomers().filter((c) => c.state !== 'LEFT');
    const activeIds = new Set(active.map((c) => c.id));
    for (const [id, sprite] of this.customerSprites) {
      if (!activeIds.has(id)) {
        this.customersLayer.removeChild(sprite.container);
        sprite.container.destroy({ children: true });
        this.customerSprites.delete(id);
      }
    }

    for (const c of active) {
      let sprite = this.customerSprites.get(c.id);
      if (!sprite) {
        sprite = new CustomerCharacter(c.color);
        this.customerSprites.set(c.id, sprite);
        this.customersLayer.addChild(sprite.container);
      }
      sprite.setPosition(c.pos.x, c.pos.y - 4);
      const isMoving = c.state === 'ENTERING' || c.state === 'LEAVING';
      sprite.update(deltaSeconds, isMoving, c.facing);

      // If enjoying drink, show little coffee cup on table
      if (c.state === 'ENJOYING_DRINK' || c.state === 'WAITING_TO_PAY') {
        const tableObj = this.sceneDefinition.sceneObjects.find((o) => o.id === c.seat.tableId);
        if (tableObj) {
          const cupX = tableObj.x + tableObj.width / 2;
          const cupY = tableObj.y + tableObj.height / 2;
          this.customersGraphic.roundRect(cupX - 5, cupY - 5, 10, 10, 2);
          this.customersGraphic.fill(0xffffff);
          this.customersGraphic.stroke({ width: 1, color: 0x795548 });
        }
      }
    }
  }

  public setDebugVisible(visible: boolean): void {
    this.isDebugVisible = visible;
    this.updateDebugOverlay();
  }

  public isDebug(): boolean {
    return this.isDebugVisible;
  }

  public updateDebugOverlay(): void {
    this.debugLayer.removeChildren();
    if (!this.isDebugVisible) {
      return;
    }

    const g = new Graphics();

    const labelStyle = new TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: 0xffffff,
      dropShadow: {
        alpha: 0.8,
        blur: 3,
        color: 0x000000,
        distance: 1
      }
    });

    // 1. Draw Walkable Zones in translucent emerald green
    for (const zone of this.sceneDefinition.walkableZones) {
      g.rect(zone.x, zone.y, zone.width, zone.height);
      g.fill({ color: 0x2ecc71, alpha: 0.18 });
      g.stroke({ width: 1.5, color: 0x27ae60 });
    }

    // 2. Draw Object Hitboxes in translucent amber
    for (const obj of this.sceneDefinition.sceneObjects) {
      g.rect(obj.hitbox.x, obj.hitbox.y, obj.hitbox.width, obj.hitbox.height);
      g.fill({ color: 0xf39c12, alpha: 0.12 });
      g.stroke({ width: 1.5, color: 0xd35400 });

      // Draw interaction point
      g.circle(obj.interactPoint.x, obj.interactPoint.y, 6);
      g.fill(0xe74c3c);
      g.stroke({ width: 1.5, color: 0xffffff });

      const txt = new Text({
        text: obj.name,
        style: labelStyle
      });
      txt.anchor.set(0.5, 0.5);
      txt.x = obj.x + obj.width / 2;
      txt.y = obj.y + Math.min(24, obj.height / 2);
      this.debugLayer.addChild(txt);
    }

    // 3. Draw Nav Edges in cyan
    for (const edge of this.sceneDefinition.navEdges) {
      const fromWp = this.sceneDefinition.navWaypoints.find((w) => w.id === edge.from);
      const toWp = this.sceneDefinition.navWaypoints.find((w) => w.id === edge.to);
      if (fromWp && toWp) {
        g.moveTo(fromWp.x, fromWp.y);
        g.lineTo(toWp.x, toWp.y);
        g.stroke({ width: 2, color: 0x00cec9, alpha: 0.7 });
      }
    }

    // 4. Draw Nav Waypoint Nodes
    for (const wp of this.sceneDefinition.navWaypoints) {
      g.circle(wp.x, wp.y, 5);
      g.fill(0x0984e3);
      g.stroke({ width: 1.5, color: 0xffffff });
    }

    // 5. Draw active path if moving
    if (this.targetPath.length > 0) {
      g.moveTo(this.playerPos.x, this.playerPos.y);
      for (const pt of this.targetPath) {
        g.lineTo(pt.x, pt.y);
      }
      g.stroke({ width: 3, color: 0xd63031, alpha: 0.9 });
    }

    this.debugLayer.addChild(g);
  }

  public handlePointerDown(x: number, y: number): void {
    const pt: Point = { x, y };

    // Trigger visual click ripple
    this.showClickRipple(pt);

    // Rule 1: Cat / Customer / Object prioritized over empty ground move
    // 1A. Check if clicked near Cat
    const catSpot = this.catComponent.getCurrentSpot();
    if (this.sceneDefinition.catEnabled && distance(pt, catSpot.pos) <= 50) {
      const d = distance(this.playerPos, catSpot.interactPoint);
      if (d <= 36) {
        this.targetPath = [];
        this.callbacks.onCatInteract?.(this.catComponent);
        this.pendingCat = false;
        this.updateDebugOverlay();
        return;
      }
      this.pendingCat = true;
      this.pendingCustomer = null;
      this.pendingInteractObject = null;
      this.targetPath = this.navGraph.route(this.playerPos, catSpot.interactPoint);
      this.updateDebugOverlay();
      return;
    }

    // 1B. Check if clicked directly on or near an active customer
    if (this.customerManager) {
      for (const c of this.customerManager.getCustomers()) {
        if (c.state === 'LEFT' || c.state === 'LEAVING') continue;
        if (distance(pt, c.pos) <= 45) {
          this.pendingCustomer = c;
          this.pendingCat = false;
          this.pendingInteractObject = null;
          const d = distance(this.playerPos, c.seat.interactPoint);
          if (d <= 36) {
            this.targetPath = [];
            this.callbacks.onCustomerInteract?.(c);
            this.pendingCustomer = null;
            this.updateDebugOverlay();
            return;
          }
          this.targetPath = this.navGraph.route(this.playerPos, c.seat.interactPoint);
          this.updateDebugOverlay();
          return;
        }
      }
    }

    // 1C. Check if clicked on a scene object
    const hit = findHitObject(pt, this.sceneDefinition.sceneObjects);
    if (hit) {
      // If clicked on cat cushion or table with cat
      if (
        this.sceneDefinition.catEnabled &&
        (hit.id === 'cat_cushion' ||
          (hit.id === 'cat_and_table_4' && catSpot.id === 'spot_table_4'))
      ) {
        const d = distance(this.playerPos, catSpot.interactPoint);
        if (d <= 36) {
          this.targetPath = [];
          this.callbacks.onCatInteract?.(this.catComponent);
          this.pendingCat = false;
          this.updateDebugOverlay();
          return;
        }
        this.pendingCat = true;
        this.pendingCustomer = null;
        this.pendingInteractObject = null;
        this.targetPath = this.navGraph.route(this.playerPos, catSpot.interactPoint);
        this.updateDebugOverlay();
        return;
      }

      // If clicked on a table that currently has a customer
      if (this.customerManager) {
        const tableCustomer = this.customerManager.getCustomerByTable(hit.id);
        if (tableCustomer) {
          this.pendingCustomer = tableCustomer;
          this.pendingCat = false;
          this.pendingInteractObject = null;
          const d = distance(this.playerPos, tableCustomer.seat.interactPoint);
          if (d <= 36) {
            this.targetPath = [];
            this.callbacks.onCustomerInteract?.(tableCustomer);
            this.pendingCustomer = null;
            this.updateDebugOverlay();
            return;
          }
          this.targetPath = this.navGraph.route(this.playerPos, tableCustomer.seat.interactPoint);
          this.updateDebugOverlay();
          return;
        }
      }

      this.pendingInteractObject = hit;
      this.pendingCustomer = null;
      this.pendingCat = false;
      const d = distance(this.playerPos, hit.interactPoint);
      if (d <= 36) {
        this.targetPath = [];
        this.callbacks.onObjectInteract(hit);
        this.pendingInteractObject = null;
        this.updateDebugOverlay();
        return;
      }
      this.targetPath = this.navGraph.route(this.playerPos, hit.interactPoint);
      this.updateDebugOverlay();
      return;
    }

    // Rule 2: Click on empty ground moves to position
    this.pendingInteractObject = null;
    this.pendingCustomer = null;
    this.pendingCat = false;
    const targetPoint = clampToWalkable(
      pt,
      this.sceneDefinition.walkableZones,
      this.sceneDefinition.navWaypoints
    );
    this.targetPath = this.navGraph.route(this.playerPos, targetPoint);
    this.updateDebugOverlay();
  }

  public handleKeyDown(key: string): void {
    const k = key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
      this.keysPressed.add(k);
      // WASD cancels any click-to-move path
      if (this.targetPath.length > 0) {
        this.targetPath = [];
        this.pendingInteractObject = null;
        this.pendingCustomer = null;
        this.pendingCat = false;
        this.updateDebugOverlay();
      }
    }
  }

  public handleKeyUp(key: string): void {
    this.keysPressed.delete(key.toLowerCase());
  }

  private showClickRipple(pt: Point): void {
    this.clickFeedbackGraphic.clear();
    this.clickFeedbackGraphic.circle(pt.x, pt.y, 8);
    this.clickFeedbackGraphic.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    this.clickFeedbackGraphic.x = 0;
    this.clickFeedbackGraphic.y = 0;
    this.clickFeedbackTime = 0.25;
  }

  public update(deltaSeconds: number): void {
    this.drawCustomers(deltaSeconds);
    if (this.sceneDefinition.catEnabled) {
      this.catComponent.update(deltaSeconds);
    }

    if (this.clickFeedbackTime > 0) {
      this.clickFeedbackTime -= deltaSeconds;
      if (this.clickFeedbackTime <= 0) {
        this.clickFeedbackGraphic.clear();
      }
    }

    let isMoving = false;

    // 1. Check WASD movement
    if (this.keysPressed.size > 0) {
      let dx = 0;
      let dy = 0;

      if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) dy -= 1;
      if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) dy += 1;
      if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) dx -= 1;
      if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const normDx = dx / len;
        const normDy = dy / len;

        const moveDist = PLAYER_CONFIG.SPEED * deltaSeconds;
        const nextX = this.playerPos.x + normDx * moveDist;
        const nextY = this.playerPos.y + normDy * moveDist;

        if (normDx > 0) this.facing = 'right';
        else if (normDx < 0) this.facing = 'left';

        // Collision check with walkable zones (with axis sliding)
        let moved = false;
        if (isPointInWalkable({ x: nextX, y: nextY }, this.sceneDefinition.walkableZones)) {
          this.playerPos.x = nextX;
          this.playerPos.y = nextY;
          moved = true;
        } else if (
          isPointInWalkable(
            { x: nextX, y: this.playerPos.y },
            this.sceneDefinition.walkableZones
          )
        ) {
          this.playerPos.x = nextX;
          moved = true;
        } else if (
          isPointInWalkable(
            { x: this.playerPos.x, y: nextY },
            this.sceneDefinition.walkableZones
          )
        ) {
          this.playerPos.y = nextY;
          moved = true;
        }

        if (moved) {
          isMoving = true;
          this.ownerCharacter.setPosition(this.playerPos.x, this.playerPos.y);
          this.callbacks.onPositionChanged(this.playerPos);
          if (this.isDebugVisible) this.updateDebugOverlay();
        }
      }
    } else if (this.targetPath.length > 0) {
      // 2. Click-to-move along targetPath
      const nextTarget = this.targetPath[0];
      const dist = distance(this.playerPos, nextTarget);
      const step = PLAYER_CONFIG.SPEED * deltaSeconds;

      if (nextTarget.x > this.playerPos.x + 2) this.facing = 'right';
      else if (nextTarget.x < this.playerPos.x - 2) this.facing = 'left';

      if (dist <= step) {
        this.playerPos.x = nextTarget.x;
        this.playerPos.y = nextTarget.y;
        this.targetPath.shift();

        if (this.targetPath.length === 0) {
          if (this.pendingCat) {
            this.callbacks.onCatInteract?.(this.catComponent);
            this.pendingCat = false;
          } else if (this.pendingCustomer) {
            this.callbacks.onCustomerInteract?.(this.pendingCustomer);
            this.pendingCustomer = null;
          } else if (this.pendingInteractObject) {
            this.callbacks.onObjectInteract(this.pendingInteractObject);
            this.pendingInteractObject = null;
          }
        }
      } else {
        const angle = Math.atan2(nextTarget.y - this.playerPos.y, nextTarget.x - this.playerPos.x);
        this.playerPos.x += Math.cos(angle) * step;
        this.playerPos.y += Math.sin(angle) * step;
        isMoving = true;
      }

      this.ownerCharacter.setPosition(this.playerPos.x, this.playerPos.y);
      this.callbacks.onPositionChanged(this.playerPos);
      if (this.isDebugVisible) {
        this.updateDebugOverlay();
      }
    }

    // Update procedural animation on owner character
    this.ownerCharacter.update(deltaSeconds, isMoving, this.facing);
  }

  public getPlayerPosition(): Point {
    return { ...this.playerPos };
  }

  public setPlayerPosition(pos: Point): void {
    this.playerPos = { ...pos };
    this.targetPath = [];
    this.pendingInteractObject = null;
    this.pendingCustomer = null;
    this.pendingCat = false;
    this.ownerCharacter.setPosition(this.playerPos.x, this.playerPos.y);
    if (this.isDebugVisible) {
      this.updateDebugOverlay();
    }
  }
}
