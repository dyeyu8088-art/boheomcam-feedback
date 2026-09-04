#!/usr/bin/env python3
"""
测试用 APK 打包（不依赖 Android SDK / Gradle / 谷歌仓库）：

  python3 tools/apk/build-test-apk.py [--dist apps/client-game/dist] [--out build/yanbian-test.apk]
  python3 tools/apk/build-test-apk.py --server https://test.example.com   # 把服务器地址烧进客户端（先 vite build），测试者装上即连

原理：WebView 壳（tools/apk/src）+ 内嵌 NanoHTTPD 提供 dist/ 静态文件。
  1. 依赖只从 Maven Central 下载：Robolectric android-all（作为 android.jar 编译）、dalvik-dx（dex）、NanoHTTPD
  2. javac --release 8 编译壳 → dx 生成 classes.dex
  3. AndroidManifest.xml 由 pyaxml 生成二进制 AXML，再把枚举 / 标志位属性改写为正确的 typed value
  4. zip 组装（AndroidManifest.xml / classes.dex / assets/www/**）→ jarsigner 调试签名（v1，targetSdk 28 可安装）
  5. 用 androguard 回读校验包名 / 入口 Activity

前置：JDK 11+（javac / jarsigner / keytool）、python3 + pip install pyaxml（校验可选 androguard）、apps/client-game 已 `vite build`。
正式发布仍按 docs/10-deployment.md 用 Capacitor + Android Studio 打包（v2/v3 签名、图标、targetSdk 34）。
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import struct
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / 'src'
MC = 'https://repo.maven.apache.org/maven2'
DEPS = {
    'android-all.jar': f'{MC}/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar',
    'dx.jar': f'{MC}/com/jakewharton/android/repackaged/dalvik-dx/9.0.0_r3/dalvik-dx-9.0.0_r3.jar',
    'nanohttpd.jar': f'{MC}/org/nanohttpd/nanohttpd/2.3.1/nanohttpd-2.3.1.jar',
}
PACKAGE = 'com.yanbiangame.app'

MANIFEST_XML = '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="{pkg}" android:versionCode="{vcode}" android:versionName="{vname}">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="28" />
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <application android:label="{label}" android:usesCleartextTraffic="true" android:hardwareAccelerated="true" android:allowBackup="false">
    <activity android:name=".MainActivity" android:exported="true" android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize" android:screenOrientation="sensorLandscape" android:launchMode="singleTask" android:windowSoftInputMode="adjustResize">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
'''

# pyaxml 会把枚举 / 标志位当字符串写入；按 Android 属性定义改写为 typed value
# (name → (type, data))：TYPE_INT_DEC=0x10, TYPE_INT_HEX=0x11
TYPED_FIX = {
    'configChanges': (0x11, 0x80 | 0x400 | 0x20 | 0x100 | 0x800),  # orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize
    'screenOrientation': (0x10, 6),  # sensorLandscape
    'launchMode': (0x10, 2),  # singleTask
    'windowSoftInputMode': (0x11, 0x10),  # adjustResize
}


def log(msg: str) -> None:
    print(f'[apk] {msg}', flush=True)


def run(cmd: list[str], **kw) -> None:
    env = dict(os.environ)
    env.pop('JAVA_TOOL_OPTIONS', None)  # 避免代理提示噪音
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.stderr.write(r.stdout[-4000:] + r.stderr[-4000:])
        raise SystemExit(f'command failed: {" ".join(cmd[:3])} …')


def fetch_deps(cache: Path) -> dict[str, Path]:
    cache.mkdir(parents=True, exist_ok=True)
    out = {}
    for name, url in DEPS.items():
        p = cache / name
        if not p.exists() or p.stat().st_size < 1000:
            log(f'download {name}')
            urllib.request.urlretrieve(url, p)
        out[name] = p
    return out


def build_manifest(vcode: int, vname: str, label: str) -> bytes:
    from pyaxml import AXML  # type: ignore

    a = AXML()
    a.from_xml(MANIFEST_XML.format(pkg=PACKAGE, vcode=vcode, vname=vname, label=label))
    a.compute()
    data = bytearray(a.pack())
    # 解析字符串池 + 遍历 START_ELEMENT 属性，改写枚举 / 标志位
    u16 = lambda o: struct.unpack_from('<H', data, o)[0]
    u32 = lambda o: struct.unpack_from('<I', data, o)[0]
    assert u16(0) == 0x0003, 'not an AXML'
    strings: list[str] = []
    off = 8
    fixed = 0
    while off < len(data):
        t, sz = u16(off), u32(off + 4)
        if t == 0x0001:
            cnt, flags, so = u32(off + 8), u32(off + 16), u32(off + 20)
            utf8 = bool(flags & 0x100)
            for i in range(cnt):
                p = off + so + u32(off + 28 + 4 * i)
                if utf8:
                    n = data[p]
                    p += 2 if n & 0x80 else 1
                    bl = data[p]
                    p += 1
                    if bl & 0x80:
                        bl = ((bl & 0x7F) << 8) | data[p]
                        p += 1
                    strings.append(bytes(data[p : p + bl]).decode('utf-8', 'replace'))
                else:
                    n = u16(p)
                    p += 2
                    if n & 0x8000:
                        n = ((n & 0x7FFF) << 16) | u16(p)
                        p += 2
                    strings.append(bytes(data[p : p + 2 * n]).decode('utf-16le', 'replace'))
        elif t == 0x0102:
            ac, aoff = u16(off + 28), off + 16 + u16(off + 24)
            for i in range(ac):
                a0 = aoff + i * 20
                nm = strings[u32(a0 + 4)]
                if nm in TYPED_FIX:
                    ty, val = TYPED_FIX[nm]
                    struct.pack_into('<I', data, a0 + 8, 0xFFFFFFFF)  # rawValue = -1
                    struct.pack_into('<HBB', data, a0 + 12, 8, 0, ty)  # size, res0, type
                    struct.pack_into('<I', data, a0 + 16, val)
                    fixed += 1
        off += sz
    assert fixed == len(TYPED_FIX), f'typed fix count {fixed}'
    return bytes(data)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dist', default=str(ROOT / 'apps/client-game/dist'))
    ap.add_argument('--out', default=str(ROOT / 'build/yanbian-test.apk'))
    ap.add_argument('--cache', default=str(ROOT / 'build/apk-cache'))
    ap.add_argument('--version-code', type=int, default=1)
    ap.add_argument('--version-name', default='0.3.0-test')
    ap.add_argument('--label', default='延边娱乐 测试版')
    ap.add_argument('--keystore', default='')
    ap.add_argument('--server', default='', help='服务器地址（http(s)://host[:port]）：以 VITE_SERVER_BASE 重新 vite build，APK 内置该地址，登录页仍可改')
    args = ap.parse_args()

    if args.server:
        server = args.server.strip().rstrip('/')
        if not re.match(r'^https?://[^\s/]+$', server):
            raise SystemExit('--server 需为 http(s)://host[:port]')
        log(f'vite build (VITE_SERVER_BASE={server})')
        env = dict(os.environ, VITE_SERVER_BASE=server)
        env.pop('JAVA_TOOL_OPTIONS', None)
        r = subprocess.run(['pnpm', '--filter', '@yanbian/client-game', 'exec', 'vite', 'build'], cwd=ROOT, env=env, capture_output=True, text=True)
        if r.returncode != 0:
            sys.stderr.write(r.stdout[-3000:] + r.stderr[-3000:])
            raise SystemExit('vite build failed')
    dist = Path(args.dist)
    if not (dist / 'index.html').exists():
        raise SystemExit(f'dist 不存在：{dist}（先在 apps/client-game 执行 vite build）')
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    cache = Path(args.cache)
    deps = fetch_deps(cache)
    work = cache / 'work'
    shutil.rmtree(work, ignore_errors=True)
    (work / 'classes').mkdir(parents=True)

    log('javac')
    run([
        'javac', '--release', '8', '-Xlint:-options', '-nowarn',
        '-cp', f'{deps["android-all.jar"]}{os.pathsep}{deps["nanohttpd.jar"]}',
        '-d', str(work / 'classes'),
        *[str(p) for p in SRC.rglob('*.java')],
    ])
    log('dx')
    run(['java', '-cp', str(deps['dx.jar']), 'com.android.dx.command.Main', '--dex', '--min-sdk-version=24',
         f'--output={work / "classes.dex"}', str(work / 'classes'), str(deps['nanohttpd.jar'])])

    log('manifest')
    manifest = build_manifest(args.version_code, args.version_name, args.label)

    log('zip')
    unsigned = work / 'unsigned.apk'
    with zipfile.ZipFile(unsigned, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('AndroidManifest.xml', manifest)
        z.write(work / 'classes.dex', 'classes.dex')
        for f in sorted(dist.rglob('*')):
            if f.is_file():
                z.write(f, f'assets/www/{f.relative_to(dist).as_posix()}')

    log('sign')
    ks = Path(args.keystore) if args.keystore else cache / 'debug.keystore'
    if not ks.exists():
        run(['keytool', '-genkeypair', '-keystore', str(ks), '-storepass', 'android', '-keypass', 'android',
             '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
             '-dname', 'CN=Android Debug,O=Android,C=US'])
    shutil.copy(unsigned, out)
    run(['jarsigner', '-keystore', str(ks), '-storepass', 'android', '-keypass', 'android',
         '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', str(out), 'androiddebugkey'])

    log('verify')
    run(['jarsigner', '-verify', str(out)])
    try:
        import logging

        logging.disable(logging.CRITICAL)
        from androguard.core.apk import APK  # type: ignore

        apk = APK(str(out))
        log(f'package={apk.get_package()} main={apk.get_main_activity()} v1={apk.is_signed_v1()} '
            f'min={apk.get_min_sdk_version()} target={apk.get_target_sdk_version()}')
    except ImportError:
        log('androguard 未安装，跳过结构校验')
    size = out.stat().st_size
    log(f'done: {out} ({size / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
