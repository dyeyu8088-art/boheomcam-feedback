/**
 * 全平台统一错误码。
 * 区段划分:
 *  1xxx 通用    2xxx 账号/鉴权    3xxx 钱包/结算    4xxx 房间/匹配
 *  5xxx 游戏内  6xxx 管理后台     7xxx 风控/安全
 */
export const ErrorCode = {
  OK: 0,

  // 1xxx 通用
  INTERNAL: 1000,
  BAD_REQUEST: 1001,
  NOT_FOUND: 1002,
  RATE_LIMITED: 1003,
  VALIDATION: 1004,
  MAINTENANCE: 1005,
  VERSION_TOO_OLD: 1006,

  // 2xxx 账号/鉴权
  AUTH_REQUIRED: 2000,
  TOKEN_EXPIRED: 2001,
  TOKEN_INVALID: 2002,
  REFRESH_INVALID: 2003,
  ACCOUNT_BANNED: 2004,
  BAD_CREDENTIALS: 2005,
  PHONE_TAKEN: 2006,
  SMS_CODE_INVALID: 2007,
  SMS_TOO_FREQUENT: 2008,
  DEVICE_LIMIT: 2009,
  KICKED_BY_OTHER_LOGIN: 2010,

  // 3xxx 钱包/结算
  INSUFFICIENT_BALANCE: 3000,
  DUPLICATE_TRANSACTION: 3001,
  WALLET_LOCKED: 3002,
  SETTLE_CONFLICT: 3003,
  AMOUNT_INVALID: 3004,

  // 4xxx 房间/匹配
  ROOM_NOT_FOUND: 4000,
  ROOM_FULL: 4001,
  ROOM_PASSWORD: 4002,
  ALREADY_IN_ROOM: 4003,
  NOT_IN_ROOM: 4004,
  ROOM_STARTED: 4005,
  MATCH_CANCELLED: 4006,
  MIN_BALANCE_REQUIRED: 4007,

  // 5xxx 游戏内
  NOT_YOUR_TURN: 5000,
  INVALID_ACTION: 5001,
  ACTION_TIMEOUT: 5002,
  GAME_NOT_RUNNING: 5003,
  BET_OUT_OF_RANGE: 5004,
  FIRE_TOO_FAST: 5005,

  // 6xxx 管理后台
  ADMIN_AUTH_REQUIRED: 6000,
  ADMIN_FORBIDDEN: 6001,
  ADMIN_2FA_REQUIRED: 6002,
  ADMIN_CONFIRM_REQUIRED: 6003,

  // 7xxx 风控/安全
  RISK_BLOCKED: 7000,
  SIGNATURE_INVALID: 7001,
  NONCE_REUSED: 7002,
  TIMESTAMP_SKEW: 7003,
  REPLAY_DETECTED: 7004,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorMessage: Record<number, string> = {
  [ErrorCode.OK]: 'OK',
  [ErrorCode.INTERNAL]: '服务器繁忙，请稍后再试',
  [ErrorCode.BAD_REQUEST]: '请求参数错误',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.RATE_LIMITED]: '操作过于频繁',
  [ErrorCode.VALIDATION]: '数据校验失败',
  [ErrorCode.MAINTENANCE]: '服务器维护中',
  [ErrorCode.VERSION_TOO_OLD]: '客户端版本过旧，请更新',
  [ErrorCode.AUTH_REQUIRED]: '请先登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已过期',
  [ErrorCode.TOKEN_INVALID]: '登录凭证无效',
  [ErrorCode.REFRESH_INVALID]: '刷新凭证无效，请重新登录',
  [ErrorCode.ACCOUNT_BANNED]: '账号已被封禁',
  [ErrorCode.BAD_CREDENTIALS]: '账号或密码错误',
  [ErrorCode.PHONE_TAKEN]: '该手机号已注册',
  [ErrorCode.SMS_CODE_INVALID]: '验证码错误或已过期',
  [ErrorCode.SMS_TOO_FREQUENT]: '验证码发送过于频繁',
  [ErrorCode.KICKED_BY_OTHER_LOGIN]: '账号在其他设备登录',
  [ErrorCode.INSUFFICIENT_BALANCE]: '余额不足',
  [ErrorCode.DUPLICATE_TRANSACTION]: '重复的交易请求',
  [ErrorCode.WALLET_LOCKED]: '钱包已锁定',
  [ErrorCode.SETTLE_CONFLICT]: '结算冲突',
  [ErrorCode.AMOUNT_INVALID]: '金额不合法',
  [ErrorCode.ROOM_NOT_FOUND]: '房间不存在',
  [ErrorCode.ROOM_FULL]: '房间已满',
  [ErrorCode.ROOM_PASSWORD]: '房间密码错误',
  [ErrorCode.ALREADY_IN_ROOM]: '已在房间中',
  [ErrorCode.NOT_IN_ROOM]: '不在房间中',
  [ErrorCode.ROOM_STARTED]: '牌局已开始',
  [ErrorCode.MIN_BALANCE_REQUIRED]: '金币不足，无法进入该场次',
  [ErrorCode.NOT_YOUR_TURN]: '还没轮到你操作',
  [ErrorCode.INVALID_ACTION]: '无效操作',
  [ErrorCode.ACTION_TIMEOUT]: '操作超时',
  [ErrorCode.GAME_NOT_RUNNING]: '牌局未进行',
  [ErrorCode.BET_OUT_OF_RANGE]: '下注超出范围',
  [ErrorCode.FIRE_TOO_FAST]: '射击过于频繁',
  [ErrorCode.ADMIN_AUTH_REQUIRED]: '请先登录后台',
  [ErrorCode.ADMIN_FORBIDDEN]: '无权限执行该操作',
  [ErrorCode.ADMIN_CONFIRM_REQUIRED]: '该操作需要二次确认',
  [ErrorCode.RISK_BLOCKED]: '触发风控，操作被拦截',
  [ErrorCode.SIGNATURE_INVALID]: '签名校验失败',
  [ErrorCode.NONCE_REUSED]: '重复请求',
  [ErrorCode.TIMESTAMP_SKEW]: '客户端时间异常',
  [ErrorCode.REPLAY_DETECTED]: '检测到重放请求',
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCodeValue,
    message?: string,
    public httpStatus = 400,
  ) {
    super(message ?? ErrorMessage[code] ?? `error ${code}`);
    this.name = 'ApiError';
  }
}
