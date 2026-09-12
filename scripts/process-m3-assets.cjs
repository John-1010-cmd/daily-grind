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
      .resize({ width: targetWidth, fit: 'inside' })
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

processDrinks().catch((e) => {
  console.error(e);
  process.exit(1);
});
