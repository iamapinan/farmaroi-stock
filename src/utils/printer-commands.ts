import iconv from 'iconv-lite';

export const PRINTER_COMMANDS = {
  INIT: [0x1B, 0x40], // Initialize printer
  LF: [0x0A], // Line feed
  ALIGN_LEFT: [0x1B, 0x61, 0x00],
  ALIGN_CENTER: [0x1B, 0x61, 0x01],
  ALIGN_RIGHT: [0x1B, 0x61, 0x02],
  BOLD_ON: [0x1B, 0x45, 0x01],
  BOLD_OFF: [0x1B, 0x45, 0x00],
  TEXT_SIZE_NORMAL: [0x1D, 0x21, 0x00],
  TEXT_SIZE_LARGE: [0x1D, 0x21, 0x11], // Double width & height
  CUT: [0x1D, 0x56, 0x42, 0x00], // Cut paper (if supported)
  CODE_PAGE_THAI: [0x1B, 0x74, 0x16] // CP874 (Thai) - Command might vary by printer model
};

/**
 * Encodes a string to a byte array compatible with Thai thermal printers (CP874).
 */
export const encodeToThai = (text: string): Uint8Array => {
  // Use iconv-lite to encode to CP874 (which is compatible with TIS-620)
  // We convert the Buffer to Uint8Array
  const buffer = iconv.encode(text, 'cp874');
  return new Uint8Array(buffer);
};

/**
 * Helper to combine multiple Uint8Arrays into one
 */
export const concatBuffers = (buffers: (Uint8Array | number[])[]): Uint8Array => {
    let totalLength = 0;
    for (const buf of buffers) {
        totalLength += buf.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        if (Array.isArray(buf)) {
             result.set(new Uint8Array(buf), offset);
             offset += buf.length;
        } else {
             result.set(buf, offset);
             offset += buf.length;
        }
    }
    return result;
};
