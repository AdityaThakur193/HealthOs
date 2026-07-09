const sharp = require('sharp');
const path = require('path');

async function createBadge() {
  const input = path.join(__dirname, 'public', 'logo.png');
  const output = path.join(__dirname, 'public', 'logo-badge.png');

  // Get image metadata first
  const meta = await sharp(input).metadata();
  console.log('Input size:', meta.width, 'x', meta.height);

  // Convert to white monochrome on transparent bg at 96x96
  // 1. Resize to 96x96
  // 2. Greyscale + threshold to get a crisp silhouette
  // 3. Make it white via linear (negate then composite on transparent)
  await sharp(input)
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .greyscale()
    .threshold(100) // pixels darker than 100 become 0, lighter become 255
    .negate({ alpha: false }) // invert: dark logo becomes white
    .toColourspace('b-w')
    .png()
    .toFile(output + '.tmp.png');

  // Now composite it as white pixels on transparent background
  const tmp = await sharp(output + '.tmp.png').metadata();
  console.log('Temp size:', tmp.width, 'x', tmp.height);

  // Use flatten approach — convert to RGBA where white = opaque white, black = transparent
  const raw = await sharp(output + '.tmp.png')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = raw;
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i++) {
    const brightness = data[i]; // greyscale value 0-255
    rgba[i * 4 + 0] = 255; // R white
    rgba[i * 4 + 1] = 255; // G white
    rgba[i * 4 + 2] = 255; // B white
    rgba[i * 4 + 3] = brightness; // Alpha based on brightness (white areas = opaque, black areas = transparent)
  }

  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
  .png()
  .toFile(output);

  // Cleanup tmp
  require('fs').unlinkSync(output + '.tmp.png');
  console.log('✅ Badge created:', output, '(white-on-transparent, 96x96)');
}

createBadge().catch(console.error);
