import fs from 'fs';

export interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'LANDSCAPE' | 'SQUARE' | 'PORTRAIT';
}

export function getImageMetadata(filePath: string): ImageMetadata | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const buffer = fs.readFileSync(filePath);
    let width = 0;
    let height = 0;

    // 1. PNG Header Parsing
    if (
      buffer.length >= 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    }
    // 2. JPEG Header Parsing
    else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];

        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
        if (
          marker === 0xc0 ||
          marker === 0xc1 ||
          marker === 0xc2 ||
          marker === 0xc3 ||
          marker === 0xc5 ||
          marker === 0xc6 ||
          marker === 0xc7
        ) {
          height = buffer.readUInt16BE(offset + 5);
          width = buffer.readUInt16BE(offset + 7);
          break;
        }

        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
    // 3. WebP Header Parsing
    else if (
      buffer.length >= 30 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const format = buffer.toString('ascii', 12, 16);
      if (format === 'VP8 ') {
        width = buffer.readUInt16LE(26) & 0x3fff;
        height = buffer.readUInt16LE(28) & 0x3fff;
      } else if (format === 'VP8L') {
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        width = 1 + (((b1 & 0x3f) << 8) | b0);
        height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      } else if (format === 'VP8X') {
        width = 1 + buffer.readUIntLE(24, 3);
        height = 1 + buffer.readUIntLE(27, 3);
      }
    }

    if (width > 0 && height > 0) {
      const aspectRatio = Number((width / height).toFixed(2));
      let orientation: 'LANDSCAPE' | 'SQUARE' | 'PORTRAIT' = 'LANDSCAPE';

      if (aspectRatio >= 1.35) {
        orientation = 'LANDSCAPE';
      } else if (aspectRatio >= 0.9) {
        orientation = 'SQUARE';
      } else {
        orientation = 'PORTRAIT';
      }

      return { width, height, aspectRatio, orientation };
    }
  } catch (error) {
    console.error('Failed to probe image metadata:', error);
  }

  return null;
}
