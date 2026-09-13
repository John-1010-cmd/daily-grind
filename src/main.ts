import { Application, Assets, Graphics } from 'pixi.js';
import { CORE_PIXI_ASSETS } from './assets/preload';
import { GameClock } from './clock';
import {
  CUSTOMER_CONFIG,
  REGULAR_CONFIG,
  REGULAR_DEFS,
  PERFORMANCE_BUDGETS,
  SCREEN_CONFIG,
  SHOP_SCENES,
  SHOP_SIMULATION_CONFIG,
  STAFF_CONFIG,
  ShopId,
  StaffDuty
} from './config';
import { AchievementManager } from './achievements';
import { AudioManager } from './audio';
import { Customer } from './customer';
import { CatInteractionManager } from './cat';
import { EconomyLedger } from './economy';
import { EquipmentManager } from './equipment';
import { DreamFundManager, FundMetrics } from './fund';
import { FurnitureManager } from './furniture';
import { InventoryManager } from './inventory';
import { NOOP_LATTE_ART_HOOK, toLatteArtEvent } from './order';
import { RegularManager } from './regulars';
import { SaveManager } from './save';
import { GreyboxScene } from './scene/greybox';
import { CustomerCharacter } from './scene/customerCharacter';
import { LightingSystem } from './scene/lighting';
import {
  advanceShop,
  BranchManager,
  createShopRuntime,
  getCustomerIntervalMultiplier,
  prepareShopSwitch,
  settleWorldIdle,
  ShopRuntime,
  ShopSimulationState
} from './shop';
import { StaffMember } from './staff';
import {
  DecorModal,
  BaristaModal,
  FundModal,
  HandbookModal,
  Hud,
  MapModal,
  StaffModal,
  StoryModal,
  ToastManager,
  WorldOverlay
} from './ui';
import { regularPortraitUrl } from './ui/regularPortraits';
import staffXiaoqingUrl from './assets/staff/staff_xiaoqing.png';

async function bootstrap() {
  // 1. Storage & Save Manager
  const saveManager = new SaveManager();
  saveManager.setupLifecycleHooks(window);

  const initialSave = saveManager.getState();
  const audioManager = new AudioManager(initialSave.settings);

  // 2. Inventory & Economy Ledger (T1.4 & T1.6)
  const inventory = new InventoryManager(initialSave.inventory);
  const ledger = new EconomyLedger(saveManager);
  const furnitureManager = new FurnitureManager(saveManager, ledger);

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
  const mainRuntime = createShopRuntime(SHOP_SCENES.main, inventory, ledger, saveManager);
  const seasideRuntime = createShopRuntime(SHOP_SCENES.seaside, inventory, ledger, saveManager);
  const shopRuntimes: Record<ShopId, ShopRuntime> = {
    main: mainRuntime,
    seaside: seasideRuntime
  };
  for (const shopId of ['main', 'seaside'] as const) {
    const runtime = shopRuntimes[shopId];
    runtime.customerManager.setSceneOptions({
      tableSeats: furnitureManager.getActiveSeats(shopId, runtime.scene.tableSeats),
      queueSpots: runtime.scene.queueSpots,
      spawnPos: runtime.scene.customerSpawn,
      exitPos: runtime.scene.customerExit
    });
  }
  const savedActiveShopId = initialSave.world.activeShopId;
  let activeShopId: ShopId =
    savedActiveShopId === 'seaside' && initialSave.world.shops.seaside.unlocked
      ? 'seaside'
      : 'main';
  let activeRuntime = shopRuntimes[activeShopId];
  let navGraph = activeRuntime.navGraph;
  let orderStateMachine = activeRuntime.orderStateMachine;
  let customerManager = activeRuntime.customerManager;

  const connectLatteArtHook = (runtime: ShopRuntime) => runtime.orderStateMachine.setBrewStartedHook((order) => {
    if (order.recipe.id.startsWith(REGULAR_CONFIG.EXCLUSIVE_RECIPE_PREFIX)) {
      NOOP_LATTE_ART_HOOK.onExclusiveDrinkBrewStarted(toLatteArtEvent(order));
    }
  });
  connectLatteArtHook(mainRuntime);
  connectLatteArtHook(seasideRuntime);

  // 4.5 M3 长线系统：基金 / 设备 / 常客 / 店员 / 装修 / 成就
  const fundManager = new DreamFundManager(saveManager);
  const equipmentManager = new EquipmentManager(saveManager);
  const regularManager = new RegularManager(saveManager);
  let decorManager = activeRuntime.decorManager;
  const achievementManager = new AchievementManager(saveManager, ledger);
  const branchManager = new BranchManager(saveManager, ledger, achievementManager);
  const catInteractionManager = new CatInteractionManager(saveManager, ledger);
  const simulationStates: Record<ShopId, ShopSimulationState> = {
    main: structuredClone(initialSave.world.shops.main.simulation),
    seaside: structuredClone(initialSave.world.shops.seaside.simulation)
  };

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
      ownedVariantCount:
        mainRuntime.decorManager.getOwnedVariantCount() +
        seasideRuntime.decorManager.getOwnedVariantCount(),
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
    orderStateMachine: mainRuntime.orderStateMachine,
    customerManager: mainRuntime.customerManager,
    inventory,
    ledger,
    saveManager,
    getBrewSlots: () => equipmentManager.getBrewSlots(),
    routeToExit: (from) => mainRuntime.navGraph.route(from, SHOP_SCENES.main.customerExit),
    onStoryUnlocked: (chapter) => {
      storyModalRef.current?.enqueue({
        portraitIcon: '🧑‍🎨',
        portraitImage: staffXiaoqingUrl,
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

  let idleWelcomeMessage: string | null = null;
  const settleOpenedWorld = () => {
    const state = saveManager.getState();
    const settled = settleWorldIdle({
      inventory: inventory.getAllAvailable(),
      unlockedRecipeIds: state.unlockedRecipes,
      brewSpeedMultiplier: equipmentManager.getBrewSpeedMultiplier(),
      mainStaff: {
        hired: state.staff.hired,
        duties: state.staff.duties.filter((duty): duty is StaffDuty =>
          (SHOP_SIMULATION_CONFIG.AUTONOMOUS_DUTIES as readonly string[]).includes(duty)
        )
      },
      shops: {
        main: {
          unlocked: true,
          lastSettledAt: state.world.shops.main.lastSettledAt || state.lastSavedAt,
          simulation: simulationStates.main,
          decorOwnedCount: mainRuntime.decorManager.getOwnedVariantCount()
        },
        seaside: {
          unlocked: state.world.shops.seaside.unlocked,
          lastSettledAt: state.world.shops.seaside.lastSettledAt || state.lastSavedAt,
          simulation: simulationStates.seaside,
          decorOwnedCount: seasideRuntime.decorManager.getOwnedVariantCount()
        }
      }
    }, gameClock.getWallClock());

    inventory.reconcileAvailableStock(settled.state.inventory);
    for (const shop of settled.shops) {
      if (shop.gross <= 0) continue;
      ledger.settleWorldIdleIncome(
        shop.shopName,
        shop.completedOrders,
        shop.gross,
        shop.shopId === 'main'
      );
      saveManager.updateState((draft) => {
        draft.stats.completedOrders += shop.completedOrders;
        draft.stats.totalRevenue += shop.gross;
        for (const recipe of shop.recipes) {
          draft.recipeMastery[recipe.recipeId] =
            (draft.recipeMastery[recipe.recipeId] ?? 0) + recipe.count;
        }
      });
    }
    simulationStates.main = settled.state.shops.main.simulation;
    simulationStates.seaside = settled.state.shops.seaside.simulation;
    saveManager.updateState((draft) => {
      draft.inventory = inventory.getAllStock();
      draft.world.shops.main.lastSettledAt = settled.state.shops.main.lastSettledAt;
      draft.world.shops.seaside.lastSettledAt = settled.state.shops.seaside.lastSettledAt;
      draft.world.shops.main.simulation = structuredClone(simulationStates.main);
      draft.world.shops.seaside.simulation = structuredClone(simulationStates.seaside);
    });

    if (settled.totalCompletedOrders > 0) {
      const details = settled.shops
        .filter((shop) => shop.completedOrders > 0)
        .map((shop) => `${shop.shopName} ${shop.completedOrders} 单`)
        .join('、');
      idleWelcomeMessage = `欢迎回来！${details}，营业额 🪙${settled.totalGross} 已逐笔记到账本。`;
    } else {
      const mainSkipped = settled.shops.find((shop) =>
        shop.shopId === 'main' &&
        (shop.skipReason === 'MAIN_STAFF_MISSING' || shop.skipReason === 'MAIN_DUTY_CHAIN_INCOMPLETE')
      );
      if (offlineElapsedSeconds > 60 && mainSkipped) {
        idleWelcomeMessage = '欢迎回来！本店没有完整的照看职责链，这段时间大家只是安静等候，没有消耗原料。';
      }
    }
  };
  settleOpenedWorld();

  // 常客接入顾客生成与点单
  mainRuntime.customerManager.setRegularHooks({
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
          portraitImage: def ? regularPortraitUrl(def.id) : undefined,
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
    viewportContainer.style.setProperty(
      '--minimum-touch-target',
      `${PERFORMANCE_BUDGETS.MIN_TOUCH_TARGET_PX}px`
    );
    viewportContainer.style.setProperty(
      '--touch-target-compensation',
      `${Math.max(1, 1 / scale)}`
    );
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
  await Assets.load([...CORE_PIXI_ASSETS]);

  // 7. Toast & World Overlay Systems
  const toastManager = new ToastManager(uiRoot);
  const worldOverlay = new WorldOverlay(uiRoot);
  const storyModal = new StoryModal(uiRoot);
  const baristaModal = new BaristaModal(uiRoot);
  let playerBaristaOrderId: string | null = null;
  toastManagerRef.current = toastManager;
  storyModalRef.current = storyModal;

  if (idleWelcomeMessage) {
    toastManager.show(idleWelcomeMessage);
  } else if (offlineElapsedSeconds > 60) {
    toastManager.show(`欢迎回来！离线已过 ${offlineHours} 小时。店里一切都安安静静的。`);
  }

  // 8. Build Greybox Scene & Lighting
  const initialPlayerPos = initialSave.world.shops[activeShopId].player;

  let greyboxScene!: GreyboxScene;

  greyboxScene = new GreyboxScene(
    initialPlayerPos,
    {
      onCustomerInteract: (customer) => {
        if (customer.state === 'WAITING_FOR_SEAT') {
          customerManager.setBubble(
            customer,
            '前面有空位我就过去，先在吧台边闻闻咖啡香~',
            CUSTOMER_CONFIG.QUEUE_BUBBLE_DURATION_SECONDS
          );
          return;
        }
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
              toastManager.show('这杯的原料刚好用完了，先去【进货】看看，客人会耐心改点或改天再来~');
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
        catInteractionManager.recordPose(res.pose);
        audioManager.playSfx('purr');
        const gift = catInteractionManager.claimDailyGift(gameClock.getWallClock());
        const giftText = gift
          ? gift.kind === 'gold' ? ` 它还拨来一枚小礼物：🪙+${gift.amount}` : ` 它的睡垫下藏着：🧩+${gift.amount}`
          : '';
        toastManager.show(`🐱【橘猫】${res.text}${giftText}`);
        runAchievementCheck();
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
            if (baristaModal.isOpen()) return;
            if (!orderStateMachine.claimTask(nextOrder.id, 'BREW', 'player')) return;
            baristaModal.open({
              recipeName: nextOrder.recipe.name,
              onStart: () => {
                const started = orderStateMachine.startTask(nextOrder.id, 'BREW', 'player');
                if (!started) return false;
                playerBaristaOrderId = nextOrder.id;
                audioManager.playPreparationSequence();
                toastManager.show(`☕ 开始制作【${nextOrder.recipe.name}】...`);
                return true;
              },
              onCancel: () => {
                orderStateMachine.releaseTask(nextOrder.id, 'BREW', 'player');
              }
            });
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
        const decorSlot = decorManager.getSlots().find((s) => s.sceneObjectId === obj.id);
        if (decorSlot) {
          const next = decorManager.cycleVariant(decorSlot.id);
          if (next) {
            toastManager.show(`🛋️【${decorSlot.name}】换上了【${next.name}】`);
            greyboxScene.refreshDecor();
          }
          runAchievementCheck();
          return;
        }

        toastManager.show(`【${obj.name}】${obj.description}`);
      },

      onPositionChanged: (pos) => {
        saveManager.setShopPlayerPosition(activeShopId, Math.round(pos.x), Math.round(pos.y));
      }
    },
    import.meta.env.DEV && initialSave.settings.debugNavOverlay,
    activeRuntime.scene
  );

  greyboxScene.setCustomerManager(customerManager);
  greyboxScene.setDecorManager(decorManager);
  greyboxScene.setFurnitureState(
    furnitureManager.getTableLevels(activeShopId),
    furnitureManager.getCounterLevel(activeShopId)
  );

  // M3 店员视觉：吧台内侧的小晴（T3.8 批次 F：路人部件 sprite + 米色围裙 tint）
  const staffFigure = new CustomerCharacter(0xd9c39a);
  staffFigure.setPosition(STAFF_CONFIG.WORK_ANCHOR.x, STAFF_CONFIG.WORK_ANCHOR.y - 4);
  staffFigure.container.visible = false;
  greyboxScene.container.addChild(staffFigure.container);

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
        const resetPos = SHOP_SCENES[activeShopId].playerStart;
        greyboxScene.setPlayerPosition(resetPos);
        gameClock.setActivePlayTime(0);
        gameClock.alignWithWallClock();
        syncInventoryToSave();
      }
    },
    audioManager
  );

  const decorModal = new DecorModal(
    uiRoot,
    saveManager,
    ledger,
    decorManager,
    fundManager,
    buildFundMetrics,
    toastManager,
    furnitureManager,
    () => activeShopId
  );
  decorModal.onDecorChanged = () => {
    greyboxScene.refreshDecor();
    applyThemeTint();
  };
  decorModal.onFurnitureChanged = () => {
    const runtime = shopRuntimes[activeShopId];
    greyboxScene.setFurnitureState(
      furnitureManager.getTableLevels(activeShopId),
      furnitureManager.getCounterLevel(activeShopId)
    );
    runtime.customerManager.setSceneOptions({
      tableSeats: furnitureManager.getActiveSeats(activeShopId, runtime.scene.tableSeats),
      queueSpots: runtime.scene.queueSpots,
      spawnPos: runtime.scene.customerSpawn,
      exitPos: runtime.scene.customerExit
    });
  };

  const switchActiveShop = (targetShopId: ShopId) => {
    if (targetShopId === 'seaside' && !saveManager.getState().world.shops.seaside.unlocked) {
      return { ok: false, reason: '海风分店还在地图上慢慢准备中' };
    }
    const check = prepareShopSwitch(
      activeShopId,
      targetShopId,
      orderStateMachine,
      staffMember.isHired()
    );
    if (!check.ok) return check;

    activeShopId = targetShopId;
    activeRuntime = shopRuntimes[activeShopId];
    navGraph = activeRuntime.navGraph;
    orderStateMachine = activeRuntime.orderStateMachine;
    customerManager = activeRuntime.customerManager;
    decorManager = activeRuntime.decorManager;
    greyboxScene.setSceneDefinition(activeRuntime.scene);
    greyboxScene.setCustomerManager(customerManager);
    greyboxScene.setDecorManager(decorManager);
    greyboxScene.setFurnitureState(
      furnitureManager.getTableLevels(activeShopId),
      furnitureManager.getCounterLevel(activeShopId)
    );
    decorModal.setDecorManager(decorManager);
    applyThemeTint();
    saveManager.updateState((draft) => {
      draft.world.activeShopId = activeShopId;
    });
    return check;
  };

  hud.setM3Modals({
    decorModal,
    fundModal: new FundModal(uiRoot, saveManager, ledger, fundManager, buildFundMetrics, toastManager),
    staffModal: new StaffModal(uiRoot, saveManager, staffMember, toastManager),
    handbookModal: new HandbookModal(uiRoot, saveManager, regularManager, decorManager, achievementManager),
    mapModal: new MapModal(
      uiRoot,
      branchManager,
      toastManager,
      () => activeShopId,
      switchActiveShop
    )
  });
  hud.getRecipesModal().setEquipmentManager(equipmentManager);
  hud.getSupplyModal().setFundCapacityProvider(() => fundManager.hasAvailableCapacity(buildFundMetrics()));

  // 10. Pointer Event Routing (T0.2 & T0.5)
  viewportContainer.addEventListener('pointerdown', (e: PointerEvent) => {
    void audioManager.unlock();
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
    void audioManager.unlock();
    if (import.meta.env.DEV && e.key === 'F2') {
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

  const advanceBackgroundShop = (shopId: ShopId, elapsedMs: number): void => {
    if (shopId === activeShopId) return;
    if (shopId === 'seaside' && !saveManager.getState().world.shops.seaside.unlocked) return;
    const savedState = saveManager.getState();
    const duties: readonly StaffDuty[] = shopId === 'main'
      ? savedState.staff.hired
        ? savedState.staff.duties.filter((duty): duty is StaffDuty =>
            (SHOP_SIMULATION_CONFIG.AUTONOMOUS_DUTIES as readonly string[]).includes(duty)
          )
        : []
      : SHOP_SIMULATION_CONFIG.AUTONOMOUS_DUTIES;
    const result = advanceShop(
      simulationStates[shopId],
      elapsedMs,
      { inventory: inventory.getAllAvailable(), grossGold: 0 },
      {
        unlockedRecipeIds: savedState.unlockedRecipes,
        duties,
        brewSpeedMultiplier: equipmentManager.getBrewSpeedMultiplier(),
        customerIntervalMultiplier: getCustomerIntervalMultiplier(
          shopRuntimes[shopId].decorManager.getOwnedVariantCount()
        )
      }
    );
    simulationStates[shopId] = result.state;
    inventory.reconcileAvailableStock(result.economy.inventory);
    for (const event of result.events) {
      if (event.type !== 'ORDER_COMPLETED') continue;
      ledger.settleOrder(event.recipeName, event.gross);
      saveManager.updateState((draft) => {
        draft.recipeMastery[event.recipeId] = (draft.recipeMastery[event.recipeId] ?? 0) + 1;
        draft.stats.completedOrders += 1;
        draft.stats.totalRevenue += event.gross;
      });
      runAchievementCheck();
    }
  };

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

    // 非当前场景仅跑同一店铺推进规则，不创建渲染对象；自动补货不在职责链中。
    advanceBackgroundShop(activeShopId === 'main' ? 'seaside' : 'main', deltaMs);

    // 设备加速系数同步 (T3.2)
    orderStateMachine.brewSpeedMultiplier = equipmentManager.getBrewSpeedMultiplier();

    // M3 店员自动干活
    if (activeShopId === 'main') {
      staffMember.update(deltaSeconds);
    }
    staffFigure.container.visible = activeShopId === 'main' && staffMember.isHired();
    if (activeShopId === 'main' && staffMember.isHired()) {
      staffFigure.update(deltaSeconds, staffMember.isBusy(), 'left');
    }

    // Update order brewing progress
    const finishedBrews = orderStateMachine.tickBrewing(deltaSeconds);
    for (const b of finishedBrews) {
      audioManager.playSfx('cup');
      toastManager.show(`✨【${b.recipe.name}】已萃取完成！请前往吧台取杯送餐。`);
    }
    if (playerBaristaOrderId) {
      const playerOrder = orderStateMachine.getOrder(playerBaristaOrderId);
      if (playerOrder?.state === 'BREWING') {
        baristaModal.updateProgress(playerOrder.brewProgress);
      } else {
        if (playerOrder?.state === 'WAITING_TO_SERVE') baristaModal.complete();
        playerBaristaOrderId = null;
      }
    }

    // Update customers
    const unlockedIds = saveManager.getState().unlockedRecipes;
    customerManager.update(deltaSeconds, unlockedIds);

    // Update scene & lighting
    greyboxScene.update(deltaSeconds);
    if (
      activeShopId === 'main' &&
      catInteractionManager.recordPose(greyboxScene.getCatComponent().getCurrentPose())
    ) {
      runAchievementCheck();
    }
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
        draft.world.shops.main.simulation = structuredClone(simulationStates.main);
        draft.world.shops.seaside.simulation = structuredClone(simulationStates.seaside);
        const settledAt = gameClock.getWallClock();
        draft.world.shops.main.lastSettledAt = Math.max(
          draft.world.shops.main.lastSettledAt,
          settledAt
        );
        draft.world.shops.seaside.lastSettledAt = Math.max(
          draft.world.shops.seaside.lastSettledAt,
          settledAt
        );
      });

      // M3：记录见过的猫睡姿（猫咪图鉴 + 成就）
      const pose = greyboxScene.getCatComponent().getCurrentPose();
      if (activeShopId === 'main' && !saveManager.getState().catPosesSeen.includes(pose)) {
        saveManager.updateState((draft) => {
          draft.catPosesSeen.push(pose);
        });
        runAchievementCheck();
      }

      // 主题色调可能被装修面板切换，周期性刷新覆盖层
      applyThemeTint();
    }
  });

  performance.mark('daily-grind-interactive');
  const interactiveMark = performance.getEntriesByName('daily-grind-interactive').at(-1);
  if (interactiveMark) {
    document.documentElement.dataset.ttiMs = interactiveMark.startTime.toFixed(1);
    const initialTransfers = [
      ...performance.getEntriesByType('navigation'),
      ...performance.getEntriesByType('resource')
    ] as PerformanceResourceTiming[];
    const initialResourceBytes = initialTransfers.reduce(
      (sum, entry) =>
        sum + (entry.encodedBodySize || entry.decodedBodySize || entry.transferSize),
      0
    );
    const fast4gTransferMs =
      (initialResourceBytes / PERFORMANCE_BUDGETS.FAST_4G_SIMULATION.downloadBytesPerSecond) *
      1000;
    document.documentElement.dataset.initialResourceBytes = `${initialResourceBytes}`;
    document.documentElement.dataset.fast4gTtiMs = (
      interactiveMark.startTime +
      PERFORMANCE_BUDGETS.FAST_4G_SIMULATION.roundTripMs +
      fast4gTransferMs
    ).toFixed(1);
  }
  document.documentElement.dataset.appReady = 'true';

  let measuredFrames = 0;
  const fpsStartedAt = performance.now();
  const measureFrameRate = (now: number) => {
    measuredFrames += 1;
    const elapsedMs = now - fpsStartedAt;
    if (elapsedMs >= PERFORMANCE_BUDGETS.FPS_SAMPLE_DURATION_MS) {
      document.documentElement.dataset.fps = (
        (measuredFrames * 1000) /
        elapsedMs
      ).toFixed(1);
      return;
    }
    requestAnimationFrame(measureFrameRate);
  };
  requestAnimationFrame(measureFrameRate);
  console.log('Daily Grind v1 已启动。');
}

bootstrap().catch((err) => {
  console.error('游戏启动失败:', err);
});
