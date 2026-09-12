# Daily Grind（每日研磨）

一款以手绘水彩治愈画风呈现的咖啡馆模拟经营游戏（纯前端 Web，无后端）。

## 环境要求

- **Node.js**: `>= 20.0.0` (推荐 Node 20 / 22 LTS)
- **包管理器**: `npm >= 10.0.0`

## 常用命令

- 启动本地开发服务器：`npm run dev`
- 类型检查：`npm run typecheck`
- 运行自动化测试：`npm test`
- 构建生产产物：`npm run build`
- 预览构建产物：`npm run preview`

## 关联远程仓库（如需手动关联）

若未自动建立远程仓库，可手动执行：

```bash
git remote add origin git@github.com:John-1010-cmd/daily-grind.git
git branch -M main
git push -u origin main
```

## 技术架构 (M0 技术骨架)

- **场景渲染**: PixiJS (HTML5 Canvas WebGL/WebGPU)
- **UI 界面**: 原生 DOM / CSS 覆盖层，事件精确穿透控制
- **存档系统**: localStorage + JSON 导入导出，schema 版本化迁移
- **时钟驱动**: 三时钟模型（在线游玩时长、现实本地时间、离线耗时）
- **测试框架**: Vitest
