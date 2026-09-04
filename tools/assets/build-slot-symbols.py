#!/usr/bin/env python3
"""
生成水果机符号集：11 张独立透明 PNG，统一 16% 安全边距、对象居中、四边留白一致。
  水果 / 宝石 / 星 / 礼盒 ← Microsoft Fluent UI Emoji 3D（MIT，https://github.com/microsoft/fluentui-emoji）
      默认自动下载到 build/fluent-cache/（或 --src 指定已下载目录）；许可证一并落到符号目录
  7 / BAR / 金币         ← 本项目原创 SVG（tools/assets/svg/*.svg），render-svg.mjs 光栅化
输出：apps/client-game/public/assets/slots/symbols/slot_*.png（覆盖旧文件；同名其它扩展名删除）
用法：python3 tools/assets/build-slot-symbols.py [--src DIR] [--margin 0.16]
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit import ASSETS, ROOT  # noqa: E402
from pad_margins import pad_to_margin  # noqa: E402

RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main'
# 目标文件名 → (Fluent 资源目录, 文件名前缀)
FLUENT = {
    'slot_watermelon': ('Watermelon', 'watermelon'),
    'slot_cherry': ('Cherries', 'cherries'),
    'slot_lemon': ('Lemon', 'lemon'),
    'slot_orange': ('Tangerine', 'tangerine'),
    'slot_grape': ('Grapes', 'grapes'),
    'slot_diamond': ('Gem stone', 'gem_stone'),
    'slot_wild': ('Glowing star', 'glowing_star'),
    'slot_bonus': ('Wrapped gift', 'wrapped_gift'),
}
ORIGINAL = {'slot_seven': 'seven.svg', 'slot_bar': 'bar.svg', 'slot_gold': 'coin.svg'}
OUT = ASSETS / 'slots/symbols'


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['curl', '-sfL', '-o', str(dest), url], check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='', help='已下载的 Fluent 3D PNG 目录（含 <name>_3d.png 与 LICENSE）')
    ap.add_argument('--margin', type=float, default=0.16)
    args = ap.parse_args()
    src = Path(args.src) if args.src else ROOT / 'build/fluent-cache'
    if not args.src:
        for _, (folder, name) in FLUENT.items():
            fetch(f'{RAW}/assets/{folder.replace(" ", "%20")}/3D/{name}_3d.png', src / f'{name}_3d.png')
        fetch(f'{RAW}/LICENSE', src / 'LICENSE')

    render_dir = ROOT / 'build/svg-render'
    render_dir.mkdir(parents=True, exist_ok=True)
    pairs = [f'{ROOT / "tools/assets/svg" / svg}={render_dir / (key + ".png")}' for key, svg in ORIGINAL.items()]
    subprocess.run(['node', str(ROOT / 'tools/assets/render-svg.mjs'), *pairs, '--size', '256'], check=True)

    OUT.mkdir(parents=True, exist_ok=True)
    sources: dict[str, Path] = {k: src / f'{v[1]}_3d.png' for k, v in FLUENT.items()}
    sources.update({k: render_dir / f'{k}.png' for k in ORIGINAL})
    for key, path in sources.items():
        im = pad_to_margin(Image.open(path).convert('RGBA'), args.margin)
        for old in OUT.glob(f'{key}.*'):
            old.unlink()
        im.save(OUT / f'{key}.png', 'PNG', optimize=True)
        print(f'{key}.png  {im.width}×{im.height}  ← {path.name}')
    shutil.copy(src / 'LICENSE', OUT / 'LICENSE-fluentui-emoji.txt')
    print(f'{len(sources)} symbols written to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
