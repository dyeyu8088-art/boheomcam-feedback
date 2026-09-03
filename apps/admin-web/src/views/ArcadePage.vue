<template>
  <el-card shadow="never">
    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="水果机 Jackpot" name="jackpots">
        <el-table v-loading="loading" :data="pools" size="small" style="margin-bottom: 16px">
          <el-table-column prop="game_id" label="游戏" width="120" />
          <el-table-column prop="tier" label="档位" width="90" />
          <el-table-column label="当前奖池" width="140"><template #default="{ row }">{{ Number(row.pool).toLocaleString() }}</template></el-table-column>
          <el-table-column label="重置种子" width="120"><template #default="{ row }">{{ Number(row.seed).toLocaleString() }}</template></el-table-column>
          <el-table-column label="注入比例" width="110"><template #default="{ row }">{{ (row.contrib_bp / 100).toFixed(2) }}%</template></el-table-column>
          <el-table-column label="命中概率 / 注" width="130"><template #default="{ row }">{{ row.hit_chance_ppm }} ppm</template></el-table-column>
          <el-table-column label="更新时间"><template #default="{ row }">{{ new Date(row.updated_at).toLocaleString() }}</template></el-table-column>
        </el-table>
        <div class="sub">最近命中（不可删改，账本幂等 key `slot:jackpot:&lt;roundId&gt;`）</div>
        <el-table :data="hits" size="small">
          <el-table-column prop="round_id" label="Round" width="170" />
          <el-table-column prop="user_id" label="UID" width="120" />
          <el-table-column prop="tier" label="档位" width="90" />
          <el-table-column label="金额" width="140"><template #default="{ row }">{{ Number(row.amount).toLocaleString() }}</template></el-table-column>
          <el-table-column label="时间"><template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template></el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="轮盘回合" name="roulette">
        <el-table v-loading="loading" :data="rouletteRounds" size="small" @row-click="(row: any) => openBets('roulette', row.round_id)">
          <el-table-column prop="round_id" label="Round" width="170" />
          <el-table-column label="结果" width="80">
            <template #default="{ row }">
              <span v-if="row.rng_audit?.void" class="void">作废</span>
              <span v-else-if="row.result === null || row.result === undefined">—</span>
              <el-tag v-else :type="rouletteColor(row.result)" effect="dark" size="small">{{ row.result }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="players" label="玩家" width="70" />
          <el-table-column label="总投注" width="120"><template #default="{ row }">{{ Number(row.total_bet).toLocaleString() }}</template></el-table-column>
          <el-table-column label="总派彩" width="120"><template #default="{ row }">{{ Number(row.total_payout).toLocaleString() }}</template></el-table-column>
          <el-table-column label="RNG 审计" min-width="220"><template #default="{ row }">{{ auditText(row.rng_audit) }}</template></el-table-column>
          <el-table-column prop="server_id" label="节点" width="110" />
          <el-table-column label="开局 / 结算" width="200">
            <template #default="{ row }">{{ new Date(row.opened_at).toLocaleTimeString() }} → {{ row.settled_at ? new Date(row.settled_at).toLocaleTimeString() : '进行中' }}</template>
          </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="page" layout="prev, pager, next" :page-count="page + (rouletteRounds.length === 50 ? 1 : 0)" style="margin-top: 12px" @current-change="load" />
      </el-tab-pane>

      <el-tab-pane label="股票回合" name="stock">
        <div class="bar">
          <el-select v-model="instrument" placeholder="品种" clearable style="width: 180px" @change="load">
            <el-option value="YB_TECH" label="延吉科技" />
            <el-option value="CB_SPRING" label="长白山泉" />
            <el-option value="TM_SHIP" label="图们江航运" />
          </el-select>
        </div>
        <el-table v-loading="loading" :data="stockRounds" size="small" @row-click="(row: any) => openBets('stock', row.round_id)">
          <el-table-column prop="round_id" label="Round" width="170" />
          <el-table-column prop="instrument" label="品种" width="110" />
          <el-table-column label="开盘 → 结算" width="170">
            <template #default="{ row }">{{ Number(row.opening_price).toFixed(2) }} → {{ row.settlement_price === null ? '—' : Number(row.settlement_price).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="方向" width="80">
            <template #default="{ row }">
              <span v-if="row.rng_audit?.void" class="void">作废</span>
              <el-tag v-else-if="row.direction" :type="row.direction === 'UP' ? 'success' : row.direction === 'DOWN' ? 'danger' : 'info'" size="small">{{ row.direction }}</el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column prop="players" label="玩家" width="70" />
          <el-table-column label="总投注" width="120"><template #default="{ row }">{{ Number(row.total_bet).toLocaleString() }}</template></el-table-column>
          <el-table-column label="总派彩" width="120"><template #default="{ row }">{{ Number(row.total_payout).toLocaleString() }}</template></el-table-column>
          <el-table-column label="审计" min-width="200"><template #default="{ row }">{{ auditText(row.rng_audit) }}</template></el-table-column>
          <el-table-column label="开盘 / 结算" width="200">
            <template #default="{ row }">{{ new Date(row.opened_at).toLocaleTimeString() }} → {{ row.settled_at ? new Date(row.settled_at).toLocaleTimeString() : '进行中' }}</template>
          </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="page" layout="prev, pager, next" :page-count="page + (stockRounds.length === 50 ? 1 : 0)" style="margin-top: 12px" @current-change="load" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="betsOpen" :title="`注单 · Round ${betsRound}`" width="760px">
      <el-table :data="bets" size="small">
        <el-table-column prop="bet_id" label="Bet" width="90" />
        <el-table-column prop="user_id" label="UID" width="120" />
        <el-table-column prop="bet_type" label="类型" width="120" />
        <el-table-column prop="selection" label="选项" width="110" />
        <el-table-column label="金额" width="110"><template #default="{ row }">{{ Number(row.amount).toLocaleString() }}</template></el-table-column>
        <el-table-column v-if="betsGame === 'stock'" label="赔率" width="90"><template #default="{ row }">×{{ (row.odds_bp / 10000).toFixed(2) }}</template></el-table-column>
        <el-table-column label="派彩" width="110"><template #default="{ row }">{{ Number(row.payout).toLocaleString() }}</template></el-table-column>
        <el-table-column label="时间"><template #default="{ row }">{{ new Date(row.created_at).toLocaleTimeString() }}</template></el-table-column>
      </el-table>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api.js';

/** 街机类记录：水果机 Jackpot 奖池 / 轮盘回合 / 股票回合（只读；账本与注单表禁止删除） */
const tab = ref('jackpots');
const loading = ref(false);
const pools = ref<any[]>([]);
const hits = ref<any[]>([]);
const rouletteRounds = ref<any[]>([]);
const stockRounds = ref<any[]>([]);
const page = ref(1);
const instrument = ref('');
const betsOpen = ref(false);
const betsRound = ref('');
const betsGame = ref<'roulette' | 'stock'>('roulette');
const bets = ref<any[]>([]);

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function rouletteColor(n: number): 'success' | 'danger' | 'info' {
  return n === 0 ? 'success' : RED.has(n) ? 'danger' : 'info';
}
function auditText(a: Record<string, unknown> | null): string {
  if (!a) return '';
  return Object.entries(a)
    .filter(([k]) => k !== 'void')
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' · ');
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    if (tab.value === 'jackpots') {
      const r = await api<{ pools: any[]; hits: any[] }>('/api/admin/v1/arcade/jackpots');
      pools.value = r.pools;
      hits.value = r.hits;
    } else if (tab.value === 'roulette') {
      rouletteRounds.value = (await api<{ items: any[] }>(`/api/admin/v1/arcade/roulette/rounds?page=${page.value}`)).items;
    } else {
      const q = new URLSearchParams({ page: String(page.value) });
      if (instrument.value) q.set('instrument', instrument.value);
      stockRounds.value = (await api<{ items: any[] }>(`/api/admin/v1/arcade/stock/rounds?${q}`)).items;
    }
  } finally {
    loading.value = false;
  }
}
async function openBets(game: 'roulette' | 'stock', roundId: string): Promise<void> {
  betsGame.value = game;
  betsRound.value = String(roundId);
  bets.value = (await api<{ items: any[] }>(`/api/admin/v1/arcade/${game}/rounds?roundId=${roundId}`)).items;
  betsOpen.value = true;
}
onMounted(load);
</script>

<style scoped>
.bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.sub {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.void {
  color: #e6a23c;
}
</style>
