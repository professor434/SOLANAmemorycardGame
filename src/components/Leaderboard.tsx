import { useEffect, useState } from 'react';
import { LeaderboardEntry, LeaderboardManager, Tournament } from '@/lib/leaderboard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatTimeRemaining, truncateWalletAddress, formatSOL } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { TournamentManager } from '@/lib/tournament';
import { Badge } from '@/components/ui/badge';

interface LeaderboardProps {
  difficulty: 'easy' | 'medium' | 'hard';
  refreshTrigger: number;
  className?: string;
}

export default function Leaderboard({ difficulty, refreshTrigger, className }: LeaderboardProps) {
  const { publicKey } = useWallet();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tournamentLeaderboard, setTournamentLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('regular');
  const [prizeDistribution, setPrizeDistribution] = useState<{ rank: number; percentage: number; amount: number }[]>([]);

  // Load leaderboard and tournament data whenever inputs change
  useEffect(() => {
    const loadData = () => {
      const regularLeaderboard = LeaderboardManager.getLeaderboardByDifficulty(difficulty);
      setLeaderboard(regularLeaderboard.slice(0, 10));

      const activeTournament = LeaderboardManager.getActiveTournamentByDifficulty(difficulty);
      setTournament(activeTournament);

      if (activeTournament) {
        const tournamentLeaderboardData = LeaderboardManager.getTournamentLeaderboard(activeTournament.id);
        setTournamentLeaderboard(tournamentLeaderboardData.slice(0, 10));

        const prizes = TournamentManager.calculatePrizeDistribution(activeTournament.id);
        setPrizeDistribution(prizes);

        const remaining = LeaderboardManager.getTournamentTimeRemaining(activeTournament.id);
        setTimeRemaining(formatTimeRemaining(remaining));
      } else {
        setTournamentLeaderboard([]);
        setPrizeDistribution([]);
        setTimeRemaining('');
      }

      setLoading(false);
    };

    loadData();
  }, [difficulty, publicKey, refreshTrigger]);

  // Update tournament countdown every second
  useEffect(() => {
    if (!tournament) return;
    const interval = setInterval(() => {
      const remaining = LeaderboardManager.getTournamentTimeRemaining(tournament.id);
      setTimeRemaining(formatTimeRemaining(remaining));
    }, 1000);

    return () => clearInterval(interval);
  }, [tournament]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <Spinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-center text-lg">
          <span>Leaderboard</span>
          <Badge variant="outline" className="capitalize">{difficulty}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="regular" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="regular">All Time</TabsTrigger>
            <TabsTrigger value="tournament" disabled={!tournament}>
              Tournament {tournament && <span className="ml-2 text-xs">{timeRemaining}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regular">
            {leaderboard.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                No scores recorded yet
              </div>
            ) : (
              <div className="space-y-1">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex justify-between py-2 px-3 rounded-md ${
                      publicKey && entry.playerWallet === publicKey.toString()
                        ? 'bg-amber-500/10 border-l-2 border-amber-500'
                        : index % 2 === 0
                        ? 'bg-muted/50'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-5">{index + 1}</span>
                      <span className="text-sm">{truncateWalletAddress(entry.playerWallet)}</span>
                    </div>
                    <span className="text-sm font-mono">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tournament">
            {!tournament ? (
              <div className="py-6 text-center text-muted-foreground">
                No active tournament
              </div>
            ) : (
              <>
                <div className="mb-4 space-y-1">
                  <CardDescription>
                    <span className="font-semibold">{tournament.name}</span>
                    <span className="text-xs ml-2 text-muted-foreground">
                      Entry: {formatSOL(tournament.entryFee)} • Pool: {formatSOL(tournament.prizePool)}
                    </span>
                  </CardDescription>
                  {prizeDistribution.length > 0 && (
                    <div className="flex gap-2 text-xs pt-1">
                      {prizeDistribution.map((prize) => (
                        <Badge key={prize.rank} variant="secondary" className="bg-amber-500/10 text-amber-600">
                          {prize.rank === 1 ? '🥇' : prize.rank === 2 ? '🥈' : '🥉'} {formatSOL(prize.amount)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {tournamentLeaderboard.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    No participants yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {tournamentLeaderboard.map((entry, index) => (
                      <div
                        key={entry.id}
                        className={`flex justify-between py-2 px-3 rounded-md ${
                          publicKey && entry.playerWallet === publicKey.toString()
                            ? 'bg-amber-500/10 border-l-2 border-amber-500'
                            : index % 2 === 0
                            ? 'bg-muted/50'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-5">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </span>
                          <span className="text-sm">{truncateWalletAddress(entry.playerWallet)}</span>
                        </div>
                        <span className="text-sm font-mono">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
