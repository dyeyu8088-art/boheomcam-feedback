/**
 * 迁移器：database/migrations/*.sql 按序执行（schema_migrations 记录），
 * 随后加载 seeds 与代码内规则包（单一来源同步到 game_configs / slot_paytables），
 * 最后引导默认管理员（密码来自 ADMIN_INIT_PASSWORD，缺省生成随机并打印一次）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, getPool, hashPassword, loadEnv, randomToken, withTx } from '@yanbian/server-core';
import { YANBIAN_DRAFT_RULE } from '@yanbian/game-common/mahjong';
import { HONGSHI_DRAFT_RULE } from '@yanbian/game-common/hongshi';
import { FISHING_STAGES, FISH_TYPES } from '@yanbian/game-common/fishing';
import { FRUIT_GOLD_V1 } from '@yanbian/game-common/slot';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

async function run(): Promise<void> {
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const dir = join(repoRoot, 'database', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
    if (done.rowCount) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    await withTx(async (c) => {
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
    });
    console.log(`migrated: ${f}`);
  }

  const seedDir = join(repoRoot, 'database', 'seeds');
  for (const f of readdirSync(seedDir).filter((x) => x.endsWith('.sql')).sort()) {
    await pool.query(readFileSync(join(seedDir, f), 'utf8'));
    console.log(`seeded: ${f}`);
  }

  // 代码内规则包（draft）同步 → 正式包由后台发布
  const upsertConfig = async (gameId: string, key: string, ruleVersion: string, config: unknown) => {
    await pool.query(
      `INSERT INTO game_configs (game_id, config_key, rule_version, config, status)
       VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (game_id, config_key, rule_version) DO UPDATE SET config = EXCLUDED.config`,
      [gameId, key, ruleVersion, JSON.stringify(config)],
    );
  };
  await upsertConfig('mahjong_yanbian', 'rule', YANBIAN_DRAFT_RULE.ruleVersion, YANBIAN_DRAFT_RULE);
  await upsertConfig('hongshi', 'rule', HONGSHI_DRAFT_RULE.ruleVersion, HONGSHI_DRAFT_RULE);
  await upsertConfig('fishing', 'stages', 'fishing_stages_v1', { stages: FISHING_STAGES, fishTypes: FISH_TYPES });
  await upsertConfig('slot_fruit', 'paytable_ref', FRUIT_GOLD_V1.paytableVersion, { paytableVersion: FRUIT_GOLD_V1.paytableVersion });
  await pool.query(
    `INSERT INTO slot_paytables (paytable_version, game_id, config, status)
     VALUES ($1,'slot_fruit',$2,'active')
     ON CONFLICT (paytable_version) DO UPDATE SET config = EXCLUDED.config, status='active'`,
    [FRUIT_GOLD_V1.paytableVersion, JSON.stringify(FRUIT_GOLD_V1)],
  );
  await pool.query(`UPDATE slot_paytables SET status='retired' WHERE game_id='slot_fruit' AND paytable_version <> $1 AND status='active'`, [FRUIT_GOLD_V1.paytableVersion]);

  // 平台场次配置（麻将/红十金币场）
  const stages = {
    mahjong_yanbian: [
      { stageId: 'mj_bronze', name: '青铜场', nameKo: '브론즈', minCoins: 1000, baseScore: 10, totalRounds: 4 },
      { stageId: 'mj_silver', name: '白银场', nameKo: '실버', minCoins: 20000, baseScore: 100, totalRounds: 4 },
      { stageId: 'mj_gold', name: '黄金场', nameKo: '골드', minCoins: 100000, baseScore: 500, totalRounds: 4 },
    ],
    hongshi: [
      { stageId: 'hs_bronze', name: '青铜场', nameKo: '브론즈', minCoins: 1000, baseScore: 10, totalRounds: 4 },
      { stageId: 'hs_silver', name: '白银场', nameKo: '실버', minCoins: 20000, baseScore: 100, totalRounds: 4 },
      { stageId: 'hs_gold', name: '黄金场', nameKo: '골드', minCoins: 100000, baseScore: 500, totalRounds: 4 },
    ],
  };
  await upsertConfig('mahjong_yanbian', 'stages', 'stages_v1', { stages: stages.mahjong_yanbian });
  await upsertConfig('hongshi', 'stages', 'stages_v1', { stages: stages.hongshi });

  // 品牌配置（白标）
  await pool.query(
    `INSERT INTO game_configs (game_id, config_key, rule_version, config, status)
     VALUES ('mahjong_yanbian','brand','brand_v1',$1,'active')
     ON CONFLICT (game_id, config_key, rule_version) DO NOTHING`,
    [
      JSON.stringify({
        nameZh: '延边娱乐',
        nameKo: '연변오락',
        nameEn: 'YANBIAN GAME',
        slogan: '高级 · 稳定 · 精致',
        sloganKo: '프리미엄 · 안정 · 정교함',
        primaryGold: '#C9A063',
      }),
    ],
  );

  // 默认管理员
  const admins = await pool.query('SELECT COUNT(*)::int AS n FROM admins');
  if (admins.rows[0]!.n === 0) {
    const env = loadEnv();
    const pwd = env.adminInitPassword ?? `Admin_${randomToken(9)}`;
    await withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO admins (username, password_hash, display_name, must_change_password)
         VALUES ('admin', $1, '超级管理员', true) RETURNING id`,
        [hashPassword(pwd)],
      );
      await c.query(
        `INSERT INTO admin_roles (admin_id, role_id) SELECT $1, id FROM roles WHERE code='super'`,
        [r.rows[0]!.id],
      );
    });
    console.log('==============================================');
    console.log(' 默认后台账号: admin');
    console.log(` 初始密码: ${pwd}`);
    console.log(' 首次登录必须修改密码。');
    console.log('==============================================');
  }

  console.log('migrate: done');
  await closeDb();
}

run().catch((e) => {
  console.error('migrate failed:', e);
  process.exit(1);
});
