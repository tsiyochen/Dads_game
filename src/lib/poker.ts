/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Suit {
  Club = 1,
  Diamond = 2,
  Heart = 3,
  Spade = 4,
}

export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export enum HandType {
  HighCard = 1,
  OnePair = 2,
  TwoPair = 3,
  ThreeOfAKind = 4,
  Straight = 5,
  Flush = 6,
  FullHouse = 7,
  FourOfAKind = 8,
  StraightFlush = 9,
}

export interface HandResult {
  type: HandType;
  score: number; // Base score for comparison
  cards: Card[];
  description: string;
}

// Special Patterns (Taiwanese 13 Cards)
export enum SpecialPattern {
  None = 0,
  ThreeFlushes = 1, // 三同花
  ThreeStraights = 2, // 三順子
  SixPairs = 3, // 六對半
  Dragon = 4, // 一條龍
}

export function getCardName(card: Card): string {
  const suits = { [Suit.Club]: '♣', [Suit.Diamond]: '♦', [Suit.Heart]: '♥', [Suit.Spade]: '♠' };
  const ranks = {
    [Rank.Two]: '2', [Rank.Three]: '3', [Rank.Four]: '4', [Rank.Five]: '5',
    [Rank.Six]: '6', [Rank.Seven]: '7', [Rank.Eight]: '8', [Rank.Nine]: '9',
    [Rank.Ten]: '10', [Rank.Jack]: 'J', [Rank.Queen]: 'Q', [Rank.King]: 'K', [Rank.Ace]: 'A'
  };
  return `${suits[card.suit]}${ranks[card.rank]}`;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of [Suit.Club, Suit.Diamond, Suit.Heart, Suit.Spade]) {
    for (const rank of Object.values(Rank).filter(v => typeof v === 'number') as Rank[]) {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function evaluateHand(cards: Card[]): HandResult {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const isFlush = cards.length === 5 && cards.every(c => c.suit === cards[0].suit);
  
  // Straight check (including A2345)
  let isStraight = false;
  let straightHigh = 0;
  if (cards.length === 5) {
    const ranks = sorted.map(c => c.rank);
    const uniqueRanks = Array.from(new Set(ranks));
    if (uniqueRanks.length === 5) {
      if (ranks[0] - ranks[4] === 4) {
        isStraight = true;
        straightHigh = ranks[0];
      } else if (ranks[0] === Rank.Ace && ranks[1] === Rank.Five && ranks[4] === Rank.Two) {
        // A2345
        isStraight = true;
        straightHigh = Rank.Five;
      }
    }
  }

  if (isFlush && isStraight) {
    return { type: HandType.StraightFlush, score: 9000000 + straightHigh, cards: sorted, description: '同花順' };
  }

  const counts: Record<number, number> = {};
  cards.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
  const countEntries = Object.entries(counts).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));

  // Four of a kind
  if (countEntries[0][1] === 4) {
    return { type: HandType.FourOfAKind, score: 8000000 + Number(countEntries[0][0]) * 100, cards: sorted, description: '鐵支' };
  }

  // Full house
  if (countEntries[0][1] === 3 && countEntries[1]?.[1] === 2) {
    return { type: HandType.FullHouse, score: 7000000 + Number(countEntries[0][0]) * 100 + Number(countEntries[1][0]), cards: sorted, description: '葫蘆' };
  }

  if (isFlush) {
    return { type: HandType.Flush, score: 6000000 + sorted[0].rank * 10000 + sorted[1].rank * 100 + sorted[2].rank, cards: sorted, description: '同花' };
  }

  if (isStraight) {
    return { type: HandType.Straight, score: 5000000 + straightHigh, cards: sorted, description: '順子' };
  }

  // Three of a kind
  if (countEntries[0][1] === 3) {
    return { type: HandType.ThreeOfAKind, score: 4000000 + Number(countEntries[0][0]) * 100, cards: sorted, description: '三條' };
  }

  // Two pair
  if (countEntries[0][1] === 2 && countEntries[1]?.[1] === 2) {
    return { type: HandType.TwoPair, score: 3000000 + Number(countEntries[0][0]) * 10000 + Number(countEntries[1][0]) * 100 + Number(countEntries[2]?.[0] || 0), cards: sorted, description: '兩對' };
  }

  // One pair
  if (countEntries[0][1] === 2) {
    return { type: HandType.OnePair, score: 2000000 + Number(countEntries[0][0]) * 10000 + sorted.reduce((acc, c) => acc + c.rank, 0), cards: sorted, description: '對子' };
  }

  return { type: HandType.HighCard, score: 1000000 + sorted[0].rank * 10000 + sorted[1].rank * 100 + (sorted[2]?.rank || 0), cards: sorted, description: '烏龍' };
}

export function getBustReason(front: Card[], middle: Card[], back: Card[]): string | null {
  if (front.length !== 3 || middle.length !== 5 || back.length !== 5) return null;
  
  const f = evaluateHand(front);
  const m = evaluateHand(middle);
  const b = evaluateHand(back);
  
  if (b.score < m.score) {
    return `後墩 (${b.description}) 小於 中墩 (${m.description})`;
  }
  if (m.score < f.score) {
    return `中墩 (${m.description}) 小於 前墩 (${f.description})`;
  }
  return null;
}

export function checkBust(front: Card[], middle: Card[], back: Card[]): boolean {
  return getBustReason(front, middle, back) !== null;
}

export function checkSpecialPattern(allCards: Card[]): SpecialPattern {
  const sorted = [...allCards].sort((a, b) => a.rank - b.rank);
  const ranks = sorted.map(c => c.rank);
  const uniqueRanks = Array.from(new Set(ranks));

  // Dragon (一條龍)
  if (uniqueRanks.length === 13) return SpecialPattern.Dragon;

  // Six Pairs (六對半)
  const counts: Record<number, number> = {};
  allCards.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
  
  // In 13 cards, 6 pairs + 1 single = 13 cards.
  let totalPairs = 0;
  Object.values(counts).forEach(v => {
    totalPairs += Math.floor(v / 2);
  });
  if (totalPairs === 6) return SpecialPattern.SixPairs;

  return SpecialPattern.None;
}

export function solveBestHand(hand: Card[]): { front: Card[], middle: Card[], back: Card[] } {
  // This is still a simplified version but better than random
  const sorted = [...hand].sort((a, b) => b.rank - a.rank);
  
  // Try to find a flush or straight for the back
  // For simplicity in this demo, we'll use a greedy approach that prioritizes back > middle > front
  // but ensures no bust if possible.
  
  // We'll just use the greedy approach for now but with a bit more care
  const back = sorted.slice(0, 5);
  const middle = sorted.slice(5, 10);
  const front = sorted.slice(10, 13);

  // Simple swap to prevent bust if obvious
  const bEval = evaluateHand(back);
  const mEval = evaluateHand(middle);
  const fEval = evaluateHand(front);

  if (bEval.score < mEval.score) {
    // Swap back and middle
    return { front, middle: back, back: middle };
  }

  return { front, middle, back };
}
