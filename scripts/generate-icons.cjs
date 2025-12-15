const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const SVG_PATH = path.join(BUILD_DIR, 'icon.svg');
const ICONS_DIR = path.join(BUILD_DIR, 'icons');

// Sizes needed for different platforms
const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];

async function generateIcons() {
  console.log('Generating icons from SVG...');

  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Read SVG
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Generate PNGs for each size
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created ${size}x${size}.png`);
  }

  // Copy 512x512 as main icon.png
  fs.copyFileSync(
    path.join(ICONS_DIR, '512x512.png'),
    path.join(BUILD_DIR, 'icon.png')
  );
  console.log('  Created icon.png (512x512)');

  // Generate .icns for macOS using iconutil
  if (process.platform === 'darwin') {
    console.log('\nGenerating macOS .icns...');
    const iconsetPath = path.join(BUILD_DIR, 'icon.iconset');

    if (!fs.existsSync(iconsetPath)) {
      fs.mkdirSync(iconsetPath);
    }

    // Copy and rename files for iconset
    const iconsetSizes = [
      { size: 16, scale: 1, name: 'icon_16x16.png' },
      { size: 32, scale: 2, name: 'icon_16x16@2x.png' },
      { size: 32, scale: 1, name: 'icon_32x32.png' },
      { size: 64, scale: 2, name: 'icon_32x32@2x.png' },
      { size: 128, scale: 1, name: 'icon_128x128.png' },
      { size: 256, scale: 2, name: 'icon_128x128@2x.png' },
      { size: 256, scale: 1, name: 'icon_256x256.png' },
      { size: 512, scale: 2, name: 'icon_256x256@2x.png' },
      { size: 512, scale: 1, name: 'icon_512x512.png' },
      { size: 1024, scale: 2, name: 'icon_512x512@2x.png' },
    ];

    for (const { size, name } of iconsetSizes) {
      fs.copyFileSync(
        path.join(ICONS_DIR, `${size}x${size}.png`),
        path.join(iconsetPath, name)
      );
    }

    // Run iconutil
    try {
      execSync(`iconutil -c icns "${iconsetPath}" -o "${path.join(BUILD_DIR, 'icon.icns')}"`);
      console.log('  Created icon.icns');

      // Clean up iconset
      fs.rmSync(iconsetPath, { recursive: true });
    } catch (err) {
      console.error('  Failed to create .icns:', err.message);
    }
  }

  // Generate .ico for Windows
  console.log('\nGenerating Windows .ico...');
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoBuffers = [];

  for (const size of icoSizes) {
    const buffer = await sharp(path.join(ICONS_DIR, `${size}x${size}.png`))
      .toBuffer();
    icoBuffers.push({ size, buffer });
  }

  // Create ICO file manually (simple format)
  const icoPath = path.join(BUILD_DIR, 'icon.ico');
  await createIco(icoBuffers, icoPath);
  console.log('  Created icon.ico');

  console.log('\nDone! Icons generated in build/');
}

async function createIco(images, outputPath) {
  // ICO file format: header + directory entries + image data
  const numImages = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;

  let dataOffset = headerSize + dirSize;
  const entries = [];
  const imageDataBuffers = [];

  for (const { size, buffer } of images) {
    // Convert PNG to raw RGBA for ICO
    const { data, info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create BMP-style DIB header + pixel data
    const bmpInfoHeaderSize = 40;
    const rowSize = Math.ceil((size * 32) / 32) * 4;
    const pixelDataSize = rowSize * size * 2; // *2 for XOR and AND masks
    const dibSize = bmpInfoHeaderSize + info.width * info.height * 4 + Math.ceil(info.width / 8) * info.height;

    // For simplicity, we'll just embed the PNG directly (modern ICO supports this)
    entries.push({
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      size: buffer.length,
      offset: dataOffset,
    });

    imageDataBuffers.push(buffer);
    dataOffset += buffer.length;
  }

  // Build the ICO file
  const totalSize = dataOffset;
  const icoBuffer = Buffer.alloc(totalSize);
  let pos = 0;

  // ICO Header
  icoBuffer.writeUInt16LE(0, pos); pos += 2; // Reserved
  icoBuffer.writeUInt16LE(1, pos); pos += 2; // Type (1 = ICO)
  icoBuffer.writeUInt16LE(numImages, pos); pos += 2; // Number of images

  // Directory entries
  for (const entry of entries) {
    icoBuffer.writeUInt8(entry.width, pos); pos += 1;
    icoBuffer.writeUInt8(entry.height, pos); pos += 1;
    icoBuffer.writeUInt8(entry.colorCount, pos); pos += 1;
    icoBuffer.writeUInt8(entry.reserved, pos); pos += 1;
    icoBuffer.writeUInt16LE(entry.planes, pos); pos += 2;
    icoBuffer.writeUInt16LE(entry.bitCount, pos); pos += 2;
    icoBuffer.writeUInt32LE(entry.size, pos); pos += 4;
    icoBuffer.writeUInt32LE(entry.offset, pos); pos += 4;
  }

  // Image data (PNGs)
  for (const imgBuffer of imageDataBuffers) {
    imgBuffer.copy(icoBuffer, pos);
    pos += imgBuffer.length;
  }

  fs.writeFileSync(outputPath, icoBuffer);
}

generateIcons().catch(console.error);
