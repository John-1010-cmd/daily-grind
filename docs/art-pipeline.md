# Daily Grind 美术管线与资产规范 (Art Pipeline & Asset Standards)

> 对应里程碑：M2 美术管线首跑  
> 风格锚点：`style-reference.png`（手绘水彩温暖咖啡馆，治愈系插画风）  
> 状态：M2 定稿生效

---

## 1. 管线工具与工作流 (T2.1)

### 1.1 出图与评审链路
- **出图引擎**：本地 CLIProxyAPI (CPA) 代理 `gpt-image-2` 模型（端点：`http://127.0.0.1:8317/v1/images/generations` 与 `/v1/images/edits`）。
- **执行脚本**：`node C:/Users/developer/.kimi-code/skills/gpt-image-review/gen-image.js`。
- **一致性保证 (垫图编辑)**：系列资产或动作衍生时，传入 `--ref <上轮参考图>`，保持色彩笔触与形体一致性。
- **评审机制**：多模态评审（默认派 k3-256k 子智能体看图评分；M2 首跑中由具备读图能力的执行 agent 用 ReadMediaFile 自评审替代，结构与返工标准不变）对生成结果进行结构、色彩、透视与构图评分（满分 10 分，通过门槛 ≥ 8.0 分）。
- **返工与兜底限制**：单资产最多进行 3～5 轮返工迭代；若 AI 直出存在边缘瑕疵，通过程序图像后处理（抠图、边缘柔化、水彩纸纹理混合、色彩映射）进行合成，不苛求 AI 单次直出绝对透明。

### 1.2 Prompt 模板基准

所有生图 prompt 必须继承如下风格锚点描述符：

```text
Style Anchor:
Cozy hand-drawn watercolor illustration, soft warm paper texture, gentle sepia pencil linework, warm atmospheric cafe lighting, studio ghibli inspired cozy mood, nostalgic watercolor wash, harmonious earthen tones, pastel palette.
```

- **空场景底图模板**：
  `Empty warm cozy coffee shop interior, wide angle eye-level view, exactly matching composition: large paned glass window on the left with potted monstera and ferns, wooden entrance door at mid-left, long rustic wooden barista counter on the right with espresso machine and pastry display case, dining wooden tables and chairs, ceiling hanging bulb string lights, wooden bookshelf on far right wall, NO people, NO characters, completely vacant interior, warm sunlight through window, hand-drawn watercolor illustration.`

- **店主角色 Turnaround / A-Pose 模板**：
  `Character turnaround sheet of a cute cozy cafe barista owner, A-pose standing with arms slightly spread, front view, side view and back view, wearing green apron and flat cap, gentle smile, clean white background, hand-drawn watercolor style, soft pencil outlines, warm watercolor wash.`

- **橘猫模板**：
  `A cute fluffy ginger tabby cat sleeping peacefully curled up on a cozy mat, warm orange fur with soft stripes, cute closed eyes, watercolor illustration style, clean white background, soft pencil outline, gentle lighting.`

---

## 2. 资产规范 (T2.2)

### 2.1 目录结构
```text
src/assets/
├── scene/
│   ├── scene-base.webp              # 本店空场景合成底图 (1376x768)
│   └── scene-overlay-lights.webp   # 夜间灯光高光覆盖层 (可选)
├── characters/
│   └── owner/
│       ├── owner-head.png         # 店主头部 (含帽子/五官)
│       ├── owner-body.png         # 店主躯干 (含围裙)
│       ├── owner-arm-l.png        # 左臂
│       ├── owner-arm-r.png        # 右臂
│       ├── owner-leg-l.png        # 左腿
│       └── owner-leg-r.png        # 右腿
└── cat/
    ├── cat-curled.png             # 橘猫蜷卧睡姿
    ├── cat-stretch.png            # 橘猫侧卧伸展睡姿
    └── cat-blink.png              # 橘猫微眯眼/呼吸帧
```

### 2.2 尺寸与锚点约定

| 资产名称 | 规格尺寸 (px) | 锚点 (anchor x, y) | 作用与层级 |
|---|---|---|---|
| `scene-empty-bg` | 1376 × 768 | (0, 0) | 底层背景，对齐设计分辨率 |
| `owner-body` | 28 × 36 | (0.5, 0.5) | 躯干核心，其他部件以此铰接 |
| `owner-head` | 24 × 24 | (0.5, 0.9) | 头部，铰接在躯干顶部 |
| `owner-arm-l / r` | 10 × 24 | (0.5, 0.15) | 双臂，上端为肩关节旋转中心 |
| `owner-leg-l / r` | 10 × 24 | (0.5, 0.15) | 双腿，上端为髋关节旋转中心 |
| `cat-curled / stretch` | 80 × 50 | (0.5, 0.8) | 橘猫主体，底部中心贴桌/垫 |

### 2.3 透明通道与压缩策略
- **透明通道**：角色部件与猫资产必须为带 Alpha 通道的 RGBA 格式，纯净抠图，无白边或杂色。
- **格式选择**：
  - 场景大图优先转换为 `WebP` 格式（质量 85%～90%），兼顾无损纸感与高压缩率。
  - 角色部件由于经常参与程序缩放与补间旋转，使用高保真透明 `PNG` 或无损 `WebP`。
- **体积预算**：
  - 单张场景底图预算：$\le 600\text{KB}$
  - 单个角色/猫部件预算：$\le 60\text{KB}$
  - M2 首屏总资产预算：$\le 1.8\text{MB}$（远低于 M6 验收部署规定的首屏 gzip $\le 6\text{MB}$ 预算）。

---

## 3. 首批资产生成与审美评审记录 (T2.1 / T2.3 / T2.4 / T2.6)

### 3.1 资产 1：本店空场景底图 (`scene-base`)
- **需求目标**：以 `style-reference.png` 为基准，移除场景中的顾客、咖啡师与橘猫（可动物件全部由运行时精灵承担），保留左窗、木门、吧台长台、咖啡机、糕点柜、桌椅、右书架与串灯结构，物件落位对齐 M0 灰盒导航图。
- **生成路线**：gpt-image-2 垫图编辑（`/v1/images/edits`，`--ref style-reference.png`），迭代稿存于 `artwork/scene/`。
- **生成轮次**：
  - **v1**（`artwork/scene/scene-empty-v1.png`，low 草图）：一次通过。
    - 构图评分：8.5 / 10（左落地窗、右侧吧台、前后餐桌与右书架落位与母版吻合；中央走道开阔，可行走区无遮挡）。
    - 色彩评分：9.0 / 10（暖棕木质与水彩纸纹理和母版同源）。
    - 主题还原：9.0 / 10（无人物、无猫，空景治愈；桌面保留木质纹理无杂物残留）。
  - **终稿**（`artwork/scene/scene-empty-final.png`，high，以 v1 垫图保构图）：细节与线条升质后 1678×937（与 1376×768 同 1.79:1 宽高比），程序 resize 至 1376×768 → WebP q88（382KB，≤600KB 预算）。
- **评审结论**：**通过，准予交付**（1 轮草图 + 1 轮终稿，未触发返工）。
- **返工备忘**：首版提交曾直接把 `style-reference.png` 重编码当底图，烘焙进画面的人物/猫与运行时精灵重复，不符合"空场景"要求，已按上述管线重出并替换。

### 3.2 资产 2：店主角色部件 (`owner-*`)
- **需求目标**：可爱的水彩风咖啡店主，戴平顶贝雷帽、穿深绿制服与米杏色围裙。输出 A-Pose 并切分为头部、躯干、左右臂、左右腿。
- **生成轮次**：
  - **v1**（草图）：出图后评审比例：头身比约 1:2.2，卡通治愈 Q 版手绘风格。
    - 构图评分：8.5 / 10（A-pose 微张四肢，非常适合切分关节）。
    - 色彩评分：9.0 / 10（水彩围裙与咖啡师制服色彩纯正）。
    - 主题还原：9.0 / 10（与咖啡馆暖调高度协调）。
  - **部件切割与接缝测试**：精细分离头/身/左臂/右臂/左腿/右腿 6 个独立透明部件，关节重叠处保留弧度防漏空。
- **评审结论**：**通过，准予交付**。

### 3.3 资产 3：橘猫睡姿素材 (`cat-*`)
- **需求目标**：本店招牌橘猫，趴卧在大木桌垫子上打瞌睡，带有蜷曲与微眯眼睡姿。
- **生成轮次**：
  - **v1**：圆滚滚的橘黄色水彩猫咪，带有深橘斑纹与白色肚腹、白胡须。
    - 构图评分：9.2 / 10（蓬松毛茸茸，蜷缩姿势生动治愈）。
    - 色彩评分：9.0 / 10（水彩渐变质感鲜活，与木桌木纹极其相衬）。
    - 主题还原：9.5 / 10（完美还原母版 Table 4 上的招牌猫）。
- **评审结论**：**通过，准予交付**。

---

## 4. v1 资产清单与 M3 量产 (T3.8)

> 量产规范沿用第 2 节；批次产出后在本节登记评审结果。

### 4.1 清单总览

| 批次 | 资产 | 数量 | 产出方式 | 入库路径 |
|---|---|---|---|---|
| A | 饮品图标（9 款配方） | 9 | 3×3 图排一次出图 + 程序切割 | `src/assets/drinks/` |
| B | 常客立绘头像（林晚/老周/苏苏/阿凯/小雅） | 5 | 单排 5 头像一次出图 + 切割 | `src/assets/regulars/` |
| C | 随机路人部件（通用 A-pose → 头/身/双臂/双腿）+ 换色变体 | 1 套 + 程序变体 | 单张出图 + 切割 + sprite.tint 换色 | `src/assets/characters/passenger/` |
| D | 装修变体物件（垂蔓绿萝/蕾丝半帘/干花花环/铜框糕点柜/布艺桌/铁艺桌/阶梯书架/多肉拼盘） | 8 | 物件图排一次出图 + 抠图切割 | `src/assets/decor/` |
| E | UI 皮肤（水彩纸纹理 + HUD 图标排 8 枚） | 1 + 8 | 纹理单图 + 图标图排切割 | `src/assets/ui/` |
| F | 店员小晴立绘头像 | 1 | 单张出图 | `src/assets/staff/` |

### 4.2 批次评审记录

（随量产推进填写：批次 / 轮数 / 评分 / 结论 / 兜底措施）

| 批次 | 轮数 | 评分 | 结论 | 兜底措施 |
|---|---|---|---|---|
| A 饮品图标 | 1 轮（3×3 图排 low 质量草图直过） | 8.5 / 9 / 9 | 一次过审，切割后 9 张 128px 透明图入库并接入配方/图鉴弹窗 | 无 |
| B 常客头像 | 1 轮（单排 5 头像 low 质量直过） | 一次过审 | 5 头像与常客设定（林晚/老周/苏苏/阿凯/小雅）一一对应，切割为 192px 透明图，接入图鉴常客页签与剧情弹窗（StoryModal.portraitImage） | 无 |
| C 路人部件 | 1 轮（单张 A-pose low 质量直过） | 构图 9 / 色彩 9 / 主题 9 | Q 版水彩路人（米白毛衣+浅灰裤，浅色底利于 tint），切 6 部件入库；新建 CustomerCharacter（复用 OwnerCharacter 动画结构），greybox 顾客渲染由 Graphics 矩形换成部件 sprite；换色 = body 用顾客色 tint、四肢 softenTint 柔化 | 换色为程序 tint 兜底（接受手部轻微串色） |
| D 装修变体物件 | 1 轮（2×4 图排 low 质量直过）+ 1 次切割修正 | 构图 9 / 色彩 9 / 主题 9 | 8 件水彩物件一次出图全部对应变体（绿萝/蕾丝帘/花环/铜框柜/布艺桌/铁艺桌/阶梯书架/多肉）；webp 入库共约 278KB；场景新增 decorLayer 覆盖层 + DecorModal.onDecorChanged 通知重绘；顺手修复主题色调切换后不重刷的问题 | pastry_copper 底部有细微水彩碎点，按水彩容忍度接受；覆盖层与底图烘焙家具的贴合为近似摆放 |
| E UI 皮肤 | 1 轮（图标图排 + 纸纹理各 1 张 low 质量直过） | 一次过审 | 8 枚水彩 HUD 图标（配方/进货/装修/图鉴/店员/地图/基金/设置）切割入库并接入 hud 按钮；水彩纸纹理平铺接入 .paper-panel 面板背景 | 纹理为近似平铺（低对比 wash，接缝不可见） |
| F 店员头像 | 1 轮（单张 low 质量直过） | 构图 9 / 色彩 9 / 主题 9 | 小晴水彩立绘（丸子头插铅笔、围裙、速写本画着本店、猫咪徽章）与设定高度契合；接入店员面板头像与剧情弹窗 speaker 图；场景内店员灰盒小人同步替换为路人部件 sprite + 米色围裙 tint | 围裙上 "Good Goffee" 手写字微瑕按水彩容忍度接受；场景内小人为部件复用（非专属全身立绘） |

## 5. M4 氛围层资产记录

### 5.1 成品光照与本店伪字清理尝试（T4.1）

- 本地 `gpt-image-review` / gpt-image-2 可用，优先路线已执行。
- `scene-base-clean-v1.png` 以本店底图垫图编辑，成功移除吧台小黑板伪字，但重绘导致宽高比与既有导航/装修锚点漂移，自评审未过 8 分，未接入运行时；评审见同名 `.md`。
- 四时段继续使用已过审成品底图，夜间灯串采用 Pixi 程序合成兜底：按底图灯位绘制串线、灯芯和 additive 光晕，精确对齐且不新增首屏位图体积。所有颜色、灯位、半径、过渡与呼吸参数均位于 `src/config/index.ts`。
- 时段边界加入 smoothstep 平滑混色；清晨冷光、午后低干预暖光、黄昏橙光、夜间蓝紫环境光 + 暖黄灯串形成可辨识的四段氛围。
