/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  ChevronRight,
  User,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  Card, 
  createDeck, 
  shuffle, 
  evaluateHand, 
  checkBust, 
  getBustReason,
  HandResult, 
  getCardName,
  HandType,
  solveBestHand,
  checkSpecialPattern,
  SpecialPattern
} from './lib/poker';
import { initAudio, playWinSound, playLoseSound, playDrawSound } from './lib/sounds';
import CardComponent from './components/Card';

type GamePhase = 'START' | 'SORTING' | 'COMPARING' | 'RESULT';
type GameMode = '2_PLAYERS' | '4_PLAYERS';

interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  front: Card[];
  middle: Card[];
  back: Card[];
  score: number;
  isAI: boolean;
  special?: SpecialPattern;
}

interface ComparisonResult {
  p1Id: string;
  p2Id: string;
  p1Name: string;
  p2Name: string;
  p1Score: number;
  p2Score: number;
  p1Front: HandResult;
  p2Front: HandResult;
  p1Middle: HandResult;
  p2Middle: HandResult;
  p1Back: HandResult;
  p2Back: HandResult;
  p1Cards: { front: Card[], middle: Card[], back: Card[] };
  p2Cards: { front: Card[], middle: Card[], back: Card[] };
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('START');
  const [gameMode, setGameMode] = useState<GameMode>('2_PLAYERS');
  const [player, setPlayer] = useState<PlayerState>({
    id: 'p1',
    name: '玩家',
    hand: [],
    front: [],
    middle: [],
    back: [],
    score: 0,
    isAI: false
  });
  const [ais, setAis] = useState<PlayerState[]>([]);
  const [aiReady, setAiReady] = useState<Record<string, boolean>>({});
  const [comparisons, setComparisons] = useState<ComparisonResult[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('歡迎來到十三支！');
  const [showRules, setShowRules] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<string>('');

  // Initialize game
  const startNewGame = useCallback((modeOverride?: GameMode) => {
    initAudio();
    const deck = shuffle(createDeck());
    const currentMode = modeOverride || gameMode;
    const numPlayers = currentMode === '2_PLAYERS' ? 2 : 4;
    
    const pHand = deck.slice(0, 13);
    setPlayer(prev => ({
      ...prev,
      hand: pHand,
      front: [],
      middle: [],
      back: [],
      special: checkSpecialPattern(pHand)
    }));

    const newAis: PlayerState[] = [];
    for (let i = 1; i < numPlayers; i++) {
      const aiHand = deck.slice(i * 13, (i + 1) * 13);
      newAis.push({
        id: `ai${i}`,
        name: `電腦 ${i}`,
        hand: aiHand,
        front: [],
        middle: [],
        back: [],
        score: ais.find(a => a.id === `ai${i}`)?.score || 0,
        isAI: true,
        special: checkSpecialPattern(aiHand)
      });
    }
    setAis(newAis);
    setAiReady({});
    setComparisons([]);

    setPhase('SORTING');
    setSelectedCards([]);
    setMessage('請將手牌分配到前、中、後三墩。');
  }, [gameMode, ais]);

  // Move cards to a tier
  const moveCards = (target: 'front' | 'middle' | 'back') => {
    if (selectedCards.length === 0) return;

    const cardsToMove = player.hand.filter(c => selectedCards.includes(c.id));
    const targetLimit = target === 'front' ? 3 : 5;
    const currentCount = player[target].length;

    if (currentCount + cardsToMove.length > targetLimit) {
      setMessage(`這一墩最多只能放 ${targetLimit} 張牌！`);
      return;
    }

    setPlayer(prev => ({
      ...prev,
      hand: prev.hand.filter(c => !selectedCards.includes(c.id)),
      [target]: [...prev[target], ...cardsToMove]
    }));
    setSelectedCards([]);
  };

  // Move cards back to hand
  const moveBack = (cardId: string, from: 'front' | 'middle' | 'back') => {
    const card = player[from].find(c => c.id === cardId);
    if (!card) return;

    setPlayer(prev => ({
      ...prev,
      [from]: prev[from].filter(c => c.id !== cardId),
      hand: [...prev.hand, card]
    }));
  };

  // Independent Reset for each tier
  const resetTier = (tier: 'front' | 'middle' | 'back') => {
    setPlayer(prev => ({
      ...prev,
      hand: [...prev.hand, ...prev[tier]],
      [tier]: []
    }));
  };

  const bustReason = useMemo(() => {
    if (player.front.length === 3 && player.middle.length === 5 && player.back.length === 5) {
      return getBustReason(player.front, player.middle, player.back);
    }
    return null;
  }, [player.front, player.middle, player.back]);

  const isBust = bustReason !== null;

  const handleSubmit = () => {
    initAudio();
    if (player.front.length !== 3 || player.middle.length !== 5 || player.back.length !== 5) {
      setMessage('請先分好所有牌！');
      return;
    }

    if (isBust) {
      setMessage(`擺烏龍了！${bustReason}`);
      return;
    }

    // AI sorts its hand
    setAis(prev => prev.map(ai => {
      const aiSorted = solveBestHand(ai.hand);
      return {
        ...ai,
        ...aiSorted,
        hand: []
      };
    }));

    setPhase('COMPARING');
  };

  const calculateResults = () => {
    const allPlayers = [player, ...ais];
    const results: ComparisonResult[] = [];
    const playerScores: Record<string, number> = { [player.id]: 0 };
    ais.forEach(ai => { playerScores[ai.id] = 0; });

    for (let i = 0; i < allPlayers.length; i++) {
      for (let j = i + 1; j < allPlayers.length; j++) {
        const p1 = allPlayers[i];
        const p2 = allPlayers[j];

        const p1F = evaluateHand(p1.front);
        const p1M = evaluateHand(p1.middle);
        const p1B = evaluateHand(p1.back);

        const p2F = evaluateHand(p2.front);
        const p2M = evaluateHand(p2.middle);
        const p2B = evaluateHand(p2.back);

        let s1 = 0;
        let s2 = 0;

        // Special Patterns check
        if (p1.special && p1.special !== SpecialPattern.None) {
          if (p1.special === SpecialPattern.Dragon) s1 += 100;
          if (p1.special === SpecialPattern.SixPairs) s1 += 20;
        }
        if (p2.special && p2.special !== SpecialPattern.None) {
          if (p2.special === SpecialPattern.Dragon) s2 += 100;
          if (p2.special === SpecialPattern.SixPairs) s2 += 20;
        }

        // Front
        if (p1F.score > p2F.score) s1++; else if (p1F.score < p2F.score) s2++;
        // Middle
        if (p1M.score > p2M.score) s1++; else if (p1M.score < p2M.score) s2++;
        // Back
        if (p1B.score > p2B.score) s1++; else if (p1B.score < p2B.score) s2++;

        // Shoot (打槍)
        if (s1 >= 3) s1 *= 2;
        if (s2 >= 3) s2 *= 2;

        // Bonus points (Taiwanese style)
        if (p1F.type === HandType.ThreeOfAKind) s1 += 3;
        if (p2F.type === HandType.ThreeOfAKind) s2 += 3;
        if (p1M.type === HandType.FullHouse) s1 += 2;
        if (p2M.type === HandType.FullHouse) s2 += 2;

        const diff = s1 - s2;
        playerScores[p1.id] += diff;
        playerScores[p2.id] -= diff;

        results.push({
          p1Id: p1.id,
          p2Id: p2.id,
          p1Name: p1.name,
          p2Name: p2.name,
          p1Score: s1,
          p2Score: s2,
          p1Front: p1F,
          p2Front: p2F,
          p1Middle: p1M,
          p2Middle: p2M,
          p1Back: p1B,
          p2Back: p2B,
          p1Cards: { front: p1.front, middle: p1.middle, back: p1.back },
          p2Cards: { front: p2.front, middle: p2.middle, back: p2.back }
        });
      }
    }

    const totalPlayerDiff = playerScores[player.id];
    if (totalPlayerDiff > 0) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      setMessage(`恭喜！你贏了 ${totalPlayerDiff} 分！`);
      playWinSound();
    } else if (totalPlayerDiff < 0) {
      setMessage(`可惜！你輸了 ${Math.abs(totalPlayerDiff)} 分。`);
      playLoseSound();
    } else {
      setMessage('平手！');
      playDrawSound();
    }

    setPlayer(prev => ({ ...prev, score: prev.score + playerScores[prev.id] }));
    setAis(prev => prev.map(ai => ({ ...ai, score: ai.score + playerScores[ai.id] })));
    
    // Only show comparisons involving the player
    const playerComparisons = results.filter(r => r.p1Id === player.id || r.p2Id === player.id);
    setComparisons(playerComparisons);
    if (playerComparisons.length > 0) {
      setActiveResultTab(playerComparisons[0].p2Id);
    }
    setPhase('RESULT');
  };

  useEffect(() => {
    if (phase === 'SORTING') {
      ais.forEach(ai => {
        const delay = 2000 + Math.random() * 3000; // 2-5 seconds
        setTimeout(() => {
          setAiReady(prev => ({ ...prev, [ai.id]: true }));
        }, delay);
      });
    }
  }, [phase, ais]);

  useEffect(() => {
    if (phase === 'COMPARING') {
      const timer = setTimeout(() => {
        calculateResults();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const toggleSelect = (id: string) => {
    setSelectedCards(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      // If already 5 cards selected, remove the first one and add the new one
      if (prev.length >= 5) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  return (
    <div className="h-screen h-[100dvh] bg-[#062c1e] text-emerald-50 p-2 md:p-4 font-sans selection:bg-yellow-500/30 relative overflow-hidden flex flex-col items-center">
      {/* Table Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,_#0a4d36_0%,_transparent_70%)] opacity-40" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-20" />
      </div>

      <div className="max-w-[1400px] w-full h-full relative z-10 flex flex-col">
        {/* Header - More Compact */}
        <header className="w-full flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500 p-2 rounded shadow-lg">
              <Trophy className="text-emerald-900 w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tighter">
              十三支
            </h1>
          </div>
          
          <div className="flex gap-2 items-center">
            <div className="bg-emerald-800/50 px-3 py-1 rounded-full border border-emerald-700/50 flex items-center gap-3">
              <div className="flex items-center gap-2" title="玩家總分">
                <User className="w-5 h-5 text-blue-400" />
                <span className="font-mono font-black text-lg md:text-xl">{player.score}</span>
              </div>
              <div className="w-px h-4 bg-emerald-700/50" />
              <div className="flex items-center gap-2" title="電腦總分 (平均)">
                <Cpu className="w-5 h-5 text-red-400" />
                <span className="font-mono font-black text-lg md:text-xl">
                  {ais.length > 0 ? Math.round(ais.reduce((sum, a) => sum + a.score, 0) / ais.length) : 0}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setShowRules(!showRules)}
              className="p-2 hover:bg-emerald-800 rounded-full transition-colors"
            >
              <Info className="w-6 h-6 md:w-8 md:h-8" />
            </button>
          </div>
        </header>

        {/* Main Game Area */}
        <main className="w-full flex-1 flex flex-col gap-4 overflow-hidden">
        {phase === 'START' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-10">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-4"
            >
              <h2 className="text-6xl md:text-8xl font-black text-yellow-500 drop-shadow-2xl">
                正宗台灣玩法
              </h2>
              <p className="text-2xl md:text-3xl text-emerald-200 font-bold">
                挑戰電腦，展現你的理牌智慧
              </p>
            </motion.div>

            <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
              <button 
                onClick={() => { setGameMode('2_PLAYERS'); startNewGame('2_PLAYERS'); }}
                className="flex-1 group relative px-8 py-8 bg-emerald-800/50 text-white border-4 border-emerald-700 hover:border-yellow-500 rounded-3xl transition-all flex flex-col items-center gap-4 hover:bg-emerald-800"
              >
                <div className="flex gap-4 items-center">
                  <User className="w-12 h-12 text-blue-400" />
                  <div className="text-2xl font-black text-emerald-500">對決</div>
                  <Cpu className="w-12 h-12 text-red-400" />
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black">兩人對戰</div>
                  <div className="text-xl text-emerald-400 font-bold mt-2">1 玩家 vs 1 電腦</div>
                </div>
              </button>

              <button 
                onClick={() => { setGameMode('4_PLAYERS'); startNewGame('4_PLAYERS'); }}
                className="flex-1 group relative px-8 py-8 bg-emerald-800/50 text-white border-4 border-emerald-700 hover:border-yellow-500 rounded-3xl transition-all flex flex-col items-center gap-4 hover:bg-emerald-800"
              >
                <div className="flex gap-4 items-center">
                  <User className="w-12 h-12 text-blue-400" />
                  <div className="text-2xl font-black text-emerald-500">對決</div>
                  <div className="flex -space-x-4">
                    <Cpu className="w-12 h-12 text-red-400" />
                    <Cpu className="w-12 h-12 text-red-500" />
                    <Cpu className="w-12 h-12 text-red-600" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black">四人混戰</div>
                  <div className="text-xl text-emerald-400 font-bold mt-2">1 玩家 vs 3 電腦</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {(phase === 'SORTING' || phase === 'COMPARING' || phase === 'RESULT') && (
          <div className="w-full flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Scrollable Top/Middle Area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-2 flex flex-col gap-4">
              {/* Top Section: Opponents "Sitting" at the Table - More Compact */}
              <div className="flex flex-wrap justify-center gap-4 md:gap-8 py-2 shrink-0">
                {ais.map((ai) => (
                <motion.div 
                  key={ai.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="relative">
                    {/* Avatar Circle */}
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-emerald-900 to-emerald-950 border-4 border-emerald-700/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.4)] group-hover:border-emerald-500 transition-colors overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-30" />
                      <Cpu className="w-8 h-8 md:w-10 md:h-10 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    
                    {/* Status Badge */}
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-950 border-2 border-emerald-800 flex items-center justify-center shadow-lg">
                      {phase === 'SORTING' && !aiReady[ai.id] ? (
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
                      )}
                    </div>

                    {/* Thinking Bubble (Only in SORTING) */}
                    {phase === 'SORTING' && !aiReady[ai.id] && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-10 -right-16 bg-white text-emerald-900 px-4 py-2 rounded-full text-sm font-black shadow-xl border-2 border-emerald-100 hidden md:block"
                      >
                        思考中...
                        <div className="absolute -bottom-2 left-4 w-3 h-3 bg-white rotate-45 border-r-2 border-b-2 border-emerald-100" />
                      </motion.div>
                    )}
                    {phase === 'SORTING' && aiReady[ai.id] && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-10 -right-16 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-black shadow-xl border-2 border-emerald-400 hidden md:block"
                      >
                        已準備！
                        <div className="absolute -bottom-2 left-4 w-3 h-3 bg-emerald-500 rotate-45 border-r-2 border-b-2 border-emerald-400" />
                      </motion.div>
                    )}
                  </div>

                  <div className="text-center">
                    <div className="text-base md:text-lg font-black text-emerald-100 drop-shadow-sm">{ai.name}</div>
                    <div className="text-sm md:text-base font-bold text-emerald-500 font-mono">{ai.score} 分</div>
                    
                    {/* Hidden Cards Visual */}
                    <div className="mt-2 flex -space-x-4 justify-center">
                      {[1, 2, 3].map(i => (
                        <div 
                          key={i} 
                          className="w-6 h-8 md:w-8 md:h-10 bg-emerald-800 rounded-sm border-2 border-emerald-700 shadow-sm flex-shrink-0 transform rotate-[-5deg] group-hover:rotate-0 transition-transform"
                          style={{ transform: `rotate(${(i-2)*5}deg)` }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Message & Controls Section - More Compact */}
            <div className="w-full max-w-4xl mx-auto space-y-4 shrink-0">
              <div className="bg-emerald-950/60 p-4 md:p-6 rounded-3xl border border-emerald-800/50 shadow-2xl flex flex-col gap-4">
                  <div className="flex items-center gap-4 border-b border-emerald-800/30 pb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-emerald-900 flex items-center justify-center border-2 border-emerald-700">
                      <Info className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs md:text-sm font-bold text-emerald-500 uppercase tracking-widest">系統廣播</div>
                      <p className="text-xl md:text-2xl font-black text-emerald-100 leading-relaxed">
                        {message}
                      </p>
                    </div>
                  </div>

                  {phase === 'COMPARING' && (
                    <div className="w-full py-8 bg-emerald-950/60 rounded-3xl border-2 border-yellow-500/30 shadow-2xl flex flex-col items-center gap-4 text-center animate-pulse">
                      <div className="bg-yellow-500/10 p-4 rounded-full">
                        <RotateCcw className="w-10 h-10 text-yellow-500 animate-spin" />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                        比牌中...
                      </h2>
                      <p className="text-emerald-200 text-lg md:text-xl font-bold opacity-80">正在計算各墩勝負，請稍候</p>
                    </div>
                  )}

                  {phase === 'RESULT' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full p-6 bg-emerald-950/60 rounded-3xl border-2 border-yellow-500/30 shadow-2xl flex flex-col items-center gap-6 text-center"
                    >
                      <div className="flex flex-col md:flex-row items-center gap-6 w-full justify-center">
                        <div className="flex items-center gap-4">
                          <div className="bg-yellow-500/10 p-4 rounded-full">
                            <Trophy className="w-10 h-10 text-yellow-500" />
                          </div>
                          <div className="text-left">
                            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                              {message.includes('贏') ? '大獲全勝！' : message.includes('輸') ? '下次再戰！' : '不分伯仲！'}
                            </h2>
                            <p className="text-emerald-200 text-lg md:text-xl font-bold opacity-80 mt-1">{message}</p>
                          </div>
                        </div>
                        <button 
                          onClick={startNewGame}
                          className="md:ml-auto w-full md:w-auto px-8 py-4 bg-yellow-500 text-emerald-900 rounded-2xl font-black text-xl md:text-2xl shadow-[0_6px_0_rgb(180,130,0)] hover:translate-y-1 hover:shadow-[0_2px_0_rgb(180,130,0)] active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-3 group"
                        >
                          再來一局
                          <RotateCcw className="w-6 h-6 md:w-8 md:h-8 group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Tabbed Comparison Results */}
                {phase === 'RESULT' && comparisons.length > 0 && (
                  <div className="bg-emerald-900/40 p-4 rounded-3xl border border-emerald-800/50 shadow-inner overflow-hidden w-full space-y-4">
                    {/* Tabs */}
                    <div className="flex flex-nowrap gap-2 border-b border-emerald-800/30 pb-2 overflow-x-auto scrollbar-hide">
                      {comparisons.map((comp) => (
                        <button
                          key={comp.p2Id}
                          type="button"
                          onClick={() => {
                            console.log('Switching to tab:', comp.p2Id);
                            setActiveResultTab(comp.p2Id);
                          }}
                          className={`px-6 py-3 rounded-t-xl font-black text-base md:text-xl transition-all whitespace-nowrap
                            ${activeResultTab === comp.p2Id 
                              ? 'bg-yellow-500 text-emerald-900 shadow-lg' 
                              : 'bg-emerald-800/50 text-emerald-400 hover:bg-emerald-700/50'}
                          `}
                        >
                          對戰 {comp.p2Name}
                        </button>
                      ))}
                    </div>

                    {/* Active Tab Content */}
                    {comparisons.filter(c => c.p2Id === activeResultTab).map((comp) => (
                      <div key={comp.p2Id} className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {[
                          { title: '前墩 (3張)', p1: comp.p1Front, p2: comp.p2Front, p1Cards: comp.p1Cards.front, p2Cards: comp.p2Cards.front },
                          { title: '中墩 (5張)', p1: comp.p1Middle, p2: comp.p2Middle, p1Cards: comp.p1Cards.middle, p2Cards: comp.p2Cards.middle },
                          { title: '後墩 (5張)', p1: comp.p1Back, p2: comp.p2Back, p1Cards: comp.p1Cards.back, p2Cards: comp.p2Cards.back }
                        ].map((tier, i) => (
                          <div key={i} className="bg-emerald-950/70 p-4 md:p-6 rounded-2xl border border-emerald-800/50 flex flex-col gap-4 md:gap-6 shadow-xl">
                            <div className="flex justify-between items-center border-b border-emerald-800/30 pb-3">
                              <span className="text-sm md:text-base font-black text-emerald-400 tracking-widest">{tier.title}</span>
                              <div className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-black shadow-lg ${tier.p1.score > tier.p2.score ? 'bg-yellow-500 text-emerald-900' : tier.p1.score < tier.p2.score ? 'bg-red-500 text-white' : 'bg-emerald-700 text-emerald-100'}`}>
                                {tier.p1.score > tier.p2.score ? '勝' : tier.p1.score < tier.p2.score ? '敗' : '平'}
                              </div>
                            </div>
                            <div className="space-y-4 md:space-y-6">
                              <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                  <div className="text-xs md:text-sm font-black text-emerald-500">{comp.p1Name}</div>
                                  <div className="text-sm md:text-base font-black text-yellow-500">{tier.p1.description}</div>
                                </div>
                                <div className="flex -space-x-8 md:-space-x-6 h-20 md:h-24 items-center justify-center">
                                  {tier.p1Cards.map(c => <CardComponent key={c.id} card={c} className="scale-[0.7] md:scale-[0.8] origin-center shadow-lg" disabled />)}
                                </div>
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-emerald-800/30"></div></div>
                              </div>
                              <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                  <div className="text-xs md:text-sm font-black text-emerald-500">{comp.p2Name}</div>
                                  <div className="text-sm md:text-base font-black text-emerald-400">{tier.p2.description}</div>
                                </div>
                                <div className="flex -space-x-8 md:-space-x-6 h-20 md:h-24 items-center justify-center">
                                  {tier.p2Cards.map(c => <CardComponent key={c.id} card={c} className="scale-[0.7] md:scale-[0.8] origin-center shadow-lg" disabled />)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Player's Workspace (Sorting Tiers & Hand Area) - More Compact */}
            {phase !== 'RESULT' && (
              <div className="bg-emerald-950/40 p-4 md:p-6 rounded-3xl border border-emerald-800/50 backdrop-blur-sm shadow-2xl w-full flex flex-col gap-4 shrink-0 overflow-y-auto max-h-[60vh] md:max-h-none">
                {/* Top: Sorting Area (Horizontal tiers) */}
                <div className="space-y-3">

                <div className="flex justify-between items-center">
                  <h3 className="text-xl md:text-2xl font-black text-emerald-200 flex items-center gap-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    理牌區域
                  </h3>
                  {isBust && (
                    <div className="flex items-center gap-2 text-red-400 font-black animate-pulse text-base md:text-xl bg-red-950/50 px-4 py-2 rounded-xl border border-red-800">
                      <AlertTriangle className="w-6 h-6" />
                      擺烏龍！ <span className="text-sm md:text-base text-red-200 font-bold">{bustReason}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
                  {/* Front Tier */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-2">
                      <div className="text-sm md:text-base font-black text-emerald-400 tracking-widest">前墩 (3張)</div>
                      <button onClick={(e) => { e.stopPropagation(); resetTier('front'); }} className="text-xs md:text-sm bg-emerald-800/50 hover:bg-emerald-700/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-bold"><RotateCcw className="w-3 h-3 md:w-4 md:h-4" /> 重設</button>
                    </div>
                    <div onClick={() => moveCards('front')} className="min-h-[100px] md:min-h-[140px] bg-emerald-950/40 rounded-2xl border-4 border-dashed border-emerald-700/50 flex justify-center items-center gap-1 p-2 transition-all hover:bg-emerald-800/30 cursor-pointer overflow-hidden shadow-inner">
                      <div className="flex -space-x-8 md:-space-x-12">
                        {player.front.map(c => <CardComponent key={c.id} card={c} onClick={() => moveBack(c.id, 'front')} className="scale-[0.7] md:scale-[0.8] shadow-lg origin-center hover:z-50 transition-transform" />)}
                      </div>
                      {player.front.length === 0 && <div className="text-emerald-700 font-black opacity-50 text-xl md:text-2xl">前墩</div>}
                    </div>
                  </div>

                  {/* Middle Tier */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-2">
                      <div className="text-sm md:text-base font-black text-emerald-400 tracking-widest">中墩 (5張)</div>
                      <button onClick={(e) => { e.stopPropagation(); resetTier('middle'); }} className="text-xs md:text-sm bg-emerald-800/50 hover:bg-emerald-700/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-bold"><RotateCcw className="w-3 h-3 md:w-4 md:h-4" /> 重設</button>
                    </div>
                    <div onClick={() => moveCards('middle')} className="min-h-[100px] md:min-h-[140px] bg-emerald-950/40 rounded-2xl border-4 border-dashed border-emerald-700/50 flex justify-center items-center gap-1 p-2 transition-all hover:bg-emerald-800/30 cursor-pointer overflow-hidden shadow-inner">
                      <div className="flex -space-x-10 md:-space-x-14">
                        {player.middle.map(c => <CardComponent key={c.id} card={c} onClick={() => moveBack(c.id, 'middle')} className="scale-[0.7] md:scale-[0.8] shadow-lg origin-center hover:z-50 transition-transform" />)}
                      </div>
                      {player.middle.length === 0 && <div className="text-emerald-700 font-black opacity-50 text-xl md:text-2xl">中墩</div>}
                    </div>
                  </div>

                  {/* Back Tier */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-2">
                      <div className="text-sm md:text-base font-black text-emerald-400 tracking-widest">後墩 (5張)</div>
                      <button onClick={(e) => { e.stopPropagation(); resetTier('back'); }} className="text-xs md:text-sm bg-emerald-800/50 hover:bg-emerald-700/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-bold"><RotateCcw className="w-3 h-3 md:w-4 md:h-4" /> 重設</button>
                    </div>
                    <div onClick={() => moveCards('back')} className="min-h-[100px] md:min-h-[140px] bg-emerald-950/40 rounded-2xl border-4 border-dashed border-emerald-700/50 flex justify-center items-center gap-1 p-2 transition-all hover:bg-emerald-800/30 cursor-pointer overflow-hidden shadow-inner">
                      <div className="flex -space-x-10 md:-space-x-14">
                        {player.back.map(c => <CardComponent key={c.id} card={c} onClick={() => moveBack(c.id, 'back')} className="scale-[0.7] md:scale-[0.8] shadow-lg origin-center hover:z-50 transition-transform" />)}
                      </div>
                      {player.back.length === 0 && <div className="text-emerald-700 font-black opacity-50 text-xl md:text-2xl">後墩</div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Hand Area & Controls */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-900 to-blue-950 border-4 border-blue-500/50 flex items-center justify-center shadow-xl">
                        <User className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-950 border-2 border-emerald-800 flex items-center justify-center shadow-md">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm md:text-base font-black text-emerald-100 tracking-widest opacity-80">你的座位</div>
                      <div className="text-lg md:text-2xl font-black text-blue-400 font-mono tracking-tighter">{player.score} 分</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 md:gap-4">
                    <button 
                      onClick={() => {
                        setPlayer(prev => ({
                          ...prev,
                          hand: [...prev.hand, ...prev.front, ...prev.middle, ...prev.back],
                          front: [],
                          middle: [],
                          back: []
                        }));
                      }}
                      className="text-sm md:text-lg bg-emerald-800/50 hover:bg-emerald-700/50 px-4 py-2 md:px-6 md:py-3 rounded-2xl transition-colors flex items-center gap-2 font-black border-2 border-emerald-700/30"
                    >
                      <RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> 全部重設
                    </button>

                    {phase === 'SORTING' && (
                      <button 
                        onClick={handleSubmit}
                        disabled={player.hand.length > 0 || isBust}
                        className={`px-8 py-2 md:px-12 md:py-3 rounded-2xl font-black text-xl md:text-2xl shadow-xl transition-all flex items-center justify-center gap-3
                          ${(player.hand.length > 0 || isBust) 
                            ? 'bg-emerald-800 text-emerald-600 cursor-not-allowed grayscale' 
                            : 'bg-yellow-500 text-emerald-900 hover:scale-[1.02] active:scale-95 shadow-yellow-500/30'}
                        `}
                      >
                        確認出牌
                        <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="bg-emerald-950/40 p-4 md:p-6 rounded-3xl border-2 border-emerald-800/30 min-h-[140px] md:min-h-[220px] flex items-center justify-start overflow-x-auto overflow-y-hidden scrollbar-hide shadow-inner">
                  <div className="flex flex-nowrap justify-center items-center px-4 md:px-8 min-w-full">
                    <AnimatePresence mode="popLayout">
                      {player.hand.sort((a, b) => b.rank - a.rank).map((c, index) => {
                        const isSelected = selectedCards.includes(c.id);
                        return (
                          <motion.div 
                            key={c.id} 
                            layout
                            initial={{ opacity: 0, y: 30, rotate: -10 }}
                            animate={{ 
                              opacity: 1, 
                              y: isSelected ? -30 : 0,
                              rotate: 0,
                              zIndex: index 
                            }}
                            exit={{ opacity: 0, scale: 0.5, y: -50 }}
                            whileHover={{ y: isSelected ? -40 : -15, zIndex: 50 }}
                            className="relative -ml-6 sm:-ml-8 md:-ml-12 first:ml-0"
                          >
                            <CardComponent 
                              card={c} 
                              selected={isSelected}
                              onClick={() => toggleSelect(c.id)}
                              className={`
                                shadow-2xl transition-all duration-300
                                scale-[0.8] sm:scale-[0.9] md:scale-100
                                ${isSelected ? 'shadow-blue-500/50 ring-4 ring-blue-400/60' : 'hover:shadow-emerald-500/30'}
                              `}
                            />
                            {isSelected && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1 shadow-xl z-50"
                              >
                                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {player.hand.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center text-emerald-700 font-black opacity-40 h-full min-h-[120px]">
                        <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 mb-2" />
                        <span className="text-xl md:text-2xl">手牌已全部分配</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
      </main>
    </div>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRules(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-emerald-950 border border-emerald-800 p-8 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-4xl font-black text-yellow-500 mb-8">遊戲規則</h2>
              <div className="space-y-8 text-emerald-100 text-lg md:text-xl">
                <section>
                  <h3 className="text-2xl font-black text-emerald-300 mb-3">1. 基礎架構</h3>
                  <p>每位玩家發 13 張牌，分為三墩：</p>
                  <ul className="list-disc list-inside ml-4 mt-3 space-y-2 font-bold">
                    <li>前墩：3 張</li>
                    <li>中墩：5 張</li>
                    <li>後墩：5 張</li>
                  </ul>
                </section>
                <section>
                  <h3 className="text-2xl font-black text-emerald-300 mb-3">2. 擺放限制 (核心邏輯)</h3>
                  <p className="text-yellow-500 font-black text-2xl bg-emerald-900/50 p-4 rounded-xl border border-yellow-500/30 text-center">後墩強度 ≥ 中墩強度 ≥ 前墩強度</p>
                  <p className="mt-3 font-bold">若違反此順序即為「擺烏龍」，該局直接判定全輸。</p>
                </section>
                <section>
                  <h3 className="text-2xl font-black text-emerald-300 mb-3">3. 牌型等級</h3>
                  <p className="font-bold leading-relaxed">同花順 &gt; 鐵支 &gt; 葫蘆 &gt; 同花 &gt; 順子 &gt; 三條 &gt; 兩對 &gt; 對子 &gt; 烏龍</p>
                  <p className="text-base text-emerald-400 mt-3">*前墩最大牌型為「三條」。</p>
                </section>
                <section>
                  <h3 className="text-2xl font-black text-emerald-300 mb-3">4. 台灣特色加分</h3>
                  <ul className="list-disc list-inside ml-4 space-y-2 font-bold">
                    <li>衝三（前墩三條）：+3 注</li>
                    <li>中墩葫蘆：+2 注</li>
                    <li>打槍（三墩全勝）：分數 x2</li>
                  </ul>
                </section>
              </div>
              <button 
                onClick={() => setShowRules(false)}
                className="mt-10 w-full py-6 bg-emerald-800 hover:bg-emerald-700 rounded-2xl font-black text-2xl transition-colors"
              >
                我瞭解了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-12 text-emerald-600 text-sm font-medium">
        © 2026 正宗十三支 · 策略理牌遊戲
      </footer>
    </div>
  );
}
