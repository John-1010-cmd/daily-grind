const sharp = require('sharp');
const path = require('path');

// M3 量产切割脚本：图排 → 透明单件（沿用 M2 的白底抠图策略）

async function removeWhiteBackground(inputBuffer) {
  const image = sharp(inputBuffer);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    const brightness = (r + g + b) / 3;

    let a = 255;
    if (r > 242 && g > 242 && b > 242) {
      a = 0;
    } else if (r > 225 && g > 225 && b > 225) {
      a = Math.round(((242 - brightness) / 17) * 255);
      a = Math.max(0, Math.min(255, a));
    }

    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function cutCells(sheetPath, cells, outDir, targetWidth) {
  for (const cell of cells) {
    const extracted = await sharp(sheetPath)
      .extract(cell.region)
      .png()
      .toBuffer();
    const transparent = await removeWhiteBackground(extracted);
    await sharp(transparent)
      .trim()
      .resize({ width: cell.width || targetWidth, fit: 'inside' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, cell.name));
    console.log(`✓ ${cell.name}`);
  }
}

async function processDrinks() {
  console.log('=== A. Drinks sheet -> src/assets/drinks ===');
  // sheet 1254x1254, 3x3，按实际排布划格（trim 自动收边）
  const R = [
    { top: 25, height: 351 },
    { top: 401, height: 389 },
    { top: 802, height: 402 }
  ];
  const C = [
    { left: 12, width: 389 },
    { left: 414, width: 439 },
    { left: 853, width: 401 }
  ];
  const ids = [
    ['espresso', 'americano', 'latte'],
    ['cappuccino', 'jasmine_tea', 'matcha_latte'],
    ['peach_oolong', 'croissant', 'tiramisu']
  ];
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push({
        name: `${ids[r][c]}.png`,
        region: { left: C[c].left, top: R[r].top, width: C[c].width, height: R[r].height }
      });
    }
  }
  await cutCells('artwork/m3/drinks-sheet-v1.png', cells, 'src/assets/drinks', 128);
}

async function processRegulars() {
  console.log('=== B. Regulars sheet -> src/assets/regulars ===');
  // sheet 2172x724，单排 5 头像
  const ids = ['regular_linwan', 'regular_laozhou', 'regular_susu', 'regular_akai', 'regular_xiaoya'];
  const bounds = [
    { left: 22, width: 412 },
    { left: 456, width: 435 },
    { left: 901, width: 413 },
    { left: 1325, width: 423 },
    { left: 1759, width: 413 }
  ];
  const cells = ids.map((id, i) => ({
    name: `${id}.png`,
    region: { left: bounds[i].left, top: 43, width: bounds[i].width, height: 674 }
  }));
  await cutCells('artwork/m3/regulars-sheet-v1.png', cells, 'src/assets/regulars', 192);
}

async function processPassenger() {
  console.log('=== C. Passenger A-pose -> src/assets/characters/passenger ===');
  // passenger-raw 1024x1536，单角色 A-pose，按关节切 6 部件（尺寸对齐 owner 部件）
  const parts = [
    { name: 'passenger-head.png', region: { left: 253, top: 0, width: 383, height: 460 }, width: 44 },
    { name: 'passenger-body.png', region: { left: 353, top: 438, width: 322, height: 468 }, width: 42 },
    { name: 'passenger-arm-l.png', region: { left: 138, top: 492, width: 238, height: 415 }, width: 24 },
    { name: 'passenger-arm-r.png', region: { left: 652, top: 492, width: 238, height: 415 }, width: 24 },
    { name: 'passenger-leg-l.png', region: { left: 353, top: 860, width: 184, height: 614 }, width: 22 },
    { name: 'passenger-leg-r.png', region: { left: 499, top: 860, width: 184, height: 614 }, width: 22 }
  ];
  await cutCells('artwork/m3/passenger-raw.png', parts, 'src/assets/characters/passenger', 44);
}

async function processDecor() {
  console.log('=== D. Decor sheet -> src/assets/decor ===');
  // decor-sheet 1536x1024，2 行 4 列物件图排，按实际边界逐件切（trim 自动收边）
  const items = [
    { name: 'plant_pothos', region: { left: 23, top: 0, width: 308, height: 507 } },
    { name: 'door_lace', region: { left: 384, top: 31, width: 323, height: 484 } },
    { name: 'door_wreath', region: { left: 760, top: 69, width: 361, height: 407 } },
    { name: 'pastry_copper', region: { left: 1129, top: 84, width: 399, height: 392 } },
    { name: 'table_cloth', region: { left: 8, top: 545, width: 368, height: 438 } },
    { name: 'table_iron', region: { left: 399, top: 545, width: 338, height: 438 } },
    { name: 'shelf_ladder', region: { left: 791, top: 492, width: 320, height: 507 } },
    { name: 'plant_succulent', region: { left: 1121, top: 584, width: 407, height: 338 } }
  ];
  // 装修件细节多，webp 显著省体积
  for (const item of items) {
    const extracted = await sharp('artwork/m3/decor-sheet-v1.png')
      .extract(item.region)
      .png()
      .toBuffer();
    const transparent = await removeWhiteBackground(extracted);
    await sharp(transparent)
      .trim()
      .resize({ width: 256, fit: 'inside' })
      .webp({ quality: 85 })
      .toFile(path.join('src/assets/decor', `${item.name}.webp`));
    console.log(`✓ ${item.name}.webp`);
  }
}

async function processUi() {
  console.log('=== E. HUD icons sheet + paper texture -> src/assets/ui ===');
  // hud-icons-sheet 1536x1024，2 行 4 列，对应 TOP_NAV_BUTTONS 顺序（map 为 M5 预留）
  const icons = [
    { name: 'icon_recipes.png', region: { left: 23, top: 108, width: 392, height: 338 } },
    { name: 'icon_supply.png', region: { left: 438, top: 92, width: 284, height: 353 } },
    { name: 'icon_decor.png', region: { left: 799, top: 92, width: 338, height: 353 } },
    { name: 'icon_handbook.png', region: { left: 1213, top: 84, width: 284, height: 376 } },
    { name: 'icon_staff.png', region: { left: 31, top: 507, width: 283, height: 445 } },
    { name: 'icon_map.png', region: { left: 384, top: 568, width: 415, height: 338 } },
    { name: 'icon_fund.png', region: { left: 837, top: 530, width: 276, height: 392 } },
    { name: 'icon_settings.png', region: { left: 1180, top: 538, width: 310, height: 322 } }
  ];
  await cutCells('artwork/m3/hud-icons-sheet-v1.png', icons, 'src/assets/ui', 96);

  // 水彩纸纹理：缩到 768 宽平铺用
  await sharp('artwork/m3/paper-texture-v1.png')
    .resize({ width: 768, fit: 'inside' })
    .webp({ quality: 80 })
    .toFile('src/assets/ui/paper-texture.webp');
  console.log('✓ paper-texture.webp');
}

async function processStaff() {
  console.log('=== F. Staff avatar -> src/assets/staff ===');
  const raw = await sharp('artwork/m3/staff-xiaoqing-v1.png').png().toBuffer();
  const transparent = await removeWhiteBackground(raw);
  await sharp(transparent)
    .trim()
    .resize({ width: 192, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile('src/assets/staff/staff_xiaoqing.png');
  console.log('✓ staff_xiaoqing.png');
}

async function main() {
  await processDrinks();
  await processRegulars();
  await processPassenger();
  await processDecor();
  await processUi();
  await processStaff();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
