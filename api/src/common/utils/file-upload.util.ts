import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger/logger';

/**
 * Saves a base64 encoded image string to the local disk inside the 'uploads' directory.
 * If the string is already a URL or file path, returns it unchanged.
 */
export async function saveBase64Image(
  base64Data: string,
  prefix = 'img',
): Promise<string> {
  if (!base64Data || typeof base64Data !== 'string') {
    return base64Data;
  }

  const trimmed = base64Data.trim();

  // If already an HTTP URL or local static upload path, return as is
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/uploads/')
  ) {
    return trimmed;
  }

  try {
    // Match data URL pattern (e.g. data:image/jpeg;base64,...)
    const matches = trimmed.match(
      /^data:image\/([a-zA-Z0-9+.=-]+);base64,(.+)$/,
    );
    let extension = 'jpg';
    let rawBase64 = trimmed;

    if (matches && matches.length === 3) {
      extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      rawBase64 = matches[2];
    }

    const buffer = Buffer.from(rawBase64, 'base64');

    // Ignore invalid empty buffers
    if (buffer.length === 0) {
      return base64Data;
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uniqueId = `${prefix}-${Date.now()}-${crypto
      .randomBytes(6)
      .toString('hex')}.${extension}`;
    const filePath = path.join(uploadsDir, uniqueId);

    await fs.promises.writeFile(filePath, buffer);
    const relativeUrl = `/uploads/${uniqueId}`;

    logger.debug(
      `[FileUploadUtil] Successfully converted Base64 (${buffer.length} bytes) to disk file: ${relativeUrl}`,
    );

    return relativeUrl;
  } catch (error: any) {
    logger.error(`[FileUploadUtil] Error converting base64 image:`, error);
    return base64Data;
  }
}

/**
 * Helper to process an array of image strings, saving any Base64 elements to disk.
 */
export async function processImagesList(
  images?: string[],
  prefix = 'img',
): Promise<string[]> {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return [];
  }

  const results = await Promise.all(
    images.map(img => saveBase64Image(img, prefix)),
  );
  return results.filter(Boolean);
}
