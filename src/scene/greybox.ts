import {
  Container,
  Graphics,
  Text,
  TextStyle
} from 'pixi.js';
import {
  NAV_EDGES,
  NAV_WAYPOINTS,
  PLAYER_CONFIG,
  Point,
  SCENE_OBJECTS,
  SCREEN_CONFIG,
  SceneObjectConfig,
  WALKABLE_ZONES
} from '../config';
import { Customer, CustomerManager } from '../customer';
import {
  NavGraph,
  clampToWalkable,
  distance,
  findHitObject,
  isPointInWalkable
} from './nav';

export interface GreyboxCallbacks {
  onObjectInteract: (obj: SceneObjectConfig) => void;
  onCustomerInteract?: (customer: Customer) => void;
  onPositionChanged: (pos: Point) => void;
}

export class GreyboxScene {
  public readonly container: Container;
  private backgroundLayer: Container;
  private objectsLayer: Container;
  private customersLayer: Container;
  private playerLayer: Container;
  private debugLayer: Container;

  private playerGraphic: Graphics;
  private customersGraphic: Graphics;
  private playerPos: Point;
  private targetPath: Point[] = [];
  private pendingInteractObject: SceneObjectConfig | null = null;
  private pendingCustomer: Customer | null = null;
  private facing: 'left' | 'right' = 'right';

  private navGraph: NavGraph;
  private callbacks: GreyboxCallbacks;
  private keysPressed: Set<string> = new Set();
  private isDebugVisible: boolean = false;
  private customerManager: CustomerManager | null = null;

  private clickFeedbackGraphic: Graphics;
  private clickFeedbackTime: number = 0;

  constructor(
    initialPosition: Point,
    callbacks: GreyboxCallbacks,
    initialDebugState: boolean = false
  ) {
    this.playerPos = { ...initialPosition };
    this.callbacks = callbacks;
    this.isDebugVisible = initialDebugState;
    this.navGraph = new NavGraph();

    this.container = new Container();
    this.container.label = 'GreyboxScene';

    this.backgroundLayer = new Container();
    this.objectsLayer = new Container();
    this.customersLayer = new Container();
    this.playerLayer = new Container();
    this.debugLayer = new Container();

    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.objectsLayer);
    this.container.addChild(this.customersLayer);
    this.container.addChild(this.playerLayer);
    this.container.addChild(this.debugLayer);

    this.playerGraphic = new Graphics();
    this.playerLayer.addChild(this.playerGraphic);

    this.customersGraphic = new Graphics();
    this.customersLayer.addChild(this.customersGraphic);

    this.clickFeedbackGraphic = new Graphics();
    this.container.addChild(this.clickFeedbackGraphic);

    this.buildEnvironment();
    this.buildObjects();
    this.drawPlayer();
    this.updateDebugOverlay();
  }

  public setCustomerManager(mgr: CustomerManager): void {
    this.customerManager = mgr;
  }

  private buildEnvironment(): void {
    const bg = new Graphics();

    // Wall (upper area)
    bg.rect(0, 0, SCREEN_CONFIG.DESIGN_WIDTH, 520);
    bg.fill(0xd9c5b2);

    // Brick / wood wainscot
    bg.rect(0, 420, SCREEN_CONFIG.DESIGN_WIDTH, 100);
    bg.fill(0xbfa588);

    // Wooden Floor (lower area)
    bg.rect(0, 520, SCREEN_CONFIG.DESIGN_WIDTH, SCREEN_CONFIG.DESIGN_HEIGHT - 520);
    bg.fill(0xecd8be);

    // Floor wood plank lines
    for (let y = 550; y < SCREEN_CONFIG.DESIGN_HEIGHT; y += 45) {
      bg.moveTo(0, y);
      bg.lineTo(SCREEN_CONFIG.DESIGN_WIDTH, y);
      bg.stroke({ width: 1.5, color: 0xd6be9e });
    }

    // Ceiling string lights wire
    bg.moveTo(200, 140);
    bg.bezierCurveTo(450, 190, 800, 110, 1280, 130);
    bg.stroke({ width: 2, color: 0x3d2b1f });

    // Light bulbs along the wire
    const bulbPositions = [
      { x: 340, y: 165 },
      { x: 520, y: 168 },
      { x: 700, y: 140 },
      { x: 890, y: 118 },
      { x: 1080, y: 122 }
    ];
    for (const bulb of bulbPositions) {
      bg.circle(bulb.x, bulb.y, 8);
      bg.fill(0xffeaa7);
      bg.stroke({ width: 1.5, color: 0xd4a373 });
    }

    this.backgroundLayer.addChild(bg);
  }

  private buildObjects(): void {
    const labelStyle = new TextStyle({
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      dropShadow: {
        alpha: 0.8,
        blur: 3,
        color: 0x000000,
        distance: 1
      }
    });

    for (const obj of SCENE_OBJECTS) {
      const g = new Graphics();

      // Main rectangle
      g.roundRect(obj.x, obj.y, obj.width, obj.height, 8);
      g.fill(obj.color);
      g.stroke({ width: 2, color: 0x2b1d12 });

      // Special details for key objects
      if (obj.id === 'window') {
        // Window frame dividers
        g.rect(obj.x + 10, obj.y + 10, obj.width - 20, obj.height - 20);
        g.stroke({ width: 4, color: 0x6e4e37 });
        g.moveTo(obj.x + obj.width / 2, obj.y);
        g.lineTo(obj.x + obj.width / 2, obj.y + obj.height);
        g.stroke({ width: 3, color: 0x6e4e37 });
        g.moveTo(obj.x, obj.y + obj.height / 2);
        g.lineTo(obj.x + obj.width, obj.y + obj.height / 2);
        g.stroke({ width: 3, color: 0x6e4e37 });
      } else if (obj.id === 'cat_cushion') {
        // Cat cushion and cute sleeping cat shape
        g.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2 - 4, obj.height / 2 - 4);
        g.fill(0xff9f43);
        // Cat ears
        g.poly([
          { x: obj.x + 30, y: obj.y + 20 },
          { x: obj.x + 45, y: obj.y + 5 },
          { x: obj.x + 60, y: obj.y + 20 }
        ]);
        g.fill(0xee5253);
      } else if (obj.id === 'counter') {
        // Counter top wooden trim
        g.rect(obj.x - 5, obj.y - 4, obj.width + 10, 16);
        g.fill(0x5c3818);
      }

      this.objectsLayer.addChild(g);

      // Label text
      const txt = new Text({
        text: obj.name,
        style: labelStyle
      });
      txt.anchor.set(0.5, 0.5);
      txt.x = obj.x + obj.width / 2;
      txt.y = obj.y + Math.min(24, obj.height / 2);
      this.objectsLayer.addChild(txt);
    }
  }

  private drawPlayer(): void {
    this.playerGraphic.clear();

    const w = PLAYER_CONFIG.WIDTH;
    const h = PLAYER_CONFIG.HEIGHT;

    // Shadow
    this.playerGraphic.ellipse(0, h / 2 + 2, w / 2 + 4, 6);
    this.playerGraphic.fill({ color: 0x000000, alpha: 0.25 });

    // Barista body / clothes
    this.playerGraphic.roundRect(-w / 2, -h / 2, w, h, 6);
    this.playerGraphic.fill(PLAYER_CONFIG.COLOR);
    this.playerGraphic.stroke({ width: 2, color: 0x1a3324 });

    // Barista Apron
    this.playerGraphic.roundRect(-w / 2 + 4, -h / 4, w - 8, h * 0.55, 4);
    this.playerGraphic.fill(0xe0a96d);

    // Barista Cap / Head detail
    this.playerGraphic.roundRect(-w / 2 + 2, -h / 2 - 6, w - 4, 10, 3);
    this.playerGraphic.fill(PLAYER_CONFIG.ACCENT_COLOR);

    // Face / direction indicator
    const eyeOffset = this.facing === 'right' ? 4 : -4;
    this.playerGraphic.circle(eyeOffset, -h / 2 + 8, 2.5);
    this.playerGraphic.fill(0xffffff);

    this.playerGraphic.x = this.playerPos.x;
    this.playerGraphic.y = this.playerPos.y;
  }

  private drawCustomers(): void {
    this.customersGraphic.clear();
    if (!this.customerManager) return;

    for (const c of this.customerManager.getCustomers()) {
      if (c.state === 'LEFT') continue;

      const cw = 24;
      const ch = 36;
      const cx = c.pos.x;
      const cy = c.pos.y;

      // Shadow
      this.customersGraphic.ellipse(cx, cy + ch / 2 + 2, cw / 2 + 3, 5);
      this.customersGraphic.fill({ color: 0x000000, alpha: 0.22 });

      // Body
      this.customersGraphic.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 6);
      this.customersGraphic.fill(c.color);
      this.customersGraphic.stroke({ width: 1.5, color: 0x2d3436 });

      // Head
      this.customersGraphic.circle(cx, cy - ch / 2 - 8, 9);
      this.customersGraphic.fill(0xf6d8ae);
      this.customersGraphic.stroke({ width: 1.5, color: 0x2d3436 });

      // Eye
      const eyeX = c.facing === 'right' ? cx + 3 : cx - 3;
      this.customersGraphic.circle(eyeX, cy - ch / 2 - 8, 1.8);
      this.customersGraphic.fill(0x2d3436);

      // If enjoying drink, show little coffee cup on table
      if (c.state === 'ENJOYING_DRINK' || c.state === 'WAITING_TO_PAY') {
        const tableObj = SCENE_OBJECTS.find((o) => o.id === c.seat.tableId);
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

    // 1. Draw Walkable Zones in translucent emerald green
    for (const zone of WALKABLE_ZONES) {
      g.rect(zone.x, zone.y, zone.width, zone.height);
      g.fill({ color: 0x2ecc71, alpha: 0.2 });
      g.stroke({ width: 1.5, color: 0x27ae60 });
    }

    // 2. Draw Object Hitboxes in translucent amber
    for (const obj of SCENE_OBJECTS) {
      g.rect(obj.hitbox.x, obj.hitbox.y, obj.hitbox.width, obj.hitbox.height);
      g.fill({ color: 0xf39c12, alpha: 0.12 });
      g.stroke({ width: 1.5, color: 0xd35400 });

      // Draw interaction point
      g.circle(obj.interactPoint.x, obj.interactPoint.y, 6);
      g.fill(0xe74c3c);
      g.stroke({ width: 1.5, color: 0xffffff });
    }

    // 3. Draw Nav Edges in cyan
    for (const edge of NAV_EDGES) {
      const fromWp = NAV_WAYPOINTS.find((w) => w.id === edge.from);
      const toWp = NAV_WAYPOINTS.find((w) => w.id === edge.to);
      if (fromWp && toWp) {
        g.moveTo(fromWp.x, fromWp.y);
        g.lineTo(toWp.x, toWp.y);
        g.stroke({ width: 2, color: 0x00cec9, alpha: 0.7 });
      }
    }

    // 4. Draw Nav Waypoint Nodes
    for (const wp of NAV_WAYPOINTS) {
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

    // Rule 1: Object / Customer prioritized over empty ground move
    // 1A. Check if clicked directly on or near an active customer
    if (this.customerManager) {
      for (const c of this.customerManager.getCustomers()) {
        if (c.state === 'LEFT' || c.state === 'LEAVING') continue;
        if (distance(pt, c.pos) <= 45) {
          this.pendingCustomer = c;
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

    // 1B. Check if clicked on a scene object
    const hit = findHitObject(pt);
    if (hit) {
      // If clicked on a table that currently has a customer, route to serve/checkout that customer
      if (this.customerManager) {
        const tableCustomer = this.customerManager.getCustomerByTable(hit.id);
        if (tableCustomer) {
          this.pendingCustomer = tableCustomer;
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
      const d = distance(this.playerPos, hit.interactPoint);
      // If already at interact point, trigger immediately
      if (d <= 36) {
        this.targetPath = [];
        this.callbacks.onObjectInteract(hit);
        this.pendingInteractObject = null;
        this.updateDebugOverlay();
        return;
      }
      // Rule 3: Automatically move to interaction point
      this.targetPath = this.navGraph.route(this.playerPos, hit.interactPoint);
      this.updateDebugOverlay();
      return;
    }

    // Rule 2: Click on empty ground moves to position
    this.pendingInteractObject = null;
    this.pendingCustomer = null;
    const targetPoint = clampToWalkable(pt);
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
    this.clickFeedbackTime = 0.25; // seconds
  }

  public update(deltaSeconds: number): void {
    this.drawCustomers();

    if (this.clickFeedbackTime > 0) {
      this.clickFeedbackTime -= deltaSeconds;
      if (this.clickFeedbackTime <= 0) {
        this.clickFeedbackGraphic.clear();
      }
    }

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
        if (isPointInWalkable({ x: nextX, y: nextY })) {
          this.playerPos.x = nextX;
          this.playerPos.y = nextY;
          moved = true;
        } else if (isPointInWalkable({ x: nextX, y: this.playerPos.y })) {
          this.playerPos.x = nextX;
          moved = true;
        } else if (isPointInWalkable({ x: this.playerPos.x, y: nextY })) {
          this.playerPos.y = nextY;
          moved = true;
        }

        if (moved) {
          this.drawPlayer();
          this.callbacks.onPositionChanged(this.playerPos);
          if (this.isDebugVisible) this.updateDebugOverlay();
        }
      }
      return;
    }

    // 2. Click-to-move along targetPath
    if (this.targetPath.length > 0) {
      const nextTarget = this.targetPath[0];
      const dist = distance(this.playerPos, nextTarget);
      const step = PLAYER_CONFIG.SPEED * deltaSeconds;

      if (nextTarget.x > this.playerPos.x + 2) this.facing = 'right';
      else if (nextTarget.x < this.playerPos.x - 2) this.facing = 'left';

      if (dist <= step) {
        // Arrived at current waypoint
        this.playerPos.x = nextTarget.x;
        this.playerPos.y = nextTarget.y;
        this.targetPath.shift();

        if (this.targetPath.length === 0) {
          // Reached final destination!
          if (this.pendingCustomer) {
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
      }

      this.drawPlayer();
      this.callbacks.onPositionChanged(this.playerPos);
      if (this.isDebugVisible) {
        this.updateDebugOverlay();
      }
    }
  }

  public getPlayerPosition(): Point {
    return { ...this.playerPos };
  }

  public setPlayerPosition(pos: Point): void {
    this.playerPos = { ...pos };
    this.targetPath = [];
    this.pendingInteractObject = null;
    this.pendingCustomer = null;
    this.drawPlayer();
    if (this.isDebugVisible) {
      this.updateDebugOverlay();
    }
  }
}
