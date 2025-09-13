// src/pages/Index.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import WalletButton from '@/components/WalletButton';
import Leaderboard from '@/components/Leaderboard';
import { LeaderboardManager } from '@/lib/leaderboard';
import { TournamentManager } from '@/lib/tournament';
import { formatTime, shuffleArray } from '@/lib/utils';

// ✅ NetworkBadge component
const NetworkBadge: React.FC = () => {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || '';
  return (
    <div className="inline-flex items-center gap-3 p-2 rounded-md text-sm bg-muted/30">
      <span className="font-medium">App Network:</span>
      <span className="font-bold">{network}</span>
      {endpoint ? <span className="opacity-70 truncate max-w-xs">{endpoint.replace(/^https?:\/\//, '')}</span> : null}
    </div>
  );
};

// ✅ Types
interface CardType {
  id: number;
  imageUrl: string;
  isFlipped: boolean;
  isMatched: boolean;
}

// ✅ Difficulty settings
const DIFFICULTY_SETTINGS = {
  easy: { cardPairs: 6, timeLimit: 120 },
  medium: { cardPairs: 8, timeLimit: 180 },
  hard: { cardPairs: 12, timeLimit: 240 },
};

// ✅ Asset URLs (import.meta.url)
const CARD_SETS = {
  set1: Array.from({ length: 12 }, (_, i) =>
    new URL(`../assets/images/cards/set1_${i + 1}.png`, import.meta.url).href
  ),
  set2: Array.from({ length: 12 }, (_, i) =>
    new URL(`../assets/images/cards/set2_${i + 1}.png`, import.meta.url).href
  ),
};
const CARD_BACK_URL = new URL('../assets/images/cards/card-back.png', import.meta.url).href;
const BACKGROUND_URL = new URL('../assets/images/background.png', import.meta.url).href;
const LOGO_URL = new URL('../assets/images/logo.png', import.meta.url).href;

export default function MemoryGame() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  // ✅ Game state
  const [cards, setCards] = useState<CardType[]>([]);
  const [firstCard, setFirstCard] = useState<number | null>(null);
  const [secondCard, setSecondCard] = useState<number | null>(null);
  const [moves, setMoves] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [cardSet, setCardSet] = useState<'set1' | 'set2'>('set1');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTournamentMode, setIsTournamentMode] = useState<boolean>(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [activeTournaments, setActiveTournaments] = useState<any[]>([]);
  const [gameResultDialogOpen, setGameResultDialogOpen] = useState<boolean>(false);
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState<number>(0);

  // ✅ Refs
  const timer = useRef<NodeJS.Timeout | null>(null);
  const flipTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    TournamentManager.initializeTournaments();
    loadActiveTournaments();

    return () => {
      if (timer.current) clearInterval(timer.current);
      if (flipTimeout.current) clearTimeout(flipTimeout.current);
    };
  }, []);

  const loadActiveTournaments = () => {
    const tournaments = TournamentManager.getActiveTournaments();
    setActiveTournaments(tournaments);

    if (tournaments.length > 0 && isTournamentMode && !selectedTournament) {
      setSelectedTournament(tournaments[0].id);
      setDifficulty(tournaments[0].difficulty as 'easy' | 'medium' | 'hard');
    }
  };

  const initializeGame = async () => {
    if (timer.current) clearInterval(timer.current);
    if (flipTimeout.current) clearTimeout(flipTimeout.current);

    setIsLoading(true);

    if (isTournamentMode && selectedTournament) {
      const entered = await TournamentManager.enterTournament(connection, wallet, selectedTournament);
      if (!entered) {
        setIsLoading(false);
        return;
      }
    }

    const config = DIFFICULTY_SETTINGS[difficulty];
    const cardImages = CARD_SETS[cardSet];
    const cardPairs = config.cardPairs;

    const selectedImages = Array.from({ length: cardPairs }, (_, i) => cardImages[i % cardImages.length]);

    let cardData: CardType[] = [];
    selectedImages.forEach((image, index) => {
      const card1: CardType = { id: index * 2, imageUrl: image, isFlipped: false, isMatched: false };
      const card2: CardType = { id: index * 2 + 1, imageUrl: image, isFlipped: false, isMatched: false };
      cardData.push(card1, card2);
    });

    cardData = shuffleArray(cardData);

    setCards(cardData);
    setFirstCard(null);
    setSecondCard(null);
    setMoves(0);
    setGameOver(false);
    setGameWon(false);
    setGameActive(true);
    setCurrentTime(0);

    timer.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (newTime >= config.timeLimit) {
          if (timer.current) clearInterval(timer.current);
          setGameOver(true);
          return prev;
        }
        return newTime;
      });
    }, 1000);

    setIsLoading(false);
  };

  const handleCardClick = (index: number) => {
    if (!gameActive || gameOver || cards[index].isFlipped || cards[index].isMatched || secondCard !== null) return;

    const updatedCards = [...cards];
    updatedCards[index] = { ...updatedCards[index], isFlipped: true };
    setCards(updatedCards);

    if (firstCard === null) {
      setFirstCard(index);
    } else {
      setSecondCard(index);
      setMoves(moves + 1);

      if (cards[firstCard].imageUrl === cards[index].imageUrl) {
        updatedCards[firstCard] = { ...updatedCards[firstCard], isMatched: true };
        updatedCards[index] = { ...updatedCards[index], isMatched: true };

        flipTimeout.current = setTimeout(() => {
          setFirstCard(null);
          setSecondCard(null);
          if (updatedCards.every(card => card.isMatched)) endGame(true);
        }, 500);

        setCards(updatedCards);
      } else {
        flipTimeout.current = setTimeout(() => {
          updatedCards[firstCard] = { ...updatedCards[firstCard], isFlipped: false };
          updatedCards[index] = { ...updatedCards[index], isFlipped: false };
          setCards(updatedCards);
          setFirstCard(null);
          setSecondCard(null);
        }, 1000);
      }
    }
  };

  const endGame = (won: boolean) => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }

    setGameActive(false);
    setGameWon(won);
    setGameOver(true);
    setGameResultDialogOpen(true);

    if (won) {
      const score = calculateScore(currentTime, moves);
      setFinalScore(score);

      if (connected && publicKey) {
        try {
          LeaderboardManager.addScore(
            publicKey.toString(),
            score,
            difficulty,
            moves,
            currentTime,
            isTournamentMode ? selectedTournament || undefined : undefined
          );
          setLeaderboardRefreshTrigger(prev => prev + 1);
          toast.success('Your score has been recorded!');
        } catch (error) {
          console.error('Error saving score:', error);
          toast.error('Failed to save your score');
        }
      } else {
        toast.info('Connect your wallet to save your score!');
      }
    } else {
      setFinalScore(calculateScore(currentTime, moves));
    }
  };

  const calculateScore = (time: number, moveCount: number) => {
    const config = DIFFICULTY_SETTINGS[difficulty];
    const baseScore = config.cardPairs * 100;
    const timeBonus = Math.max(0, config.timeLimit - time) * 10;
    const moveBonus = Math.max(0, config.cardPairs * 3 - moveCount) * 50;
    return baseScore + timeBonus + moveBonus;
  };

  const toggleTournamentMode = (enabled: boolean) => {
    setIsTournamentMode(enabled);
    if (enabled) loadActiveTournaments();
    else setSelectedTournament(null);
  };

  // ✅ Render card
  const renderCard = (card: CardType, index: number) => {
    const CARD_PX = 120;
    const IMG_PX = 80;

    return (
      <div
        key={card.id}
        className="cursor-pointer"
        style={{ width: CARD_PX, height: CARD_PX }}
        onClick={() => handleCardClick(index)}
      >
        <div
          className={`relative w-full h-full transform-style-3d transition-transform duration-500 perspective-500 ${card.isFlipped ? 'rotate-y-180' : ''}`}
        >
          {/* BACK */}
          <div
            className={`absolute inset-0 rounded-md flex items-center justify-center shadow-lg backface-hidden border-2 ${
              card.isMatched ? 'border-green-500' : 'border-violet-400'
            }`}
            style={{ background: 'linear-gradient(180deg,#8b5cf6,#5b21b6)' }}
          >
            <img
              src={CARD_BACK_URL}
              alt="Card Back"
              style={{ width: IMG_PX, height: IMG_PX, objectFit: 'contain', opacity: 0.95 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = CARD_BACK_URL; }}
            />
          </div>

          {/* FRONT */}
          <div
            className={`absolute inset-0 rounded-md flex items-center justify-center shadow-md backface-hidden rotate-y-180 border-2 ${
              card.isMatched ? 'border-green-500' : 'border-gray-200'
            }`}
            style={{ background: '#060606' }}
          >
            <img
              src={card.imageUrl}
              alt="Card Front"
              style={{ width: IMG_PX, height: IMG_PX, objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = CARD_BACK_URL; }}
            />
          </div>
        </div>
      </div>
    );
  };

  const getGridColumns = () => {
    switch (difficulty) {
      case 'easy':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
      case 'medium':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
      case 'hard':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';
      default:
        return 'grid-cols-2';
    }
  };

  const renderStatsCard = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground mb-1">Moves</span>
            <span className="text-3xl font-bold">{moves}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground mb-1">Time</span>
            <span className="text-3xl font-bold font-mono">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                difficulty === 'easy' ? 'default' :
                difficulty === 'medium' ? 'secondary' : 'destructive'
              }
            >
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </Badge>
            {isTournamentMode && (
              <Badge variant="outline" className="bg-amber-900/20 text-amber-200">Tournament</Badge>
            )}
          </div>
          <div className="ml-auto">
            <WalletButton variant="outline" size="sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-cover bg-center" style={{ backgroundImage: `url(${BACKGROUND_URL})` }}>
      <div className="mx-auto max-w-full py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <img src={LOGO_URL} alt="Solana Memory Game Logo" className="h-24" />
          <div className="text-left">
            <h1 className="text-3xl md:text-4xl font-bold mb-1">Solana Memory Game</h1>
            <p className="text-muted-foreground mb-2">Match pairs of cards to win SOL prizes!</p>
            <NetworkBadge />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Game controls */}
          <div className="lg:col-span-2 space-y-6">
            {!gameActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Game Mode</label>
                        <Tabs
                          defaultValue={isTournamentMode ? "tournament" : "practice"}
                          className="w-full"
                          onValueChange={(val) => toggleTournamentMode(val === "tournament")}
                        >
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="practice">Practice</TabsTrigger>
                            <TabsTrigger value="tournament">Tournament</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      {isTournamentMode ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tournament</label>
                          {activeTournaments.length > 0 ? (
                            <Select
                              value={selectedTournament || ''}
                              onValueChange={(value) => {
                                setSelectedTournament(value);
                                const t = activeTournaments.find((t) => t.id === value);
                                if (t) setDifficulty(t.difficulty as 'easy' | 'medium' | 'hard');
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select Tournament" /></SelectTrigger>
                              <SelectContent>
                                {activeTournaments.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="bg-muted p-2 rounded text-sm text-center">No active tournaments</div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Difficulty</label>
                            <Select
                              value={difficulty}
                              onValueChange={(value) => setDifficulty(value as 'easy' | 'medium' | 'hard')}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">Easy (6 pairs)</SelectItem>
                                <SelectItem value="medium">Medium (8 pairs)</SelectItem>
                                <SelectItem value="hard">Hard (12 pairs)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Card Set</label>
                            <Select value={cardSet} onValueChange={(value) => setCardSet(value as 'set1' | 'set2')}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="set1">Solana Symbols</SelectItem>
                                <SelectItem value="set2">Crypto Icons</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <Button onClick={initializeGame} disabled={isTournamentMode && (!selectedTournament || !connected)} className="mt-2">
                        {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
                        Start Game
                      </Button>

                      {isTournamentMode && !connected && (
                        <p className="text-xs text-red-400">Connect wallet to enter tournaments</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {gameActive && (
              <>
                {renderStatsCard()}
                <div className={`grid ${getGridColumns()} gap-3 justify-center`}>
                  {cards.map((card, index) => renderCard(card, index))}
                </div>
              </>
            )}
          </div>

          {/* Right: Leaderboard */}
          <div>
            <Leaderboard difficulty={difficulty} refreshTrigger={leaderboardRefreshTrigger} />
          </div>
        </div>
      </div>

      {/* Game Result Dialog */}
      <Dialog open={gameResultDialogOpen} onOpenChange={setGameResultDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Game {gameWon ? 'Won' : 'Over'}</DialogTitle></DialogHeader>
          <div className="py-4">
            <p className="mb-2">Final Score: <span className="font-bold">{finalScore}</span></p>
            <p className="mb-2">Moves: <span className="font-bold">{moves}</span></p>
            <p className="mb-2">Time: <span className="font-bold">{formatTime(currentTime)}</span></p>
            {gameWon ? (
              <p className="text-green-400 font-medium">Congratulations! 🎉</p>
            ) : (
              <p className="text-red-400 font-medium">Try again!</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setGameResultDialogOpen(false); initializeGame(); }}>Play Again</Button>
            <Button onClick={() => setGameResultDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
