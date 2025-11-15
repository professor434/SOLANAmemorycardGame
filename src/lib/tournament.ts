// src/lib/tournament.ts
import { LeaderboardManager, Tournament } from './leaderboard';
import { toast } from 'sonner';
import { makePayment } from './solana';
import { Connection } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

export interface TournamentPrize {
  rank: number;
  percentage: number;
  amount: number;
}

// Default prize distribution percentages (0.1% kept for treasury)
const DEFAULT_PRIZE_DISTRIBUTION: { rank: number; percentage: number }[] = [
  { rank: 1, percentage: 50 },   // First place: 50%
  { rank: 2, percentage: 30 },   // Second place: 30%
  { rank: 3, percentage: 19.9 }, // Third place: 19.9%
];

export class TournamentManager {
  /**
   * Create a new tournament with given parameters
   */
  static createTournament(
    name: string,
    entryFee: number,
    startTime: Date,
    endTime: Date,
    difficulty: string
  ): Tournament | null {
    try {
      if (entryFee < 0) {
        toast.error('Entry fee cannot be negative');
        return null;
      }

      if (startTime >= endTime) {
        toast.error('End time must be after start time');
        return null;
      }

      const now = new Date();
      let status: 'upcoming' | 'active' | 'completed' = 'upcoming';

      if (now >= startTime && now < endTime) {
        status = 'active';
      } else if (now >= endTime) {
        status = 'completed';
      }

      const tournament = LeaderboardManager.createTournament({
        name,
        entryFee,
        startTime,
        endTime,
        status,
        difficulty,
      });

      return tournament;
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast.error('Failed to create tournament');
      return null;
    }
  }

  /**
   * Enter a tournament by paying the entry fee
   */
  static async enterTournament(
    connection: Connection,
    wallet: WalletContextState,
    tournamentId: string
  ): Promise<boolean> {
    try {
      if (!wallet.publicKey) {
        toast.error('Please connect your wallet to enter the tournament');
        return false;
      }

      const tournaments = LeaderboardManager.getTournaments();
      const tournament = tournaments.find((t) => t.id === tournamentId);

      if (!tournament) {
        toast.error('Tournament not found');
        return false;
      }

      if (tournament.status !== 'active') {
        toast.error('This tournament is not currently active');
        return false;
      }

      if (tournament.participants.includes(wallet.publicKey.toString())) {
        toast.info('You have already entered this tournament');
        return true;
      }

      const paid = await makePayment(connection, wallet, tournament.entryFee);
      if (!paid) {
        return false;
      }

      const success = LeaderboardManager.joinTournament(
        tournamentId,
        wallet.publicKey.toString(),
        tournament.entryFee
      );

      if (success) {
        toast.success(`You've entered the ${tournament.name} tournament!`);
      }

      return success;
    } catch (error) {
      console.error('Error entering tournament:', error);
      toast.error('Failed to enter tournament');
      return false;
    }
  }

  /**
   * Get a player's tournament statistics
   */
  static getPlayerTournamentStats(
    playerWallet: string,
    tournamentId: string
  ): { rank: number; hasEntered: boolean } {
    const tournaments = LeaderboardManager.getTournaments();
    const tournament = tournaments.find((t) => t.id === tournamentId);

    if (!tournament) {
      return { rank: 0, hasEntered: false };
    }

    const hasEntered = tournament.participants.includes(playerWallet);
    const rank = LeaderboardManager.getPlayerTournamentRank(playerWallet, tournamentId);

    return { rank, hasEntered };
  }

  /**
   * Calculate prize distribution for a tournament
   */
  static calculatePrizeDistribution(tournamentId: string): TournamentPrize[] {
    try {
      const tournaments = LeaderboardManager.getTournaments();
      const tournament = tournaments.find((t) => t.id === tournamentId);

      if (!tournament) {
        return [];
      }

      return DEFAULT_PRIZE_DISTRIBUTION.map((prize) => ({
        ...prize,
        amount: (tournament.prizePool * prize.percentage) / 100,
      }));
    } catch (error) {
      console.error('Error calculating prize distribution:', error);
      return [];
    }
  }

  /**
   * End a tournament and determine winners
   */
  static endTournament(tournamentId: string): Tournament | null {
    try {
      const tournaments = LeaderboardManager.getTournaments();
      const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);

      if (tournamentIndex === -1) {
        toast.error('Tournament not found');
        return null;
      }

      const tournament = tournaments[tournamentIndex];

      tournament.status = 'completed';

      const leaderboard = LeaderboardManager.getTournamentLeaderboard(tournamentId);
      tournament.winners = leaderboard.slice(0, 3);

      tournaments[tournamentIndex] = tournament;
      localStorage.setItem(
        (LeaderboardManager as any).TOURNAMENTS_STORAGE_KEY,
        JSON.stringify(tournaments)
      );

      return tournament;
    } catch (error) {
      console.error('Error ending tournament:', error);
      return null;
    }
  }

  /**
   * Check and update tournament statuses
   */
  static checkAndUpdateTournaments(): void {
    try {
      const tournaments = LeaderboardManager.getTournaments();
      let updated = false;
      const now = new Date();

      tournaments.forEach((tournament) => {
        const startTime = new Date(tournament.startTime);
        const endTime = new Date(tournament.endTime);

        if (tournament.status === 'upcoming' && now >= startTime && now < endTime) {
          tournament.status = 'active';
          updated = true;
        }

        if (tournament.status === 'active' && now >= endTime) {
          tournament.status = 'completed';

          const leaderboard = LeaderboardManager.getTournamentLeaderboard(tournament.id);
          tournament.winners = leaderboard.slice(0, 3);
          updated = true;
        }
      });

      if (updated) {
        localStorage.setItem(
          (LeaderboardManager as any).TOURNAMENTS_STORAGE_KEY,
          JSON.stringify(tournaments)
        );
      }
    } catch (error) {
      console.error('Error updating tournament statuses:', error);
    }
  }

  /**
   * Get available tournaments for a player
   */
  static getAvailableTournaments(playerWallet?: string): Tournament[] {
    try {
      const tournaments = LeaderboardManager.getTournaments();
      const activeTournaments = tournaments.filter((t) => t.status === 'active');

      if (!playerWallet) {
        return activeTournaments;
      }

      return activeTournaments.map((tournament) => ({
        ...tournament,
        hasEntered: tournament.participants.includes(playerWallet),
      })) as Tournament[];
    } catch (error) {
      console.error('Error getting available tournaments:', error);
      return [];
    }
  }

  /**
   * Get all currently active tournaments
   */
  static getActiveTournaments(): Tournament[] {
    try {
      const tournaments = LeaderboardManager.getTournaments();
      return tournaments.filter((t) => t.status === 'active');
    } catch (error) {
      console.error('Error getting active tournaments:', error);
      return [];
    }
  }

  /**
   * Create initial tournaments if none exist
   * (This should be called when the app initializes)
   */
  static initializeTournaments(): void {
    try {
      const existingTournaments = LeaderboardManager.getTournaments();

      if (existingTournaments.length === 0) {
        const now = new Date();

        // Easy tournament – ends in 1 day
        const easyEndTime = new Date(now);
        easyEndTime.setDate(now.getDate() + 1);
        TournamentManager.createTournament(
          'Easy Tournament',
          0.01,
          now,
          easyEndTime,
          'easy'
        );

        // Medium tournament – ends in 3 days
        const mediumEndTime = new Date(now);
        mediumEndTime.setDate(now.getDate() + 3);
        TournamentManager.createTournament(
          'Medium Tournament',
          0.1,
          now,
          mediumEndTime,
          'medium'
        );

        // Hard tournament – ends in 7 days
        const hardEndTime = new Date(now);
        hardEndTime.setDate(now.getDate() + 7);
        TournamentManager.createTournament(
          'Hard Tournament',
          0.9,
          now,
          hardEndTime,
          'hard'
        );
      }
    } catch (error) {
      console.error('Error initializing tournaments:', error);
    }
  }
}
