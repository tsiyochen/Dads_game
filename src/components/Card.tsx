/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Card, Suit, Rank } from '../lib/poker';

interface CardProps {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}

const CardComponent: React.FC<CardProps> = ({ card, onClick, selected, disabled, className }) => {
  const isRed = card.suit === Suit.Heart || card.suit === Suit.Diamond;
  
  const getSuitIcon = (suit: Suit) => {
    switch (suit) {
      case Suit.Club: return '♣';
      case Suit.Diamond: return '♦';
      case Suit.Heart: return '♥';
      case Suit.Spade: return '♠';
    }
  };

  const getRankLabel = (rank: Rank) => {
    switch (rank) {
      case Rank.Ten: return '10';
      case Rank.Jack: return 'J';
      case Rank.Queen: return 'Q';
      case Rank.King: return 'K';
      case Rank.Ace: return 'A';
      default: return rank.toString();
    }
  };

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={!disabled ? onClick : undefined}
      className={`
        relative w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 
        bg-white rounded-lg shadow-md border-2 
        flex flex-col justify-between p-2 cursor-pointer select-none
        ${selected ? 'border-blue-500 ring-4 ring-blue-200' : 'border-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <div className={`text-2xl sm:text-3xl font-black flex flex-col items-start leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        <span>{getRankLabel(card.rank)}</span>
        <span className="text-xl sm:text-2xl">{getSuitIcon(card.suit)}</span>
      </div>
      
      <div className={`absolute inset-0 flex items-center justify-center opacity-15 text-5xl sm:text-7xl ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        {getSuitIcon(card.suit)}
      </div>

      <div className={`text-2xl sm:text-3xl font-black flex flex-col items-end leading-none self-end rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
        <span>{getRankLabel(card.rank)}</span>
        <span className="text-xl sm:text-2xl">{getSuitIcon(card.suit)}</span>
      </div>
    </motion.div>
  );
};

export default CardComponent;
