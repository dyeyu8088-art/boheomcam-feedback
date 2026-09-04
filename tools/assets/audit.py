#!/usr/bin/env python3
"""
素材完整性审计：扫描 public/assets 下全部 PNG / WebP，检查
  - 四边是否贴边（最外一圈像素 alpha ≥ 128 视为该边被裁切）
  - 透明安全边距（对象包围盒到四边的最小距离 / 短边，图标类目录要求 ≥ 12%）
  - 是否无透明通道（图标类目录出现整图不透明 → 疑似带背景的截图）
输出：build/asset-audit.json、build/asset-audit.md、build/asset-audit.html（棋盘格 + object-fit: contain 预览网格，异常项红框）
      build/asset-check-XX.png（PNG 检查表：每张素材放在棋盘格上，画出 12% 安全线；独立对象类异常红框、铺满类贴边黄框）
用法：python3 tools/assets/audit.py [--min-margin 0.12] [--only slots/symbols] [--no-sheets]
修复：python3 tools/assets/pad_margins.py（补边） / build-slot-symbols.py（水果机符号）；规范见 docs/12-asset-guidelines.md
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'apps/client-game/public/assets'
# 需要透明背景与安全边距的「独立对象」目录（背景 / 底板 / 横幅等允许铺满）
ICON_DIRS = ('slots/symbols', 'fishing/fish', 'fishing/boss', 'fishing/cannon', 'fishing/skills', 'common/icons', 'common/currency',
             'common/navigation', 'common/avatar', 'common/chips', 'common/vip', 'mahjong/character', 'red10/character', 'slots/character',
             'lobby/game_icons', 'common/effects', 'mahjong/effects', 'red10/effects', 'slots/jackpot',
             # 按钮 / 筹码 / 人物 / 图标类同样是独立对象（底板 plate_* / 面板 panel_* 由 SKIP_NAMES 排除）
             'common/buttons', 'mahjong/buttons', 'red10/buttons', 'roulette/buttons', 'slots/buttons', 'stock_game/buttons',
             'roulette/chips', 'stock_game/chips', 'stock_game/icons', 'roulette/character', 'stock_game/character')
SKIP_NAMES = ('plate', 'panel', 'banner', 'bg_', 'background', 'frame_', 'board', 'table', 'strip')


def is_icon(rel: str) -> bool:
    return any(rel.startswith(d) for d in ICON_DIRS) and not any(k in Path(rel).name for k in SKIP_NAMES)


def analyze(path: Path, min_margin: float) -> dict:
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    a = np.asarray(im)[:, :, 3]
    rel = path.relative_to(ASSETS).as_posix()
    info: dict = {'file': rel, 'w': w, 'h': h, 'icon': is_icon(rel), 'flags': []}
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        info['flags'].append('EMPTY')
        return info
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    info['bbox'] = [x0, y0, x1, y1]
    short = min(w, h)
    margins = {'left': x0 / short, 'top': y0 / short, 'right': (w - 1 - x1) / short, 'bottom': (h - 1 - y1) / short}
    info['margins'] = {k: round(v, 3) for k, v in margins.items()}
    edge = {'top': int(a[0, :].max()), 'bottom': int(a[-1, :].max()), 'left': int(a[:, 0].max()), 'right': int(a[:, -1].max())}
    info['edgeAlpha'] = edge
    info['minAlpha'] = int(a.min())
    # 贴边像素在该边上的占比：圆润物体只会在一点碰边（占比小），被裁切的物体在该边形成一段直线（占比大）
    run = {'top': float((a[0, :] >= 128).mean()), 'bottom': float((a[-1, :] >= 128).mean()),
           'left': float((a[:, 0] >= 128).mean()), 'right': float((a[:, -1] >= 128).mean())}
    info['edgeRun'] = {k: round(v, 3) for k, v in run.items()}
    for side, v in edge.items():
        if v >= 128:
            info['flags'].append(f'CUT_{side.upper()}' if run[side] >= 0.12 else f'EDGE_{side.upper()}')
    if info['icon']:
        if a.min() > 250:
            info['flags'].append('NO_ALPHA')
        low = [s for s, m in margins.items() if m < min_margin]
        if low and not any(f.startswith(('EDGE_', 'CUT_')) for f in info['flags']):
            info['flags'].append('LOW_MARGIN')
        # 深色底板：四角 8% 区域大多不透明且很暗 → 抠图时把素材站的深色底一起带进来了
        cw, ch = max(2, int(w * 0.08)), max(2, int(h * 0.08))
        rgb = np.asarray(im)[:, :, :3].astype(int)
        lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
        patches = [(slice(0, ch), slice(0, cw)), (slice(0, ch), slice(w - cw, w)), (slice(h - ch, h), slice(0, cw)), (slice(h - ch, h), slice(w - cw, w))]
        dark = sum(1 for sy, sx in patches if a[sy, sx].mean() > 200 and lum[sy, sx].mean() < 70)
        if dark >= 3:
            info['flags'].append('DARK_BG')
        # 四角不透明但中间透明 → 疑似带方框背景
        corners = [a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]]
        if min(corners) > 200 and a.min() <= 250:
            info['flags'].append('CORNER_OPAQUE')
    return info


def thumb_data_uri(path: Path, size: int = 160) -> str:
    im = Image.open(path).convert('RGBA')
    im.thumbnail((size, size))
    buf = io.BytesIO()
    im.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def draw_sheets(rows: list[dict], out: Path, min_margin: float, cols: int = 8, per_sheet: int = 48) -> list[Path]:
    """PNG 检查表：棋盘格底 + 12% 安全线 + 文件名 / 尺寸 / 标记；不依赖浏览器。"""
    from PIL import ImageDraw, ImageFont

    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 13)
    except OSError:
        font = ImageFont.load_default()
    cell, cap = 176, 30
    sheets: list[Path] = []
    for si in range(0, len(rows), per_sheet):
        chunk = rows[si : si + per_sheet]
        nrows = (len(chunk) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cell, nrows * (cell + cap) + 28), (24, 28, 36))
        d = ImageDraw.Draw(sheet)
        d.text((8, 6), f'素材检查表 {si // per_sheet + 1}  ·  安全线 = {int(min_margin * 100)}%  ·  红框 = 独立对象类异常  黄框 = 铺满类贴边（允许）  绿框 = 合格', fill=(230, 230, 230), font=font)
        for i, r in enumerate(chunk):
            x = (i % cols) * cell
            y = 28 + (i // cols) * (cell + cap)
            for yy in range(0, cell, 11):
                for xx in range(0, cell, 11):
                    d.rectangle([x + xx, y + yy, x + xx + 10, y + yy + 10], fill=(84, 90, 100) if (xx // 11 + yy // 11) % 2 else (110, 116, 126))
            im = Image.open(ASSETS / r['file']).convert('RGBA')
            w, h = im.size
            box = cell - 12
            sc = min(box / w, box / h, 3.0)
            im = im.resize((max(1, int(w * sc)), max(1, int(h * sc))), Image.LANCZOS)
            ox, oy = x + (cell - im.width) // 2, y + (cell - im.height) // 2
            sheet.paste(im, (ox, oy), im)
            # 画布边界（蓝）与安全线（青）
            d.rectangle([ox, oy, ox + im.width - 1, oy + im.height - 1], outline=(90, 150, 255))
            m = int(min(im.width, im.height) * min_margin)
            if r['icon']:
                d.rectangle([ox + m, oy + m, ox + im.width - 1 - m, oy + im.height - 1 - m], outline=(80, 220, 200))
            color = (255, 70, 70) if r['flags'] and r['icon'] else (220, 170, 40) if r['flags'] else (60, 180, 90)
            d.rectangle([x, y, x + cell - 1, y + cell - 1], outline=color, width=2)
            name = Path(r['file']).name
            d.text((x + 3, y + cell + 2), name[:27], fill=(240, 240, 240))
            d.text((x + 3, y + cell + 15), f"{w}×{h} {' '.join(r['flags']) or 'OK'}"[:30], fill=color)
        path = out / f'asset-check-{si // per_sheet + 1:02d}.png'
        sheet.save(path)
        sheets.append(path)
    return sheets


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--min-margin', type=float, default=0.12)
    ap.add_argument('--only', default='')
    ap.add_argument('--out', default=str(ROOT / 'build'))
    ap.add_argument('--no-sheets', action='store_true')
    args = ap.parse_args()
    files = sorted(p for p in ASSETS.rglob('*') if p.suffix.lower() in ('.png', '.webp'))
    if args.only:
        files = [p for p in files if p.relative_to(ASSETS).as_posix().startswith(args.only)]
    rows = [analyze(p, args.min_margin) for p in files]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'asset-audit.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    bad = [r for r in rows if r['flags']]
    icon_bad = [r for r in bad if r['icon']]
    lines = [f'# 素材审计 — {len(rows)} 个文件，{len(bad)} 个有标记（其中独立对象类 {len(icon_bad)} 个）', '',
             '| 文件 | 尺寸 | 边距 L/T/R/B | 标记 |', '|---|---|---|---|']
    for r in bad:
        m = r.get('margins', {})
        lines.append(f"| {r['file']} | {r['w']}×{r['h']} | {m.get('left','-')}/{m.get('top','-')}/{m.get('right','-')}/{m.get('bottom','-')} | {' '.join(r['flags'])} |")
    (out / 'asset-audit.md').write_text('\n'.join(lines) + '\n')
    # HTML 预览网格
    cells = []
    for r in rows:
        p = ASSETS / r['file']
        cls = 'bad' if r['flags'] and r['icon'] else ('warn' if r['flags'] else 'ok')
        cells.append(
            f'<figure class="{cls}"><div class="box"><img src="{thumb_data_uri(p)}" alt="{r["file"]}"></div>'
            f'<figcaption><b>{r["file"]}</b><span>{r["w"]}×{r["h"]} {" ".join(r["flags"]) or "OK"}</span></figcaption></figure>'
        )
    html = f'''<!doctype html><meta charset="utf-8"><title>素材审计 {len(rows)}</title>
<style>
body{{margin:0;background:#0d1117;color:#e6edf3;font:12px/1.4 system-ui}}
h1{{font-size:16px;padding:12px 16px;margin:0;background:#161b22;position:sticky;top:0}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:12px}}
figure{{margin:0;background:#161b22;border:2px solid #30363d;border-radius:8px;overflow:hidden}}
figure.bad{{border-color:#f85149}} figure.warn{{border-color:#d29922}}
.box{{aspect-ratio:1;background:repeating-conic-gradient(#3a3f47 0 25%,#262b33 0 50%) 0 0/16px 16px;padding:8%;box-sizing:border-box}}
.box img{{width:100%;height:100%;object-fit:contain;object-position:center;display:block}}
figcaption{{padding:6px 8px}} figcaption b{{display:block;font-weight:600;word-break:break-all;font-size:11px}} figcaption span{{color:#8b949e}}
figure.bad figcaption span{{color:#f85149}}
</style>
<h1>素材审计：{len(rows)} 个文件 · 红框 = 独立对象类异常（{len(icon_bad)}）· 黄框 = 铺满类贴边（允许）</h1>
<div class="grid">{''.join(cells)}</div>'''
    (out / 'asset-audit.html').write_text(html)
    if not args.no_sheets:
        for pth in (out / 'asset-check-*.png',):
            for old in out.glob(pth.name):
                old.unlink()
        sheets = draw_sheets(rows, out, args.min_margin)
        print(f'sheets: {", ".join(p.name for p in sheets)}')
    print(f'{len(rows)} files, {len(bad)} flagged, {len(icon_bad)} icon-class flagged')
    for r in icon_bad:
        print(f"  {r['file']}: {' '.join(r['flags'])}  margins={r.get('margins')}")


if __name__ == '__main__':
    main()
