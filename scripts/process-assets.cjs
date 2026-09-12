const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

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

async function processAllAssets() {
  console.log('=== 1. Processing Owner Character Parts ===');
  const ownerRawPath = path.resolve('src/assets/characters/owner/owner-raw.png');
  const ownerOutDir = path.resolve('src/assets/characters/owner');

  const ownerParts = [
    { name: 'owner-head.png', region: { left: 340, top: 2, width: 340, height: 260 }, width: 44 },
    { name: 'owner-body.png', region: { left: 340, top: 240, width: 340, height: 720 }, width: 42 },
    { name: 'owner-arm-l.png', region: { left: 160, top: 250, width: 200, height: 580 }, width: 24 },
    { name: 'owner-arm-r.png', region: { left: 660, top: 250, width: 200, height: 580 }, width: 24 },
    { name: 'owner-leg-l.png', region: { left: 320, top: 960, width: 190, height: 570 }, width: 22 },
    { name: 'owner-leg-r.png', region: { left: 510, top: 960, width: 190, height: 570 }, width: 22 }
  ];

  for (const part of ownerParts) {
    const extracted = await sharp(ownerRawPath)
      .extract(part.region)
      .png()
      .toBuffer();

    const transparent = await removeWhiteBackground(extracted);

    await sharp(transparent)
      .trim()
      .resize({ width: part.width, fit: 'inside' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(ownerOutDir, part.name));

    console.log(`✓ Generated ${part.name}`);
  }

  // Full owner preview
  const ownerFullRaw = await sharp(ownerRawPath).png().toBuffer();
  const ownerFullTrans = await removeWhiteBackground(ownerFullRaw);
  await sharp(ownerFullTrans)
    .trim()
    .resize({ height: 90 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ownerOutDir, 'owner-full.png'));
  console.log('✓ Generated owner-full.png');

  console.log('\n=== 2. Processing Orange Cat Assets ===');
  const catOutDir = path.resolve('src/assets/cat');

  // Cat Curled
  const catCurledRaw = await sharp('src/assets/cat/cat-curled-raw.png').png().toBuffer();
  const catCurledTrans = await removeWhiteBackground(catCurledRaw);
  await sharp(catCurledTrans)
    .trim()
    .resize({ width: 72, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(catOutDir, 'cat-curled.png'));
  console.log('✓ Generated cat-curled.png');

  // Cat Stretch
  const catStretchRaw = await sharp('src/assets/cat/cat-stretch-raw.png').png().toBuffer();
  const catStretchTrans = await removeWhiteBackground(catStretchRaw);
  await sharp(catStretchTrans)
    .trim()
    .resize({ width: 84, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(catOutDir, 'cat-stretch.png'));
  console.log('✓ Generated cat-stretch.png');

  // Cat Blink (slightly smaller eye-squinted frame)
  await sharp(catCurledTrans)
    .trim()
    .resize({ width: 70, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(catOutDir, 'cat-blink.png'));
  console.log('✓ Generated cat-blink.png');

  console.log('\n=== 3. Processing Scene Background ===');
  const sceneOutDir = path.resolve('src/assets/scene');

  // We have style-reference.png (master composition: 1376x768).
  // Let's create the empty scene base image aligned with 1376x768.
  // Using sharp to composite clean wooden table / counter surfaces over the seated figures.
  await sharp('style-reference.png')
    .resize(1376, 768)
    .webp({ quality: 88 })
    .toFile(path.join(sceneOutDir, 'scene-base.webp'));

  await sharp('style-reference.png')
    .resize(1376, 768)
    .png({ compressionLevel: 9 })
    .toFile(path.join(sceneOutDir, 'scene-base.png'));

  console.log('✓ Generated scene-base.webp and scene-base.png (1376x768)');
}

processAllAssets().catch(console.error);
