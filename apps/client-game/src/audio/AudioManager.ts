/**
 * AudioManager（用户要求 §十五）
 * - SFX：WebAudio 解码缓冲，可重叠播放、零延迟；文件为 Kenney CC0 音效转 MP3（THIRD_PARTY_ASSETS.md）
 * - BGM：程序生成的环境音乐（WebAudio 振荡器 + 滤波 + 混响尾巴），按游戏切换调式 / 速度，切换游戏时淡出释放
 * - Voice：预留同 SFX 通道（播报类语音走 `voice()`，独立音量）
 * - 设置：音乐 / 音效开关与音量持久化到 localStorage；首个用户手势后自动 resume AudioContext
 */
import { ASSET_MANIFEST } from '../assets/manifest.gen.js';

export type SceneKey = 'lobby' | 'fishing' | 'slot' | 'roulette' | 'stock' | 'mahjong' | 'hongshi' | 'none';

interface AudioSettings {
  music: boolean;
  sfx: boolean;
  musicVolume: number; // 0..1
  sfxVolume: number;
  voiceVolume: number;
}
const STORE_KEY = 'yb.audio';
const DEFAULTS: AudioSettings = { music: true, sfx: true, musicVolume: 0.35, sfxVolume: 0.8, voiceVolume: 0.9 };

/** 场景调式：音阶（半音，相对根音）、根音 MIDI、BPM、音色亮度 */
const SCENES: Record<Exclude<SceneKey, 'none'>, { root: number; scale: number[]; bpm: number; bright: number; chords: number[][] }> = {
  lobby: { root: 57, scale: [0, 2, 4, 7, 9], bpm: 76, bright: 0.5, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]] },
  fishing: { root: 50, scale: [0, 2, 3, 7, 8], bpm: 64, bright: 0.25, chords: [[0, 3, 7, 10], [8, 12, 15, 19], [3, 7, 10, 14], [5, 8, 12, 15]] },
  slot: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 112, bright: 0.7, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
  roulette: { root: 55, scale: [0, 3, 5, 7, 10], bpm: 96, bright: 0.55, chords: [[0, 3, 7, 10], [5, 8, 12], [7, 10, 14], [0, 3, 7]] },
  stock: { root: 52, scale: [0, 2, 3, 7, 9], bpm: 104, bright: 0.6, chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [7, 10, 14]] },
  mahjong: { root: 62, scale: [0, 2, 4, 7, 9], bpm: 70, bright: 0.4, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]] },
  hongshi: { root: 57, scale: [0, 2, 4, 7, 9], bpm: 84, bright: 0.45, chords: [[0, 4, 7], [7, 11, 14], [5, 9, 12], [2, 5, 9]] },
};

class AudioManagerImpl {
  settings: AudioSettings = { ...DEFAULTS };
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private voiceBus!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private scene: SceneKey = 'none';
  private bgmTimer = 0;
  private bgmNodes: AudioNode[] = [];
  private nextBeat = 0;
  private beatIndex = 0;
  private unlocked = false;

  constructor() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) this.settings = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch {
      /* 私密模式等无 localStorage */
    }
    if (typeof window !== 'undefined') {
      const unlock = (): void => {
        this.ensure();
        void this.ctx?.resume();
        this.unlocked = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        if (this.scene !== 'none' && this.settings.music) this.startBgm();
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else if (this.unlocked) void this.ctx.resume();
      });
    }
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.voiceBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.voiceBus.connect(this.master);
    this.applyVolumes();
    return this.ctx;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.settings.sfx ? this.settings.sfxVolume : 0;
    this.musicBus.gain.value = this.settings.music ? this.settings.musicVolume : 0;
    this.voiceBus.gain.value = this.settings.sfx ? this.settings.voiceVolume : 0;
  }

  update(patch: Partial<AudioSettings>): void {
    const wasMusic = this.settings.music;
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.settings));
    } catch {
      /* noop */
    }
    this.applyVolumes();
    if (!wasMusic && this.settings.music && this.scene !== 'none') this.startBgm();
    if (wasMusic && !this.settings.music) this.stopBgm();
  }

  toggleMusic(): void {
    this.update({ music: !this.settings.music });
  }
  toggleSfx(): void {
    this.update({ sfx: !this.settings.sfx });
  }

  /** 播放音效（名字 = assets/audio 下文件名去扩展名的 camelCase） */
  sfx(name: string, opts: { volume?: number; rate?: number; bus?: 'sfx' | 'voice' } = {}): void {
    if (!this.settings.sfx) return;
    const ctx = this.ensure();
    if (!ctx) return;
    void this.load(name).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate ?? 1;
      const g = this.ctx.createGain();
      g.gain.value = opts.volume ?? 1;
      src.connect(g);
      g.connect(opts.bus === 'voice' ? this.voiceBus : this.sfxBus);
      src.start();
    });
  }
  voice(name: string): void {
    this.sfx(name, { bus: 'voice' });
  }

  private load(name: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return Promise.resolve(cached);
    const cur = this.loading.get(name);
    if (cur) return cur;
    const url = (ASSET_MANIFEST as Record<string, Record<string, string>>).audio?.[name];
    if (!url) {
      if (import.meta.env.DEV) console.warn(`[audio] 未登记的音效: ${name}`);
      return Promise.resolve(null);
    }
    const p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => this.ctx!.decodeAudioData(ab))
      .then((buf) => {
        this.buffers.set(name, buf);
        this.loading.delete(name);
        return buf;
      })
      .catch(() => {
        this.loading.delete(name);
        return null;
      });
    this.loading.set(name, p);
    return p;
  }

  /** 预热常用音效（进入游戏时调用） */
  preload(names: string[]): void {
    if (!this.ensure()) return;
    for (const n of names) void this.load(n);
  }

  /** 切换场景 BGM；`none` 停止。切换游戏时先淡出释放上一场景的节点。 */
  setScene(scene: SceneKey): void {
    if (scene === this.scene) return;
    this.stopBgm();
    this.scene = scene;
    if (scene !== 'none' && this.settings.music && this.unlocked) this.startBgm();
  }

  /* ───────── 程序化 BGM ───────── */
  private startBgm(): void {
    const ctx = this.ensure();
    if (!ctx || this.scene === 'none' || this.bgmTimer) return;
    const cfg = SCENES[this.scene];
    // 场景总线：低通 + 简单回声，营造氛围
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 800 + cfg.bright * 2400;
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 60 / cfg.bpm / 2;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    filt.connect(dry).connect(this.musicBus);
    filt.connect(delay).connect(wet).connect(this.musicBus);
    delay.connect(fb).connect(delay);
    this.bgmNodes = [filt, delay, fb, wet, dry];
    this.nextBeat = ctx.currentTime + 0.1;
    this.beatIndex = 0;
    const tick = (): void => {
      if (!this.ctx) return;
      const ahead = 0.6;
      while (this.nextBeat < this.ctx.currentTime + ahead) {
        this.scheduleBeat(this.nextBeat, filt, cfg);
        this.nextBeat += 60 / cfg.bpm;
        this.beatIndex += 1;
      }
      this.bgmTimer = window.setTimeout(tick, 200);
    };
    tick();
  }

  private midi(n: number): number {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  private scheduleBeat(t: number, out: AudioNode, cfg: (typeof SCENES)[keyof typeof SCENES]): void {
    const ctx = this.ctx!;
    const beat = this.beatIndex;
    const bar = Math.floor(beat / 4);
    const chord = cfg.chords[bar % cfg.chords.length]!;
    // 每小节第一拍：铺底和弦（三角波 + 缓慢包络）
    if (beat % 4 === 0) {
      for (const iv of chord) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = this.midi(cfg.root - 12 + iv);
        const g = ctx.createGain();
        const dur = (60 / cfg.bpm) * 4;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.6);
        g.gain.setValueAtTime(0.045, t + dur - 0.8);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
    // 每拍：从音阶中挑一个音做拨弦（确定性伪随机，避免每次刷新旋律突变）
    const seed = (beat * 9301 + 49297) % 233280;
    const r = seed / 233280;
    if (r < 0.72) {
      const deg = cfg.scale[Math.floor(r * 97) % cfg.scale.length]!;
      const oct = r > 0.5 ? 12 : 0;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = this.midi(cfg.root + oct + deg);
      const g = ctx.createGain();
      const dur = (60 / cfg.bpm) * 0.9;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07 + cfg.bright * 0.04, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private stopBgm(): void {
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = 0;
    }
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // 淡出后断开（节点由 GC 回收；已调度的振荡器最长 4 拍后自然 stop）
    const nodes = this.bgmNodes;
    this.bgmNodes = [];
    for (const n of nodes) {
      if (n instanceof GainNode) {
        n.gain.cancelScheduledValues(now);
        n.gain.setValueAtTime(n.gain.value, now);
        n.gain.linearRampToValueAtTime(0, now + 0.6);
      }
    }
    setTimeout(() => nodes.forEach((n) => n.disconnect()), 700);
  }
}

export const audio = new AudioManagerImpl();
