import { localizeName } from '@yanbian/game-common/names';
import { currentLocale } from './index.js';

/** 昵称按当前语言显示（默认昵称 / 陪练名中韩映射；玩家自改昵称原样） */
export function displayName(nickname: string | null | undefined): string {
  return localizeName(nickname, currentLocale.value);
}
