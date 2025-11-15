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

// Helper για assets (GitHub Pages / Vite BASE_URL)
const withBasePath = (path: string) => {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

// Network badge για Vite envs
const NetworkBadge: React.FC = () => {
  const network = import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta';
  const endpoint = import.meta.env.VITE_SOLANA_RPC ?? '';

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">App Network:</span>
      <span className="font-semibold capitalize">{network}</span>
      {endpoint ? (
        <span className="truncate opacity-70">
          {endpoint.replace(/^https?:\/\//, '')}
        </span>
      ) : null}
    </div>
  );
};

interface MemoryCard {
  id: number;
  imageUrl: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const DIFFICULTY_SETTINGS = {
  easy: { cardPairs: 6, timeLimit: 120 },
  medium: { cardPairs: 8, timeLimit: 180 },
  hard: { cardPairs: 12, timeLimit: 240 },
} as const;

const CARD_DIMENSIONS: Record<'easy' | 'medium' | 'hard', { width: number; height: number }> = {
  easy: { width: 148, height: 196 },
  medium: { width: 132, height: 178 },
  hard: { width: 112, height: 152 },
};

const CARD_SETS: Record<'set1' | 'set2', string[]> = {
  set1: Array.from({ length: 8 }, (_, i) => withBasePath(`assets/images/cards/set1_${i + 1}.png`)),
  set2: Array.from({ length: 8 }, (_, i) => withBasePath(`assets/images/cards/set2_${i + 1}.png`)),
};

const CARD_BACK_URL = withBasePath('assets/images/cards/card-back.png');
const BACKGROUND_URL = withBasePath('assets/images/background.png');
const LOGO_URL = withBasePath('assets/images/logo.png');

export default function MemoryGame() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [firstCard, setFirstCard] = useState<number | null>(null);
  const [secondCard, setSecondCard] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [gameCompleteTime, setGameCompleteTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [cardSet, setCardSet] = useState<'set1' | 'set2'>('set1');
  const [isLoading, setIsLoading] = useState(false);
  const [isTournamentMode, setIsTournamentMode] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [activeTournaments, setActiveTournaments] = useState<any[]>([]);
  const [gameResultDialogOpen, setGameResultDialogOpen] = useState(false);
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState(0);

  const timer = useRef<NodeJS.Timeout | null>(null);
  const flipTimeout = useRef<NodeJS.Timeout | null>(null);
  const gameOverRef = useRef<boolean>(false);

  useEffect(() => {
    TournamentManager.initializeTournaments();
    loadActiveTournaments();

    return () => {
      if (timer.current) clearInterval(timer.current);
      if (flipTimeout.current) clearTimeout(flipTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadActiveTournaments = (autoSelect = false) => {
    const tournaments = TournamentManager.getActiveTournaments();
    setActiveTournaments(tournaments);

    if (autoSelect && tournaments.length > 0) {
      setSelectedTournament(tournaments[0].id);
      setDifficulty(tournaments[0].difficulty as 'easy' | 'medium' | 'hard');
    }
  };

  const calculateScore = (time: number, moveCount: number) => {
    const config = DIFFICULTY_SETTINGS[difficulty];
    const baseScore = config.cardPairs * 100;
    const timeBonus = Math.max(0, config.timeLimit - time) * 10;
    const moveBonus = Math.max(0, config.cardPairs * 3 - moveCount) * 50;

    return baseScore + timeBonus + moveBonus;
  };

  const endGame = (won: boolean, finalTimeOverride?: number) => {
    if (gameOverRef.current) {
      return;
    }

    gameOverRef.current = true;

    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }

    const completionTime = typeof finalTimeOverride === 'number' ? finalTimeOverride : currentTime;
    const computedScore = calculateScore(completionTime, moves);

    setGameActive(false);
    setGameWon(won);
    setGameOver(true);
    setGameCompleteTime(completionTime);
    setFinalScore(computedScore);
    setGameResultDialogOpen(true);

    if (!won) {
      // δεν σώζουμε score σε leaderboard αν χάσει
      return;
    }

    if (connected && publicKey) {
      try {
        LeaderboardManager.addScore(
          publicKey.toString(),
          computedScore,
          difficulty,
          moves,
          completionTime,
          isTournamentMode ? selectedTournament || undefined : undefined
        );

        setLeaderboardRefreshTrigger(prev => prev + 1);
        toast.success('Your score has been recorded!');
      } catch (error) {
        console.error('Error saving score:', error);
        toast.error('Failed to save your score');
      }
    } else {
      toast.info('Connect your wallet to save your score to the leaderboard!');
    }
  };

  const initializeGame = async () => {
    if (timer.current) clearInterval(timer.current);
    if (flipTimeout.current) clearTimeout(flipTimeout.current);

    setIsLoading(true);
    setGameResultDialogOpen(false);
    setGameCompleteTime(null);
    setFinalScore(0);
    setGameWon(false);
    setGameOver(false);
    gameOverRef.current = false;

    if (isTournamentMode && selectedTournament) {
      const entered = await TournamentManager.enterTournament(connection, wallet, selectedTournament);
      if (!entered) {
        setIsLoading(false);
        return;
      }
    }

    const config = DIFFICULTY_SETTINGS[difficulty];
    const imagePool = CARD_SETS[cardSet] ?? CARD_SETS.set1;
    const selectedImages = Array.from(
      { length: config.cardPairs },
      (_, i) => imagePool[i % imagePool.length]
    );

    let cardData: MemoryCard[] = [];
    selectedImages.forEach((image, index) => {
      const card1: MemoryCard = { id: index * 2, imageUrl: image, isFlipped: false, isMatched: false };
      const card2: MemoryCard = { id: index * 2 + 1, imageUrl: image, isFlipped: false, isMatched: false };
      cardData.push(card1, card2);
    });

    cardData = shuffleArray(cardData);

    setCards(cardData);
    setFirstCard(null);
    setSecondCard(null);
    setMoves(0);
    setGameActive(true);
    setCurrentTime(0);

    timer.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (newTime >= config.timeLimit) {
          if (timer.current) {
            clearInterval(timer.current);
            timer.current = null;
          }
          // κλείνουμε το παιχνίδι ως lose στο time limit
          setTimeout(() => endGame(false, config.timeLimit), 0);
          return config.timeLimit;
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
      return;
    }

    setSecondCard(index);
    setMoves(prev => prev + 1);

    if (updatedCards[firstCard].imageUrl === updatedCards[index].imageUrl) {
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
  };

  const toggleTournamentMode = (enabled: boolean) => {
    setIsTournamentMode(enabled);

    if (enabled) {
      loadActiveTournaments(true);
    } else {
      setSelectedTournament(null);
    }
  };

  const renderCard = (card: MemoryCard, index: number) => {
    const isRevealed = card.isFlipped || card.isMatched;
    const { width, height } = CARD_DIMENSIONS[difficulty] ?? CARD_DIMENSIONS.medium;

    return (
      <button
        key={card.id}
        type="button"
        onClick={() => handleCardClick(index)}
        disabled={!gameActive || card.isMatched || gameOver}
        aria-pressed={isRevealed}
        className={`relative rounded-2xl border transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          card.isMatched
            ? 'border-emerald-400 shadow-lg shadow-emerald-500/40'
            : 'border-indigo-400/70 shadow shadow-indigo-500/20 hover:shadow-indigo-500/40'
        } ${!gameActive || gameOver ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
        style={{ width, height }}
      >
        <div className="absolute inset-0" style={{ perspective: '1000px' }}>
          <div
            className="absolute inset-0 transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* BACK */}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border-2"
              style={{
                backfaceVisibility: 'hidden',
                background: 'linear-gradient(180deg,#8b5cf6,#5b21b6)',
              }}
            >
              <img
                src={CARD_BACK_URL}
                alt="Card back"
                className="h-3/4 w-3/4 object-contain opacity-95"
                draggable={false}
              />
            </div>

            {/* FRONT */}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 bg-slate-950"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <img
                src={card.imageUrl}
                alt="Card front"
                className="h-3/4 w-3/4 object-contain"
                draggable={false}
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).src = CARD_BACK_URL;
                }}
              />
            </div>
          </div>
        </div>

        {card.isMatched && (
          <span
            className="pointer-events-none absolute inset-1 rounded-2xl border-4 border-emerald-300/80 animate-pulse"
            aria-hidden="true"
          />
        )}
      </button>
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
            <span className="mb-1 text-sm text-muted-foreground">Moves</span>
            <span className="text-3xl font-bold">{moves}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="mb-1 text-sm text-muted-foreground">Time</span>
            <span className="text-3xl font-bold font-mono">{formatTime(currentTime)}</span>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                difficulty === 'easy'
                  ? 'default'
                  : difficulty === 'medium'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </Badge>
            {isTournamentMode && (
              <Badge variant="outline" className="bg-amber-900/20 text-amber-200">
                Tournament
              </Badge>
            )}
          </div>
          <WalletButton variant="outline" size="sm" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div
      className="min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${BACKGROUND_URL})` }}
    >
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <img src={LOGO_URL} alt="Solana Memory Game Logo" className="h-24" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Solana Memory Game
            </h1>
            <p className="text-muted-foreground">Match pairs of cards to win SOL prizes!</p>
          </div>
          <NetworkBadge />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Game section */}
          <div className="space-y-6 lg:col-span-2">
            {!gameActive && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Game Mode</label>
                        <Tabs
                          defaultValue={isTournamentMode ? 'tournament' : 'practice'}
                          className="w-full"
                          onValueChange={(val) => toggleTournamentMode(val === 'tournament')}
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
                              value={selectedTournament ?? ''}
                              onValueChange={(value) => {
                                setSelectedTournament(value);
                                const tournament = activeTournaments.find((t) => t.id === value);
                                if (tournament) {
                                  setDifficulty(tournament.difficulty as 'easy' | 'medium' | 'hard');
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Tournament" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeTournaments.map((tournament) => (
                                  <SelectItem key={tournament.id} value={tournament.id}>
                                    {tournament.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded bg-muted p-2 text-center text-sm">
                              No active tournaments available
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Difficulty</label>
                            <Select
                              value={difficulty}
                              onValueChange={(value) =>
                                setDifficulty(value as 'easy' | 'medium' | 'hard')
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="easy">Easy (6 pairs)</SelectItem>
                                <SelectItem value="medium">Medium (8 pairs)</SelectItem>
                                <SelectItem value="hard">Hard (12 pairs)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Card Set</label>
                            <Select
                              value={cardSet}
                              onValueChange={(value) =>
                                setCardSet(value as 'set1' | 'set2')
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="set1">Solana Symbols</SelectItem>
                                <SelectItem value="set2">Crypto Icons</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <Button
                        onClick={initializeGame}
                        disabled={isTournamentMode && (!selectedTournament || !connected)}
                        className="mt-2"
                      >
                        {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
                        Start Game
                      </Button>

                      {isTournamentMode && !connected && (
                        <p className="text-center text-sm text-amber-500">
                          Connect wallet to play tournament mode
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {renderStatsCard()}
              </div>
            )}

            {gameActive && <div className="mb-4">{renderStatsCard()}</div>}

            {/* Game board */}
            <div className="rounded-lg border-2 bg-card p-4">
              {cards.length > 0 ? (
                <div className={`grid ${getGridColumns()} place-items-center gap-2 sm:gap-4`}>
                  {cards.map((card, index) => renderCard(card, index))}
                </div>
              ) : (
                <div className="flex h-80 flex-col items-center justify-center text-center">
                  <h3 className="mb-2 text-xl font-semibold">Welcome to Solana Memory Game!</h3>
                  <p className="mb-4 text-muted-foreground">
                    Select your game options and click &apos;Start Game&apos; to begin.
                  </p>
                  <img
                    src={CARD_BACK_URL}
                    alt="Memory Game"
                    className="h-24 w-24 object-contain opacity-60"
                  />
                </div>
              )}
            </div>

            {/* Rules */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-2 font-semibold">How to Play</h3>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  <li>Click on cards to flip them and find matching pairs</li>
                  <li>Each difficulty has a time limit: Easy (2 min), Medium (3 min), Hard (4 min)</li>
                  <li>Tournament mode requires connecting a Solana wallet and paying an entry fee</li>
                  <li>Win prizes by ranking high on tournament leaderboards</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Leaderboard column */}
          <div className="space-y-6">
            <Leaderboard
              difficulty={difficulty}
              refreshTrigger={leaderboardRefreshTrigger}
            />
          </div>
        </div>

        {/* Game Result Dialog */}
        <Dialog open={gameResultDialogOpen} onOpenChange={setGameResultDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{gameWon ? 'Congratulations! 🎉' : 'Game Over'}</DialogTitle>
            </DialogHeader>

            {gameWon ? (
              <div className="space-y-4">
                <p>You matched all the cards!</p>

                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-sm text-muted-foreground">Moves</div>
                    <div className="text-2xl font-bold">{moves}</div>
                  </div>
                  <div className="rounded bg-muted p-3 text-center">
                    <div className="text-sm text-muted-foreground">Time</div>
                    <div className="text-2xl font-bold font-mono">
                      {formatTime(gameCompleteTime ?? 0)}
                    </div>
                  </div>
                  <div className="col-span-2 rounded bg-muted p-3 text-center">
                    <div className="text-sm text-muted-foreground">Score</div>
                    <div className="text-3xl font-bold text-primary">{finalScore}</div>
                  </div>
                </div>

                {isTournamentMode && connected ? (
                  <div className="rounded bg-emerald-900/30 p-2 text-center text-sm text-emerald-300">
                    Your score has been submitted to the tournament!
                  </div>
                ) : !connected ? (
                  <div className="rounded bg-amber-900/30 p-2 text-center text-sm text-amber-300">
                    Connect your wallet to save your score on the leaderboard!
                  </div>
                ) : null}

                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setGameResultDialogOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setGameResultDialogOpen(false);
                      initializeGame();
                    }}
                  >
                    Play Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p>You ran out of time!</p>
                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setGameResultDialogOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setGameResultDialogOpen(false);
                      initializeGame();
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
