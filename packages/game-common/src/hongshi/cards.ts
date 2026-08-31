/**
 * 扑克牌编码：card = suit*13 + (rank-1)
 * suit: 0=方块♦ 1=梅花♣ 2=红桃♥ 3=黑桃♠ ； rank: 1(A)..13(K)
 */
export type Card = number;

export const suitOf = (c: Card): number => Math.floor(c / 13);
export const rankOf = (c: Card): number => (c % 13) + 1;
export const makeCard = (suit: number, rank: number): Card => suit * 13 + (rank - 1);

export const SUIT_DIAMOND = 0;
export const SUIT_CLUB = 1;
export const SUIT_HEART = 2;
export const SUIT_SPADE = 3;

const SUIT_SYM = ['♦', '♣', '♥', '♠'];
const RANK_SYM = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const cardName = (c: Card): string => `${SUIT_SYM[suitOf(c)]}${RANK_SYM[rankOf(c) - 1]}`;

export function buildDeck(deckCount: number, removeJokers = true): Card[] {
  void removeJokers; // 本编码不含王牌；双副直接重复
  const cards: Card[] = [];
  for (let d = 0; d < deckCount; d += 1) {
    for (let c = 0; c < 52; c += 1) cards.push(c);
  }
  return cards;
}
