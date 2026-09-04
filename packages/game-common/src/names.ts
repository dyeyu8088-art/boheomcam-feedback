/**
 * 默认昵称 / 陪练名（中韩双语，三端共享）。
 * 服务端落库存中文（唯一来源），客户端按当前语言用 localizeName() 显示：
 *   游客默认昵称 = 前缀 + 4 位数字；陪练机器人 = 固定名。玩家自改昵称不受影响。
 */
export const NICK_POOL: { zh: string; ko: string }[] = [
  { zh: '长白山客', ko: '백두산 나그네' },
  { zh: '图们江畔', ko: '두만강변' },
  { zh: '金达莱', ko: '진달래' },
  { zh: '海兰江', ko: '해란강' },
  { zh: '延吉之星', ko: '연길의 별' },
  { zh: '珲春旅人', ko: '훈춘 여행자' },
  { zh: '和龙牌手', ko: '화룡 타짜' },
  { zh: '敦化雅士', ko: '돈화 선비' },
];

export const BOT_NAMES: { zh: string; ko: string }[] = [
  { zh: '金达莱', ko: '진달래' },
  { zh: '海兰江畔', ko: '해란강변' },
  { zh: '长白雪松', ko: '백두 설송' },
  { zh: '图们渔火', ko: '두만강 어화' },
  { zh: '延吉夜风', ko: '연길 밤바람' },
  { zh: '珲春晨光', ko: '훈춘 아침빛' },
  { zh: '和龙月色', ko: '화룡 달빛' },
  { zh: '敦化松涛', ko: '돈화 솔바람' },
];

const zhToKo = new Map<string, string>([...NICK_POOL, ...BOT_NAMES].map((n) => [n.zh, n.ko]));
const prefixes = [...zhToKo.keys()].sort((a, b) => b.length - a.length);

/** 按语言显示昵称：韩文环境把已知的中文默认前缀 / 陪练名换成韩文；其它昵称原样返回 */
export function localizeName(nickname: string | null | undefined, locale: 'zh' | 'ko'): string {
  if (!nickname) return '';
  if (locale !== 'ko') return nickname;
  const direct = zhToKo.get(nickname);
  if (direct) return direct;
  for (const p of prefixes) {
    if (nickname.startsWith(p) && /^\d{0,6}$/.test(nickname.slice(p.length))) return zhToKo.get(p)! + nickname.slice(p.length);
  }
  return nickname;
}
