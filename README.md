# Daily Grind（每日研磨）

一款以手绘水彩治愈画风呈现的咖啡馆模拟经营游戏（纯前端 Web，无后端）。

[在线游玩](https://john-1010-cmd.github.io/daily-grind/) · 当前版本：v1 作品集垂直切片（M0–M6）

## 环境要求

- **Node.js**: `>= 20.0.0` (推荐 Node 20 / 22 LTS)
- **包管理器**: `npm >= 10.0.0`

## 常用命令

- 启动本地开发服务器：`npm run dev`
- 类型检查：`npm run typecheck`
- 运行自动化测试：`npm test`
- 构建生产产物：`npm run build`
- 构建 GitHub Pages 产物：`npm run build:pages`
- 预览构建产物：`npm run preview`

## 关联远程仓库（如需手动关联）

若未自动建立远程仓库，可手动执行：

```bash
git remote add origin git@github.com:John-1010-cmd/daily-grind.git
git branch -M main
git push -u origin main
```

## v1 内容

- 本店与海风分店双场景经营、共享库存、确定性后台推进与 12 小时挂机上限
- 9 种配方、进货、设备升级、装修、5 位常客、1 位店员、梦想基金与成就图鉴
- 四时段水彩光照、夜间灯串、lo-fi BGM、制作音效与橘猫每日互动
- 无失败态、无体力、无强制日结或排名；缺货会平静改点

## 技术架构

- **场景渲染**: PixiJS (HTML5 Canvas WebGL/WebGPU)
- **UI 界面**: 原生 DOM / CSS 覆盖层，事件精确穿透控制
- **存档系统**: localStorage + JSON 导入导出，schema 版本化迁移
- **时钟驱动**: 三时钟模型（在线游玩时长、现实本地时间、离线耗时）
- **测试框架**: Vitest
- **持续交付**: GitHub Actions 全量类型检查、单元测试、性能预算构建与 Pages 发布

验收明细见 [`docs/acceptance/M6-v1-验收记录.md`](docs/acceptance/M6-v1-验收记录.md)，v2 backlog 见设计文档第 17 节。
