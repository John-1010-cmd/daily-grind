# 本店底图伪字清理 v1 — 自评审

- 生成方式：本地 `gpt-image-review` 的 gpt-image-2 垫图编辑，low 草图，`scene-base.webp` 为参考图。
- 构图：6.5 / 10。小黑板已移除，但模型重绘了全景并把宽高比改为 3:2，物件锚点相对原图发生明显位移。
- 色彩：8.5 / 10。暖木色与水彩纸纹理延续良好。
- 主题还原：7.0 / 10。治愈咖啡馆成立，但不满足“只改小黑板、其余保持不变”的生产约束。
- 结论：不入库。M6 灰盒/伪影清理改用精确遮罩或程序合成兜底，避免破坏导航与装修锚点。

## 使用的 prompt

```text
Use case: precise-object-edit. Asset type: production game scene base. Primary request: remove the small secondary chalkboard attached to the front of the counter that contains the malformed text BAAT GRIND, replacing only that board area with matching warm watercolor wooden counter panels and natural grain. Keep the upper DAILY GRIND menu board exactly unchanged. Preserve every other object, composition, perspective, lighting, linework, dimensions, and cozy hand-drawn watercolor style exactly. No new text, no people, no characters, no animals, no watermark.
```
