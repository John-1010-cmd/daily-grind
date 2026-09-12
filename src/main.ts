import { Application } from 'pixi.js';
import { GameClock } from './clock';
import {
  PLAYER_CONFIG,
  SCREEN_CONFIG
} from './config';
import { SaveManager } from './save';
import { GreyboxScene } from './scene/greybox';
import { LightingSystem } from './scene/lighting';
import { Hud, ToastManager } from './ui';

async function bootstrap() {
  // 1. Storage & Save Manager
  const saveManager = new SaveManager();
  saveManager.setupLifecycleHooks(window);

  const initialSave = saveManager.getState();

  // 2. Three-clock System
  const gameClock = new GameClock(initialSave.activePlayTime);
  gameClock.alignWithWallClock();

  // Calculate offline elapsed time since last save
  const offlineElapsedSeconds = gameClock.getOfflineElapsed(initialSave.lastSavedAt);
  const offlineHours = (offlineElapsedSeconds / 3600).toFixed(1);

  // 3. Setup Letterbox Viewport Scaling
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

  // 4. Initialize PixiJS Application
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

  // 5. Toast System
  const toastManager = new ToastManager(uiRoot);

  if (offlineElapsedSeconds > 60) {
    toastManager.show(`欢迎回来！离线已过 ${offlineHours} 小时（分店挂机将在 M5 结算）`);
  }

  // 6. Build Greybox Scene & Lighting
  const initialPlayerPos = initialSave.player && Number.isFinite(initialSave.player.x)
    ? initialSave.player
    : { x: PLAYER_CONFIG.INITIAL_X, y: PLAYER_CONFIG.INITIAL_Y };

  const greyboxScene = new GreyboxScene(
    initialPlayerPos,
    {
      onObjectInteract: (obj) => {
        toastManager.show(`【${obj.name}】${obj.description}`);
      },
      onPositionChanged: (pos) => {
        saveManager.setPlayerPosition(Math.round(pos.x), Math.round(pos.y));
      }
    },
    initialSave.settings.debugNavOverlay
  );

  const lightingSystem = new LightingSystem(gameClock);

  app.stage.addChild(greyboxScene.container);
  app.stage.addChild(lightingSystem.getDisplayObject());

  // 7. Setup HUD & UI
  const hud = new Hud(
    uiRoot,
    saveManager,
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
      }
    }
  );

  // 8. Event Routing for Pointer Input (T0.2 & T0.5)
  // Viewport container pointer handler translates DOM coordinates into 1376x768 design space
  viewportContainer.addEventListener('pointerdown', (e: PointerEvent) => {
    // If the click hit an interactive DOM element, do not dispatch to Pixi scene
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

  // Keyboard controls (WASD & F2 debug toggle)
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

  // 9. Main Game Loop
  let lastTime = performance.now();
  let saveSyncTimer = 0;

  // Handle visibility changes for activePlayTime clock suspension (T0.6)
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

    const deltaSeconds = Math.min(deltaMs / 1000, 0.1); // Clamp to prevent spiral

    // Tick clocks
    gameClock.tick(deltaMs);

    // Update scene & lighting
    greyboxScene.update(deltaSeconds);
    const currentPeriod = lightingSystem.update(deltaSeconds);
    hud.updatePeriod(currentPeriod);

    // Periodically update activePlayTime in save state
    saveSyncTimer += deltaSeconds;
    if (saveSyncTimer >= 1.0) {
      saveSyncTimer = 0;
      saveManager.setActivePlayTime(gameClock.getActivePlayTime());
    }
  });

  console.log('Daily Grind M0 技术骨架已成功启动。');
}

bootstrap().catch((err) => {
  console.error('游戏启动失败:', err);
});
