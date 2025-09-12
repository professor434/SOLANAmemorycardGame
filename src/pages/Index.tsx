import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Define card types
interface CardType {
  id: number;
  imageUrl: string;
  isFlipped: boolean;
  isMatched: boolean;
}

// Define game difficulty settings (κρατάω τις τιμές σου όπως είναι)
const DIFFICULTY_SETTINGS = {
  easy: { cardPairs: 6, timeLimit: 120 },      // 12 cards
  medium: { cardPairs: 8, timeLimit: 180 },    // 16 cards
  hard: { cardPairs: 12, timeLimit: 240 },     // 24 cards
};

// σωστά paths & 12 εικόνες ανά set
const CARD_SETS = {
  set1: Array.from({ length: 12 }, (_, i) => `/assets/images/cards/set1_${i + 1}.png`),
  set2: Array.from({ length: 12 }, (_, i) => `/assets/images/cards/set2_${i + 1}.png`),
};

export default function MemoryGame() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;

  // Game state
  const [cards, setCards] = useState<CardType[]>([]);
  const [firstCard, setFirstCard] = useState<number | null>(null);
  const [secondCard, setSecondCard] = useState<number | null>(null);
  const [moves, setMoves] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [gameCompleteTime, setGameCompleteTime] = useState<number | null>(null);
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

  // Refs
  const timer = useRef<NodeJS.Timeout | null>(null);
  const flipTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize game on component mount
  useEffect(() => {
    TournamentManager.initializeTournaments();
    loadActiveTournaments();

    return () => {
      if (timer.current) clearInterval(timer.current);
      if (flipTimeout.current) clearTimeout(flipTimeout.current);
    };
  }, []);

  // Load active tournaments
  const loadActiveTournaments = () => {
    const tournaments = TournamentManager.getActiveTournaments();
    setActiveTournaments(tournaments);

    if (tournaments.length > 0 && isTournamentMode && !selectedTournament) {
      setSelectedTournament(tournaments[0].id);
      setDifficulty(tournaments[0].difficulty as 'easy' | 'medium' | 'hard');
    }
  };

  // Initialize game with selected options
  const initializeGame = async () => {
    if (timer.current) clearInterval(timer.current);
    if (flipTimeout.current) clearTimeout(flipTimeout.current);

    setIsLoading(true);

    // If playing in tournament mode, ensure the player has entered
    if (isTournamentMode && selectedTournament) {
      const entered = await TournamentManager.enterTournament(
        connection,
        wallet,
        selectedTournament
      );

      if (!entered) {
        setIsLoading(false);
        return;
      }
    }

    const config = DIFFICULTY_SETTINGS[difficulty];
    const cardImages = CARD_SETS[cardSet];
    const cardPairs = config.cardPairs;

    // ασφαλής επιλογή εικόνων (wrap)
    const selectedImages = Array.from(
      { length: cardPairs },
      (_, i) => cardImages[i % cardImages.length]
    );

    // Create pairs
    let cardData: CardType[] = [];
    selectedImages.forEach((image, index) => {
      const card1: CardType = { id: index * 2, imageUrl: image, isFlipped: false, isMatched: false };
      const card2: CardType = { id: index * 2 + 1, imageUrl: image, isFlipped: false, isMatched: false };
      cardData.push(card1, card2);
    });

    // Shuffle cards
    cardData = shuffleArray(cardData);

    // Reset game state
    setCards(cardData);
    setFirstCard(null);
    setSecondCard(null);
    setMoves(0);
    setGameOver(false);
    setGameWon(false);
    setGameActive(true);
    setGameStartTime(Date.now());
    setGameCompleteTime(null);
    setCurrentTime(0);

    // Start timer
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

  // Handle card click
  const handleCardClick = (index: number) => {
    if (!gameActive || gameOver || cards[index].isFlipped || cards[index].isMatched || secondCard !== null) {
      return;
    }

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

          const allMatched = updatedCards.every(card => card.isMatched);
          if (allMatched) {
            endGame(true);
          }
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

  // End the game
  const endGame = (won: boolean) => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }

    setGameActive(false);
    setGameWon(won);
    setGameOver(true);
    setGameCompleteTime(currentTime);

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
        toast.info('Connect your wallet to save your score to the leaderboard!');
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
    if (enabled) {
      loadActiveTournaments();
    } else {
      setSelectedTournament(null);
    }
  };

  // Render card
  const renderCard = (card: CardType, index: number) => {
    return (
      <div
        key={card.id}
        className="perspective-500 aspect-square w-32 sm:w-40 cursor-pointer"
        onClick={() => handleCardClick(index)}
      >
        <div
          className={`relative w-full h-full transform-style-3d transition-transform duration-500 ${
            card.isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Card Back */}
          <div
            className={`absolute w-full h-full backface-hidden rounded-md bg-gradient-to-br from-violet-500 to-indigo-800 border-2 ${
              card.isMatched ? 'border-green-500' : 'border-violet-400'
            } shadow-lg flex items-center justify-center`}
          >
            <img
              src="/assets/images/cards/card-back.png"
              alt="Card Back"
              className="object-contain opacity-80"
              style={{ width: 100, height: 100 }}
            />
          </div>

          {/* Card Front */}
          <div
            className={`absolute w-full h-full backface-hidden rotate-y-180 rounded-md bg-white border-2 ${
              card.isMatched ? 'border-green-500' : 'border-gray-200'
            } shadow-lg flex items-center justify-center overflow-hidden`}
          >
            <img
              src={card.imageUrl}
              alt="Card"
              className="object-contain p-1 sm:p-2"
              style={{ width: 100, height: 100 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/images/cards/card-back.png'; }}
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

          <div className="ml-auto">
            <WalletButton variant="outline" size="sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-cover bg-center" style={{ backgroundImage: "url('/assets/images/background.png')" }}>
      <div className="mx-auto max-w-full py-8 px-4">
      <div className="text-center mb-8">
        <img src="/assets/images/logo.png" alt="Solana Memory Game Logo" className="h-24 mx-auto mb-4" />
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-2">
          Solana Memory Game
        </h1>
        <p className="text-muted-foreground">Match pairs of cards to win SOL prizes!</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Game Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Game Controls */}
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
                          <div className="bg-muted p-2 rounded text-sm text-center">
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
                            onValueChange={(value) => setDifficulty(value as 'easy' | 'medium' | 'hard')}
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
                          <Select value={cardSet} onValueChange={(value) => setCardSet(value as 'set1' | 'set2')}>
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
                      <div className="text-sm text-warning text-center">
                        Connect wallet to play tournament mode
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {renderStatsCard()}
            </div>
          )}

          {gameActive && <div className="mb-4">{renderStatsCard()}</div>}

          {/* Game Board */}
          <div className="bg-card rounded-lg p-4 border-2">
            {cards.length > 0 ? (
              <div className={`grid ${getGridColumns()} gap-2 sm:gap-4 place-items-center`}>
                {cards.map((card, index) => renderCard(card, index))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <h3 className="text-xl font-semibold mb-2">Welcome to Solana Memory Game!</h3>
                <p className="text-muted-foreground mb-4">
                  Select your game options and click 'Start Game' to begin.
                </p>
                <img 
                  src="/assets/images/cards/card-back.png"
                  alt="Memory Game"
                  className="w-24 h-24 object-contain opacity-60"
                />
              </div>
            )}
          </div>

          {/* Game Rules */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">How to Play</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Click on cards to flip them and find matching pairs</li>
                <li>Each difficulty has a time limit: Easy (2 min), Medium (3 min), Hard (4 min)</li>
                <li>Tournament mode requires connecting a Solana wallet and paying an entry fee</li>
                <li>Win prizes by ranking high on tournament leaderboards</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard Section */}
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
            <DialogTitle>
              {gameWon ? 'Congratulations! 🎉' : 'Game Over'}
            </DialogTitle>
          </DialogHeader>

          {gameWon ? (
            <div className="space-y-4">
              <p>You matched all the cards!</p>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="bg-muted p-3 rounded text-center">
                  <div className="text-sm text-muted-foreground">Moves</div>
                  <div className="text-2xl font-bold">{moves}</div>
                </div>

                <div className="bg-muted p-3 rounded text-center">
                  <div className="text-sm text-muted-foreground">Time</div>
                  <div className="text-2xl font-bold font-mono">
                    {formatTime(gameCompleteTime || 0)}
                  </div>
                </div>

                <div className="col-span-2 bg-muted p-3 rounded text-center">
                  <div className="text-sm text-muted-foreground">Score</div>
                  <div className="text-3xl font-bold text-primary">
                    {finalScore}
                  </div>
                </div>
              </div>

              {isTournamentMode && connected ? (
                <div className="bg-success/20 text-success p-2 rounded text-center text-sm">
                  Your score has been submitted to the tournament!
                </div>
              ) : !connected ? (
                <div className="bg-warning/20 text-warning p-2 rounded text-center text-sm">
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
