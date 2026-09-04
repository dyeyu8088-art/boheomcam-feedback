/**
 * 水果机 RTP 蒙特卡洛模拟器。
 * 用法：npx tsx scripts/slot-rtp-sim.ts [spins]   （SLOT_PAYS=<json> 可临时覆盖赔率做候选对比）
 * 输出：总 RTP、命中率、各来源贡献（线奖/Scatter/免费旋转）、方差指标。
 * 后台发布新 Paytable 前必须附本报告（写入 config_versions.metadata）。
 */
import { FRUIT_GOLD_V1 } from '../packages/game-common/src/slot/config.js';
import { spin } from '../packages/game-common/src/slot/engine.js';
import { secureRng } from '../packages/game-common/src/rng.js';

const spins = Number(process.argv[2] ?? 1_000_000);
// 调参：SLOT_PAYS='{"CHERRY":{"3":12,...}}' 临时覆盖赔率（不改源码即可对比候选方案）
const cfg = process.env.SLOT_PAYS ? { ...FRUIT_GOLD_V1, pays: { ...FRUIT_GOLD_V1.pays, ...(JSON.parse(process.env.SLOT_PAYS) as Record<string, Record<number, number>>) } } : FRUIT_GOLD_V1;
const betPerLine = 100;
const lines = 20;

let bet = 0;
let lineWin = 0;
let scatterWin = 0;
let fsWin = 0;
let hits = 0;
let fsTriggers = 0;
let freePending = 0;
let maxWin = 0;
const tierCount = { normal: 0, big: 0, mega: 0, epic: 0 };

for (let i = 0; i < spins; i += 1) {
  const isFree = freePending > 0;
  if (isFree) freePending -= 1;
  else bet += betPerLine * lines;
  const out = spin(cfg, betPerLine, lines, secureRng, isFree);
  const lw = out.lineWins.reduce((s, w) => s + w.win, 0);
  if (isFree) fsWin += lw + out.scatterWin;
  else {
    lineWin += lw;
    scatterWin += out.scatterWin;
  }
  if (out.totalWin > 0) hits += 1;
  if (out.freeSpinsAwarded > 0) fsTriggers += 1;
  freePending += out.freeSpinsAwarded;
  const x = out.totalWin / (betPerLine * lines);
  maxWin = Math.max(maxWin, x);
  if (x > 0 && x < 5) tierCount.normal += 1;
  else if (x >= 5 && x < 15) tierCount.big += 1;
  else if (x >= 15 && x < 50) tierCount.mega += 1;
  else if (x >= 50) tierCount.epic += 1;
}

const total = lineWin + scatterWin + fsWin;
const fmt = (x: number) => (x * 100).toFixed(2) + '%';
console.log(`paytable=${cfg.paytableVersion} spins=${spins} (含免费旋转)`);
console.log(`RTP 总计: ${fmt(total / bet)}  [目标 ${fmt(cfg.targetRtp)}]`);
console.log(`  线奖贡献:     ${fmt(lineWin / bet)}`);
console.log(`  Scatter 贡献: ${fmt(scatterWin / bet)}`);
console.log(`  免费旋转贡献: ${fmt(fsWin / bet)}`);
console.log(`命中率: ${fmt(hits / spins)}  免费触发率: ${fmt(fsTriggers / spins)}`);
console.log(`单次最高倍数: ${maxWin.toFixed(1)}x`);
console.log(`演出分布 normal=${tierCount.normal} big=${tierCount.big} mega=${tierCount.mega} epic=${tierCount.epic}`);
