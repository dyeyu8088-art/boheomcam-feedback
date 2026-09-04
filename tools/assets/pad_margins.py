#!/usr/bin/env python3
"""
统一安全边距：把「独立对象类」素材裁到不透明包围盒后，四周补等宽透明边，
使每边透明边距 ≥ --margin（默认 16%，按补边后画布短边计），对象居中、四边留白一致。

  - 原地覆盖，文件名 / 格式不变（PNG 无损；WebP 以 lossless 保存）
  - 只有裁切与补边，不缩放、不重采样：像素内容不变
  - 只处理 audit.py 判定为独立对象类（ICON_DIRS）且边距不足的文件；--all 处理全部目录
  - --only <前缀>  只处理该目录 / 文件前缀
  - --trim file=L,T,R,B   先从指定文件四边裁掉给定像素（去掉素材站边框碎片 / 白色细条）
  - --crop file=x0,y0,x1,y1  先按矩形裁切指定文件（x1,y1 不含）
  - --dry  只报告不写文件
用法：python3 tools/assets/pad_margins.py [--margin 0.16] [--only slots/symbols] [--trim mahjong/character/caishen_fa_tile.webp=0,0,4,0]
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit import ASSETS, is_icon  # noqa: E402


def content_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def pad_to_margin(im: Image.Image, margin: float) -> Image.Image:
    """裁到包围盒后四周补等宽透明边：pad = m·short/(1−2m) ⇒ pad/(short+2pad) = m。"""
    box = content_bbox(im)
    if box is None:
        return im
    obj = im.crop(box)
    short = min(obj.width, obj.height)
    pad = math.ceil(margin * short / (1 - 2 * margin))
    out = Image.new('RGBA', (obj.width + 2 * pad, obj.height + 2 * pad), (0, 0, 0, 0))
    out.paste(obj, (pad, pad), obj)
    return out


def margins_ok(im: Image.Image, margin: float) -> bool:
    box = content_bbox(im)
    if box is None:
        return True
    x0, y0, x1, y1 = box
    short = min(im.width, im.height)
    return min(x0, y0, im.width - x1, im.height - y1) / short >= margin - 1e-6


def save_same_format(im: Image.Image, path: Path) -> None:
    if path.suffix.lower() == '.webp':
        im.save(path, 'WEBP', lossless=True, quality=100, method=6)
    else:
        im.save(path, 'PNG', optimize=True)


def parse_kv(items: list[str], n: int) -> dict[str, tuple[int, ...]]:
    out: dict[str, tuple[int, ...]] = {}
    for it in items:
        k, v = it.split('=', 1)
        nums = tuple(int(x) for x in v.split(','))
        if len(nums) != n:
            raise SystemExit(f'bad spec {it}: expected {n} numbers')
        out[k] = nums
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--margin', type=float, default=0.16)
    ap.add_argument('--only', default='')
    ap.add_argument('--all', action='store_true', help='不限独立对象类目录，处理全部匹配文件')
    ap.add_argument('--trim', action='append', default=[], help='file=L,T,R,B 先裁掉四边像素')
    ap.add_argument('--crop', action='append', default=[], help='file=x0,y0,x1,y1 先按矩形裁切')
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()
    trims = parse_kv(args.trim, 4)
    crops = parse_kv(args.crop, 4)

    files = sorted(p for p in ASSETS.rglob('*') if p.suffix.lower() in ('.png', '.webp'))
    changed = 0
    before_bytes = after_bytes = 0
    for p in files:
        rel = p.relative_to(ASSETS).as_posix()
        if args.only and not rel.startswith(args.only):
            continue
        forced = rel in trims or rel in crops
        if not forced and not args.all and not is_icon(rel):
            continue
        im = Image.open(p).convert('RGBA')
        orig_size = im.size
        if rel in crops:
            x0, y0, x1, y1 = crops[rel]
            im = im.crop((x0, y0, x1, y1))
        if rel in trims:
            l, t, r, b = trims[rel]
            im = im.crop((l, t, im.width - r, im.height - b))
        if not forced and margins_ok(im, args.margin):
            continue
        out = pad_to_margin(im, args.margin)
        box = content_bbox(out)
        print(f'{rel}: {orig_size[0]}×{orig_size[1]} → {out.width}×{out.height}  bbox={box}')
        changed += 1
        if args.dry:
            continue
        before_bytes += p.stat().st_size
        save_same_format(out, p)
        after_bytes += p.stat().st_size
    print(f'{changed} files {"would be " if args.dry else ""}rewritten; bytes {before_bytes} → {after_bytes}')


if __name__ == '__main__':
    main()
