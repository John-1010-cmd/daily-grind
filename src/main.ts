import { Application, Graphics } from 'pixi.js';
import { GameClock } from './clock';
import {
  DECOR_SLOTS,
  NAV_EDGES,
  NAV_WAYPOINTS,
  PLAYER_CONFIG,
  REGULAR_CONFIG,
  REGULAR_DEFS,
  SCREEN_CONFIG,
  STAFF_CONFIG
} from './config';
import { AchievementManager } from './achievements';
import { Customer, CustomerManager } from './customer';
import { DecorManager } from './decor';
import { EconomyLedger } from './economy';
import { EquipmentManager } from './equipment';
import { DreamFundManager, FundMetrics } from './fund';
import { InventoryManager } from './inventory';
import { OrderStateMachine } from './order';
import { RegularManager } from './regulars';
import { SaveManager } from './save';
import { GreyboxScene } from './scene/greybox';
import { LightingSystem } from './scene/lighting';
import { NavGraph } from './scene/nav';
import { StaffMember } from './staff';
import {
  DecorModal,
  FundModal,
  HandbookModal,
  Hud,
  StaffModal,
  StoryModal,
  ToastManager,
  WorldOverlay
} from './ui';

async function bootstrap() {
  // 1. Storage & Save Manager
  const saveManager = new SaveManager();
  saveManager.setupLifecycleHooks(window);

  const initialSave = saveManager.getState();

  // 2. Inventory & Economy Ledger (T1.4 & T1.6)
  const inventory = new InventoryManager(initialSave.inventory);
  const ledger = new EconomyLedger(saveManager);

  // Sync inventory changes back to save state
  const syncInventoryToSave = () => {
    saveManager.updateState((draft) => {
      draft.inventory = inventory.getAllStock();
    });
  };

  // 3. Three-clock System (T0.6)
  const gameClock = new GameClock(initialSave.activePlayTime);
  gameClock.alignWithWallClock();

  const offlineElapsedSeconds = gameClock.getOfflineElapsed(initialSave.lastSavedAt);
  const offlineHours = (offlineElapsedSeconds / 3600).toFixed(1);

  // 4. Navigation Graph & Core Order/Customer Systems (T1.1 & T1.2)
  const navGraph = new NavGraph(NAV_WAYPOINTS, NAV_EDGES);
  const orderStateMachine = new OrderStateMachine(inventory, ledger, saveManager);
  const customerManager = new CustomerManager(navGraph, inventory, orderStateMachine);

  // 4.5 M3 长线系统：基金 / 设备 / 常客 / 店员 / 装修 / 成就
  const fundManager = new DreamFundManager(saveManager);
  const equipmentManager = new EquipmentManager(saveManager);
  const regularManager = new RegularManager(saveManager);
  const decorManager = new DecorManager(saveManager);
  const achievementManager = new AchievementManager(saveManager, ledger);

  const toastManagerRef: { current: ToastManager | null } = { current: null };
  const storyModalRef: { current: StoryModal | null } = { current: null };

  const buildFundMetrics = (): FundMetrics => {
    const state = saveManager.getState();
    return {
      completedOrders: state.stats.completedOrders,
      totalRevenue: state.stats.totalRevenue,
      storiesUnlocked:
        regularManager.getTotalStoriesSeen() + state.staff.storiesSeen.length
    };
  };

  const runAchievementCheck = () => {
    const state = saveManager.getState();
    const newlyUnlocked = achievementManager.evaluate({
      completedOrders: state.stats.completedOrders,
      totalRevenue: state.stats.totalRevenue,
      unlockedRecipeIds: state.unlockedRecipes,
      regulars: state.regulars,
      ownedVariantCount: decorManager.getOwnedVariantCount(),
      catPoseCount: state.catPosesSeen.length,
      storiesSeenCount:
        regularManager.getTotalStoriesSeen() + state.staff.storiesSeen.length
    });
    for (const def of newlyUnlocked) {
      const rewardText = 'gold' in def.reward ? `🪙+${def.reward.gold}` : '获得徽章';
      toastManagerRef.current?.show(`🏅 达成成就【${def.name}】！${rewardText}`);
    }
  };

  const staffMember = new StaffMember({
    orderStateMachine,
    customerManager,
    inventory,
    ledger,
    saveManager,
    getBrewSlots: () => equipmentManager.getBrewSlots(),
    routeToExit: (from) => navGraph.route(from, { x: 520, y: 550 }),
    onStoryUnlocked: (chapter) => {
      storyModalRef.current?.enqueue({
        portraitIcon: '🧑‍🎨',
        speaker: '小晴',
        title: chapter.title,
        text: chapter.text
      });
    },
    onAutoOrderCompleted: (customer) => {
      handleOrderCompletedForCustomer(customer);
    }
  });

  // 账本结算顺序挂钩：营业额 → 店员抽成 → 基金还款 → 玩家净入账
  ledger.setHooks({
    getStaffCut: (gross) => staffMember.getWageCut(gross),
    repayFund: (gross) => fundManager.repayFromIncome(gross)
  });

  // 常客接入顾客生成与点单
  customerManager.setRegularHooks({
    pickRegular: (activeRegularIds) => {
      if (Math.random() >= REGULAR_CONFIG.SPAWN_CHANCE) return null;
      const candidates = REGULAR_DEFS.filter((d) => !activeRegularIds.has(d.id));
      if (candidates.length === 0) return null;
      const def = candidates[Math.floor(Math.random() * candidates.length)];
      return { id: def.id, name: def.name, color: def.color };
    },
    onRegularArrive: (regularId) => {
      regularManager.markVisit(regularId);
    },
    pickRecipeFor: (regularId, unlockedRecipeIds) => {
      const def = regularManager.getDef(regularId);
      if (!def) return null;
      // 好感达标后概率点专属
      if (
        regularManager.isExclusiveUnlocked(regularId) &&
        Math.random() < REGULAR_CONFIG.EXCLUSIVE_ORDER_CHANCE
      ) {
        const exclusive = regularManager.getExclusiveRecipeAsRecipeDef(regularId);
        if (exclusive) {
          return { kind: 'exclusive', recipe: exclusive };
        }
      }
      // 固定偏好未解锁时退回随机已解锁配方
      if (unlockedRecipeIds.includes(def.preferredRecipeId)) {
        return { kind: 'preferred', recipeId: def.preferredRecipeId };
      }
      return null;
    }
  });

  // 常客好感与剧情：玩家收银与店员自动收银共用
  function handleOrderCompletedForCustomer(customer: Customer): void {
    if (customer.regularId) {
      const def = regularManager.getDef(customer.regularId);
      const result = regularManager.onOrderCompleted(customer.regularId);
      for (const story of result.newStories) {
        storyModalRef.current?.enqueue({
          portraitIcon: def?.portraitIcon ?? '👤',
          speaker: def?.name ?? '常客',
          title: story.title,
          text: story.text
        });
      }
      if (result.exclusiveJustUnlocked && def) {
        toastManagerRef.current?.show(
          `💝 与【${def.name}】的情谊更深了！TA 解锁了专属点单【${regularManager.getExclusiveRecipe(def.id)?.name}】`
        );
      }
    }
    runAchievementCheck();
  }

  // 5. Setup Letterbox Viewport Scaling
  const viewportContainer = document.getElementById('viewport-container') as HTMLElement;
  const uiRoot = document.getElementById('ui-root') as HTMLElement;
  const sceneContainer = document.getElementById('scene-container') as HTMLElement;

  function updateViewportScale() {
    if (!viewportContainer) return;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    const scale = Math.min(
      winWidth / SCREEN_CONFIG.DESIGN_WIDTH,
      winHeight / SCREEN_CONFIG.DESIGN_HEIGHT
    );
    viewportContainer.style.transform = `scale(${scale})`;
  }

  window.addEventListener('resize', updateViewportScale);
  updateViewportScale();

  // 6. Initialize PixiJS Application
  const app = new Application();
  await app.init({
    width: SCREEN_CONFIG.DESIGN_WIDTH,
    height: SCREEN_CONFIG.DESIGN_HEIGHT,
    backgroundColor: 0xecd8be,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });

  sceneContainer.appendChild(app.canvas);

  // 7. Toast & World Overlay Systems
  const toastManager = new ToastManager(uiRoot);
  const worldOverlay = new WorldOverlay(uiRoot);
  const storyModal = new StoryModal(uiRoot);
  toastManagerRef.current = toastManager;
  storyModalRef.current = storyModal;

  if (offlineElapsedSeconds > 60) {
    toastManager.show(`欢迎回来！离线已过 ${offlineHours} 小时（分店挂机将在 M5 结算）`);
  }

  // 8. Build Greybox Scene & Lighting
  const initialPlayerPos = initialSave.player && Number.isFinite(initialSave.player.x)
    ? initialSave.player
    : { x: PLAYER_CONFIG.INITIAL_X, y: PLAYER_CONFIG.INITIAL_Y };

  let greyboxScene!: GreyboxScene;

  greyboxScene = new GreyboxScene(
    initialPlayerPos,
    {
      onCustomerInteract: (customer) => {
        const order = customer.orderId ? orderStateMachine.getOrder(customer.orderId) : undefined;

        // A. Waiting for order -> Take order!
        if (customer.state === 'WAITING_FOR_ORDER' && order) {
          if (orderStateMachine.canClaimTask(order.id, 'TAKE_ORDER')) {
            orderStateMachine.claimTask(order.id, 'TAKE_ORDER', 'player');
            const success = orderStateMachine.completeTask(order.id, 'TAKE_ORDER', 'player');
            if (success) {
              customer.state = 'WAITING_FOR_DRINK';
              customerManager.setBubble(customer, `好期待这杯【${order.recipe.name}】！`, 2.5);
              toastManager.show(`已为客人接单：【${order.recipe.name}】（原料已锁定）`);
              syncInventoryToSave();
            } else {
              toastManager.show('接单失败：原料不足，请先在右上角【进货】采购！');
            }
          }
          return;
        }

        // B. Waiting for drink & drink ready to serve -> Serve!
        if (customer.state === 'WAITING_FOR_DRINK' && order && order.state === 'WAITING_TO_SERVE') {
          if (orderStateMachine.canClaimTask(order.id, 'SERVE')) {
            orderStateMachine.claimTask(order.id, 'SERVE', 'player');
            orderStateMachine.completeTask(order.id, 'SERVE', 'player');
            customer.state = 'ENJOYING_DRINK';
            customerManager.setBubble(customer, '香气四溢！好喝，谢谢店主~', 3.0);
            toastManager.show(`为客人送上【${order.recipe.name}】`);
            syncInventoryToSave();
          }
          return;
        }

        // C. Waiting to pay -> Checkout!
        if (customer.state === 'WAITING_TO_PAY' && order) {
          if (orderStateMachine.canClaimTask(order.id, 'CHECKOUT')) {
            orderStateMachine.claimTask(order.id, 'CHECKOUT', 'player');
            orderStateMachine.completeTask(order.id, 'CHECKOUT', 'player');
            customerManager.setBubble(customer, '多谢款待，下次再来！', 3.0);
            customer.state = 'LEAVING';
            customer.walkPath = navGraph.route(customer.pos, { x: 520, y: 550 });
            const staffCut = staffMember.getWageCut(order.recipe.price);
            const repayNote = fundManager.getLoans().some((l) => l.repaid < l.amount)
              ? '（含还款罐与工资抽存）'
              : staffCut > 0 ? '（含店员工资抽成）' : '';
            toastManager.show(`结账成功：🪙 +${order.recipe.price}，营业额已入账${repayNote}！`);
            handleOrderCompletedForCustomer(customer);
          }
          return;
        }

        // Other customer states
        if (customer.state === 'ENJOYING_DRINK') {
          customerManager.setBubble(customer, '正在细细品尝中，味道真不错~', 2.0);
        } else if (customer.state === 'SEATED_CHOOSING') {
          customerManager.setBubble(customer, '还在挑饮品呢，稍等我一下下~', 2.0);
        }
      },

      onCatInteract: (cat) => {
        const res = cat.pet();
        toastManager.show(`🐱【橘猫】${res.text}`);
      },

      onObjectInteract: (obj) => {
        // Counter or Espresso machine
        if (obj.id === 'counter' || obj.id === 'espresso_machine' || obj.id === 'pastry_case') {
          const waitingBrew = orderStateMachine.getWaitingToBrewOrders();
          if (waitingBrew.length > 0) {
            // 设备双杯槽位限制 (T3.2)
            const brewingCount = orderStateMachine.getBrewingOrders().length;
            if (brewingCount >= equipmentManager.getBrewSlots()) {
              toastManager.show('咖啡机正在全力萃取中，稍等片刻~');
              return;
            }
            const nextOrder = waitingBrew[0];
            orderStateMachine.claimTask(nextOrder.id, 'BREW', 'player');
            orderStateMachine.startTask(nextOrder.id, 'BREW', 'player');
            toastManager.show(`☕ 开始制作【${nextOrder.recipe.name}】...`);
            return;
          }

          const waitingServe = orderStateMachine.getWaitingToServeOrders();
          if (waitingServe.length > 0) {
            const readyOrder = waitingServe[0];
            const targetCustomer = customerManager.getCustomerById(readyOrder.customerId);
            if (targetCustomer) {
              toastManager.show(`端起做好的【${readyOrder.recipe.name}】，送去给【${targetCustomer.name}】`);
              greyboxScene.handlePointerDown(targetCustomer.pos.x, targetCustomer.pos.y);
              return;
            }
          }

          toastManager.show(`【${obj.name}】擦拭整洁，散发着咖啡香气。`);
          return;
        }

        // If clicked a table with a customer
        const tableCustomer = customerManager.getCustomerByTable(obj.id);
        if (tableCustomer) {
          greyboxScene.handlePointerDown(tableCustomer.pos.x, tableCustomer.pos.y);
          return;
        }

        // M3 装修：点击家具直接轮换已拥有款式 (T3.1)
        const decorSlot = DECOR_SLOTS.find((s) => s.sceneObjectId === obj.id);
        if (decorSlot) {
          const next = decorManager.cycleVariant(decorSlot.id);
          if (next) {
            toastManager.show(`🛋️【${decorSlot.name}】换上了【${next.name}】`);
          }
          runAchievementCheck();
          return;
        }

        toastManager.show(`【${obj.name}】${obj.description}`);
      },

      onPositionChanged: (pos) => {
        saveManager.setPlayerPosition(Math.round(pos.x), Math.round(pos.y));
      }
    },
    initialSave.settings.debugNavOverlay
  );

  greyboxScene.setCustomerManager(customerManager);

  // M3 店员视觉：吧台内侧的简约小人（成品立绘量产前的小幅灰盒，T3.8 替换）
  const staffGraphics = new Graphics();
  greyboxScene.container.addChild(staffGraphics);

  const drawStaffFigure = (time: number) => {
    staffGraphics.clear();
    if (!staffMember.isHired()) return;
    const anchor = STAFF_CONFIG.WORK_ANCHOR;
    const bob = staffMember.isBusy() ? Math.sin(time * 8) * 2 : Math.sin(time * 2) * 0.8;
    const x = anchor.x;
    const y = anchor.y + bob;
    // shadow
    staffGraphics.ellipse(x, anchor.y + 18, 14, 4);
    staffGraphics.fill({ color: 0x000000, alpha: 0.2 });
    // body（米色围裙）
    staffGraphics.roundRect(x - 10, y - 18, 20, 34, 6);
    staffGraphics.fill(0xf3e5c8);
    staffGraphics.stroke({ width: 1.5, color: 0x8c6239 });
    // head
    staffGraphics.circle(x, y - 26, 8);
    staffGraphics.fill(0xf6d8ae);
    staffGraphics.stroke({ width: 1.5, color: 0x8c6239 });
  };

  // M3 主题色调覆盖层（T3.1 整店主题，位于场景之上、光照之下）
  const themeTintGraphics = new Graphics();
  const applyThemeTint = () => {
    themeTintGraphics.clear();
    const theme = decorManager.getTheme();
    if (theme.tintAlpha <= 0) return;
    themeTintGraphics.rect(0, 0, SCREEN_CONFIG.DESIGN_WIDTH, SCREEN_CONFIG.DESIGN_HEIGHT);
    themeTintGraphics.fill({ color: theme.tintColor, alpha: theme.tintAlpha });
  };
  applyThemeTint();

  const lightingSystem = new LightingSystem(gameClock);

  app.stage.addChild(greyboxScene.container);
  app.stage.addChild(themeTintGraphics);
  app.stage.addChild(lightingSystem.getDisplayObject());

  // 9. Setup HUD (T0.9 & T1.3 & T1.4)
  const hud = new Hud(
    uiRoot,
    saveManager,
    inventory,
    ledger,
    toastManager,
    {
      onToggleDebug: (enabled) => {
        greyboxScene.setDebugVisible(enabled);
      },
      onResetGame: () => {
        const resetPos = { x: PLAYER_CONFIG.INITIAL_X, y: PLAYER_CONFIG.INITIAL_Y };
        greyboxScene.setPlayerPosition(resetPos);
        gameClock.setActivePlayTime(0);
        gameClock.alignWithWallClock();
        syncInventoryToSave();
      }
    }
  );

  hud.setM3Modals({
    decorModal: new DecorModal(uiRoot, saveManager, ledger, decorManager, fundManager, buildFundMetrics, toastManager),
    fundModal: new FundModal(uiRoot, saveManager, ledger, fundManager, buildFundMetrics, toastManager),
    staffModal: new StaffModal(uiRoot, saveManager, staffMember, toastManager),
    handbookModal: new HandbookModal(uiRoot, saveManager, regularManager, decorManager, achievementManager)
  });
  hud.getRecipesModal().setEquipmentManager(equipmentManager);
  hud.getSupplyModal().setFundCapacityProvider(() => fundManager.hasAvailableCapacity(buildFundMetrics()));

  // 10. Pointer Event Routing (T0.2 & T0.5)
  viewportContainer.addEventListener('pointerdown', (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target && target.closest('.interactive, .hud-btn, .hud-badge, .debug-btn, .modal-panel')) {
      return;
    }

    const rect = viewportContainer.getBoundingClientRect();
    const scale = rect.width / SCREEN_CONFIG.DESIGN_WIDTH;
    if (scale <= 0) return;

    const designX = (e.clientX - rect.left) / scale;
    const designY = (e.clientY - rect.top) / scale;

    greyboxScene.handlePointerDown(designX, designY);
  });

  // Keyboard controls
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (e.key === 'F2') {
      const nextDebug = !greyboxScene.isDebug();
      greyboxScene.setDebugVisible(nextDebug);
      saveManager.setDebugNavOverlay(nextDebug);
      toastManager.show(`导航调试视图已${nextDebug ? '开启' : '关闭'}`);
      return;
    }
    greyboxScene.handleKeyDown(e.key);
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    greyboxScene.handleKeyUp(e.key);
  });

  // 11. Main Game Loop
  let lastTime = performance.now();
  let saveSyncTimer = 0;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      gameClock.pause();
      saveManager.saveImmediate();
    } else {
      gameClock.resume();
      lastTime = performance.now();
    }
  });

  app.ticker.add(() => {
    const now = performance.now();
    const deltaMs = now - lastTime;
    lastTime = now;

    const deltaSeconds = Math.min(deltaMs / 1000, 0.1);

    // Tick clocks
    gameClock.tick(deltaMs);

    // 设备加速系数同步 (T3.2)
    orderStateMachine.brewSpeedMultiplier = equipmentManager.getBrewSpeedMultiplier();

    // M3 店员自动干活
    staffMember.update(deltaSeconds);
    drawStaffFigure(now / 1000);

    // Update order brewing progress
    const finishedBrews = orderStateMachine.tickBrewing(deltaSeconds);
    for (const b of finishedBrews) {
      toastManager.show(`✨【${b.recipe.name}】已萃取完成！请前往吧台取杯送餐。`);
    }

    // Update customers
    const unlockedIds = saveManager.getState().unlockedRecipes;
    customerManager.update(deltaSeconds, unlockedIds);

    // Update scene & lighting
    greyboxScene.update(deltaSeconds);
    const currentPeriod = lightingSystem.update(deltaSeconds);
    hud.updatePeriod(currentPeriod);

    // Determine Onboarding Guide Text (T1.8)
    const activeCustomers = customerManager.getCustomers();
    let guideText: string | null = null;

    const waitingOrderCust = activeCustomers.find((c) => c.state === 'WAITING_FOR_ORDER');
    const waitingBrewOrder = orderStateMachine.getWaitingToBrewOrders()[0];
    const brewingOrder = orderStateMachine.getBrewingOrders()[0] || null;
    const waitingServeOrder = orderStateMachine.getWaitingToServeOrders()[0];
    const waitingPayCust = activeCustomers.find((c) => c.state === 'WAITING_TO_PAY');

    if (waitingOrderCust) {
      guideText = '点击头顶有【点单】气泡的客人，前往桌前接单';
    } else if (waitingBrewOrder) {
      guideText = '前往吧台，点击咖啡机开始制作饮品';
    } else if (brewingOrder) {
      guideText = '咖啡机正在萃取中，稍等片刻...';
    } else if (waitingServeOrder) {
      guideText = '饮品已制作完毕！点击客人桌位送餐上菜';
    } else if (waitingPayCust) {
      guideText = '客人已品尝完毕，点击【买单】结账入账';
    } else if (activeCustomers.length === 0) {
      guideText = '使用 WASD 或点击地面走动，静待客人进店光顾';
    }

    // Update World Overlay (Bubbles, brewing bar, guide banner)
    worldOverlay.update({
      customers: activeCustomers,
      activeOrders: orderStateMachine.getActiveOrders(),
      brewingOrder,
      guideStepText: guideText
    });

    // Periodically update activePlayTime and inventory in save state
    saveSyncTimer += deltaSeconds;
    if (saveSyncTimer >= 1.0) {
      saveSyncTimer = 0;
      saveManager.setActivePlayTime(gameClock.getActivePlayTime());
      saveManager.updateState((draft) => {
        draft.inventory = inventory.getAllStock();
      });

      // M3：记录见过的猫睡姿（猫咪图鉴 + 成就）
      const pose = greyboxScene.getCatComponent().getCurrentPose();
      if (!saveManager.getState().catPosesSeen.includes(pose)) {
        saveManager.updateState((draft) => {
          draft.catPosesSeen.push(pose);
        });
        runAchievementCheck();
      }

      // 主题色调可能被装修面板切换，周期性刷新覆盖层
      applyThemeTint();
    }
  });

  console.log('Daily Grind M3 经营厚度已启动。');
}

bootstrap().catch((err) => {
  console.error('游戏启动失败:', err);
});
