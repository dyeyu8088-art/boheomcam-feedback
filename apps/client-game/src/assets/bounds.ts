import type { Texture } from 'pixi.js';

/**
 * 纹理的不透明内容包围盒（纹理坐标，单位与 texture.width/height 一致）。
 * 素材统一带 ≥16% 透明安全边距（tools/assets/pad_margins.py），Pixi 场景按「内容尺寸」而不是画布尺寸缩放 / 定位，
 * 这样补边或换素材都不需要改代码里的尺寸常量。解码失败（跨域画布等）时退回整张纹理。
 */
export interface ContentBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 内容中心在纹理中的归一化位置（可直接作 sprite.anchor） */
  cx: number;
  cy: number;
  /** true = 未能读取像素，返回的是整张纹理 */
  fallback: boolean;
}

const cache = new WeakMap<Texture, ContentBounds>();

export function contentBounds(texture: Texture): ContentBounds {
  const hit = cache.get(texture);
  if (hit) return hit;
  const full: ContentBounds = { x: 0, y: 0, w: texture.width, h: texture.height, cx: 0.5, cy: 0.5, fallback: true };
  let out = full;
  try {
    const source = texture.source;
    const res = (source as unknown as { resource?: CanvasImageSource }).resource;
    const pw = source.pixelWidth;
    const ph = source.pixelHeight;
    const frame = texture.frame;
    const sx = pw / source.width; // 像素 / 纹理单位
    const sy = ph / source.height;
    const fx = Math.round(frame.x * sx);
    const fy = Math.round(frame.y * sy);
    const fw = Math.max(1, Math.round(frame.width * sx));
    const fh = Math.max(1, Math.round(frame.height * sy));
    if (res && pw > 0 && ph > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = fw;
      canvas.height = fh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(res, fx, fy, fw, fh, 0, 0, fw, fh);
        const data = ctx.getImageData(0, 0, fw, fh).data;
        let x0 = fw;
        let y0 = fh;
        let x1 = -1;
        let y1 = -1;
        for (let y = 0; y < fh; y += 1) {
          const row = y * fw * 4;
          for (let x = 0; x < fw; x += 1) {
            if (data[row + x * 4 + 3]! > 8) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 >= x0 && y1 >= y0) {
          const w = (x1 - x0 + 1) / sx;
          const h = (y1 - y0 + 1) / sy;
          const x = x0 / sx;
          const y = y0 / sy;
          out = { x, y, w, h, cx: (x + w / 2) / texture.width, cy: (y + h / 2) / texture.height, fallback: false };
        }
      }
    }
  } catch {
    out = full;
  }
  cache.set(texture, out);
  return out;
}
