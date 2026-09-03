/** WebSocket 事件名（三端共享唯一来源，禁止散写字符串） */
export const Ev = {
  // 系统
  SysPing: 'sys.ping',
  SysPong: 'sys.pong',
  SysKicked: 'sys.kicked',
  SysResync: 'sys.resync',
  SysError: 'sys.error',
  SysHello: 'sys.hello',

  // 大厅
  LobbyOnline: 'lobby.online',
  LobbyAnnounce: 'lobby.announce',

  // 匹配
  MatchStart: 'match.start',
  MatchCancel: 'match.cancel',
  MatchFound: 'match.found',

  // 房间
  RoomCreate: 'room.create',
  RoomJoin: 'room.join',
  RoomLeave: 'room.leave',
  RoomReady: 'room.ready',
  RoomUnready: 'room.unready',
  RoomDissolve: 'room.dissolve',
  RoomSync: 'room.sync',
  RoomPlayerJoined: 'room.playerJoined',
  RoomPlayerLeft: 'room.playerLeft',
  RoomPlayerOffline: 'room.playerOffline',
  RoomPlayerReconnect: 'room.playerReconnect',
  RoomPlayerReady: 'room.playerReady',
  RoomGameStart: 'room.gameStart',
  RoomChat: 'room.chat',

  // 通用对局
  GameRoundResult: 'game.roundResult',
  GameMatchOver: 'game.matchOver',
  GameTrustee: 'game.trustee',

  // 麻将
  MjDeal: 'mahjong.deal',
  MjTurn: 'mahjong.turn',
  MjDraw: 'mahjong.draw',
  MjDrawPublic: 'mahjong.drawPublic',
  MjDiscard: 'mahjong.discard',
  MjDiscarded: 'mahjong.discarded',
  MjActionAsk: 'mahjong.actionAsk',
  MjAction: 'mahjong.action',
  MjMeld: 'mahjong.meld',
  MjHu: 'mahjong.hu',
  MjRoundEnd: 'mahjong.roundEnd',
  MjTingInfo: 'mahjong.tingInfo',

  // 红十
  HsDeal: 'hongshi.deal',
  HsTurn: 'hongshi.turn',
  HsPlay: 'hongshi.play',
  HsPlayed: 'hongshi.played',
  HsPass: 'hongshi.pass',
  HsHint: 'hongshi.hint',
  HsIdentityReveal: 'hongshi.identityReveal',
  HsRoundEnd: 'hongshi.roundEnd',

  // 捕鱼
  FsEnter: 'fishing.enter',
  FsState: 'fishing.state',
  FsWave: 'fishing.wave',
  FsBossWarning: 'fishing.bossWarning',
  FsFire: 'fishing.fire',
  FsFireOk: 'fishing.fireOk',
  FsHit: 'fishing.hit',
  FsHitResult: 'fishing.hitResult',
  FsFishKilled: 'fishing.fishKilled',
  FsPlayerFire: 'fishing.playerFire',
  FsLeave: 'fishing.leave',
  FsSkill: 'fishing.skill',
  FsSkillUsed: 'fishing.skillUsed',
  FsBossHp: 'fishing.bossHp',
  FsBossDead: 'fishing.bossDead',
  FsBossReward: 'fishing.bossReward',
  FsFrozen: 'fishing.frozen',
  FsPlayerJoined: 'fishing.playerJoined',
  FsPlayerLeft: 'fishing.playerLeft',

  // 水果机
  SlEnter: 'slot.enter',
  SlSpin: 'slot.spin',
  SlSpinResult: 'slot.spinResult',
  SlHistory: 'slot.history',
  SlJackpot: 'slot.jackpot',
  SlTicket: 'slot.ticket',

  // 轮盘（单桌共享回合；下注/开奖/派彩全部服务端）
  RlEnter: 'roulette.enter',
  RlState: 'roulette.state',
  RlBet: 'roulette.bet',
  RlBetOk: 'roulette.bet.ok',
  RlSpin: 'roulette.spin',
  RlResult: 'roulette.result',
  RlHistory: 'roulette.history',
  RlLeave: 'roulette.leave',
} as const;

export type EventName = (typeof Ev)[keyof typeof Ev];
