/** 三端共享 DTO 定义 */

// ── WebSocket 信封 ─────────────────────────────────────────────
export interface WsUp<T = unknown> {
  v: 1;
  requestId?: string;
  event: string;
  seq: number;
  timestamp: number;
  data: T;
  sig?: string;
}

export interface WsDown<T = unknown> {
  v: 1;
  event: string;
  ack?: number;
  pushSeq?: number;
  timestamp: number;
  code: number;
  msg?: string;
  data: T;
}

// ── REST 通用 ─────────────────────────────────────────────────
export interface ApiResp<T = unknown> {
  code: number;
  msg: string;
  data: T;
  requestId?: string;
}

// ── 账号 ─────────────────────────────────────────────────────
export type LoginType = 'guest' | 'password' | 'sms';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  /** WS/敏感接口 HMAC 会话密钥（仅内存保存，随刷新旋转） */
  sessionKey: string;
}

export interface UserSummary {
  uid: number;
  nickname: string;
  avatarId: number;
  gender: 0 | 1 | 2;
  level: number;
  vip: number;
  coins: number;
  diamonds: number;
  points: number;
  tickets: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserStats {
  totalRounds: number;
  wins: number;
  winRate: number;
  perGame: Record<string, { rounds: number; wins: number; scoreChange: number }>;
}

// ── 游戏与房间 ────────────────────────────────────────────────
export type GameCode = 'mahjong_yanbian' | 'hongshi' | 'fishing' | 'slot_fruit';

export interface GameStageInfo {
  /** 场次：bronze/silver/gold/private… */
  stageId: string;
  name: string;
  minCoins: number;
  baseScore: number;
  online: number;
}

export interface RoomPlayerInfo {
  uid: number;
  nickname: string;
  avatarId: number;
  vip: number;
  seat: number;
  coins: number;
  score: number;
  ready: boolean;
  online: boolean;
  trustee: boolean;
}

export interface RoomInfo {
  roomId: string;
  roomNo: string;
  gameCode: GameCode;
  stageId: string;
  mode: 'match' | 'private';
  ownerUid: number | null;
  maxPlayers: number;
  totalRounds: number;
  currentRound: number;
  state: 'waiting' | 'playing' | 'settling' | 'finished';
  ruleVersion: string;
  players: RoomPlayerInfo[];
  hasPassword?: boolean;
}

// ── 战绩 ─────────────────────────────────────────────────────
export interface RecordItem {
  roundId: string;
  roomId: string;
  gameCode: GameCode;
  stageId: string;
  startedAt: string;
  endedAt: string;
  scoreChange: number;
  detail: Record<string, unknown>;
  players: { uid: number; nickname: string; scoreChange: number }[];
}

// ── 钱包 ─────────────────────────────────────────────────────
export type Currency = 'COIN' | 'DIAMOND' | 'POINT' | 'TICKET';

export interface WalletTxItem {
  transactionId: string;
  currency: Currency;
  type: string;
  amount: number;
  balanceAfter: number;
  gameCode?: GameCode | null;
  roundId?: string | null;
  createdAt: string;
  description?: string;
}

// ── 社交 ─────────────────────────────────────────────────────
export interface FriendItem {
  uid: number;
  nickname: string;
  avatarId: number;
  vip: number;
  online: boolean;
  playing: GameCode | null;
}

export interface MailItem {
  mailId: string;
  title: string;
  body: string;
  attachments: { currency: Currency; amount: number }[];
  read: boolean;
  claimed: boolean;
  createdAt: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  sort: number;
  startAt: string;
  endAt: string;
}

// ── 活动/任务 ─────────────────────────────────────────────────
export interface SignInState {
  todaySigned: boolean;
  streak: number;
  rewards: { day: number; currency: Currency; amount: number; claimed: boolean }[];
}

export interface TaskItem {
  taskId: string;
  name: string;
  desc: string;
  period: 'daily' | 'weekly';
  target: number;
  progress: number;
  rewards: { currency: Currency; amount: number }[];
  claimed: boolean;
  completed: boolean;
}

export interface RankItem {
  rank: number;
  uid: number;
  nickname: string;
  avatarId: number;
  vip: number;
  value: number;
}
