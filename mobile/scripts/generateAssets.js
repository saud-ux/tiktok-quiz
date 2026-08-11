const fs = require('fs');
const path = require('path');

function createPNG(width, height, bgR, bgG, bgB) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rawData = Buffer.alloc(height * (1 + width * 3));
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.35;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    rawData[rowStart] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 3;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < r) {
        // Green circle with "?" pattern
        const angle = Math.atan2(dy, dx);
        const normDist = dist / r;
        const bright = 0.6 + 0.4 * (1 - normDist);
        rawData[idx] = Math.round(74 * bright);     // R
        rawData[idx + 1] = Math.round(222 * bright); // G
        rawData[idx + 2] = Math.round(128 * bright);  // B
      } else {
        rawData[idx] = bgR;
        rawData[idx + 1] = bgG;
        rawData[idx + 2] = bgB;
      }
    }
  }

  // Simple zlib wrapper (uncompressed deflate blocks)
  const maxBlock = 65535;
  const blocks = [];
  let offset = 0;
  while (offset < rawData.length) {
    const blockLen = Math.min(maxBlock, rawData.length - offset);
    const isFinal = (offset + blockLen >= rawData.length) ? 1 : 0;
    const header = Buffer.alloc(5);
    header[0] = isFinal;
    header.writeUInt16LE(blockLen, 1);
    header.writeUInt16LE(blockLen ^ 0xFFFF, 3);
    blocks.push(header);
    blocks.push(rawData.slice(offset, offset + blockLen));
    offset += blockLen;
  }

  // Adler32 checksum
  let s1 = 1, s2 = 0;
  for (let i = 0; i < rawData.length; i++) {
    s1 = (s1 + rawData[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE((s2 << 16) | s1);

  const zlibHeader = Buffer.from([0x78, 0x01]);
  const deflated = Buffer.concat([zlibHeader, ...blocks, adler]);

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// icon.png (1024x1024) - dark green bg with green circle
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createPNG(1024, 1024, 5, 14, 5));

// adaptive-icon.png (1024x1024)
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), createPNG(1024, 1024, 5, 14, 5));

// favicon.png (48x48)
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), createPNG(48, 48, 5, 14, 5));

console.log('Assets generated in', assetsDir);
