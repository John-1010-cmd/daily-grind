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

async function main() {
  await processDrinks();
  await processRegulars();
  await processPassenger();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
