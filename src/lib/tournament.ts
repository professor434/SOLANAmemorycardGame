import { LeaderboardManager, Tournament, LeaderboardEntry } from './leaderboard';
import { toast } from 'sonner';
import { makePayment } from './solana';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

export interface TournamentPrize {
  rank: number;
  percentage: number;
  amount: number;
}

// Default prize distribution percentages
const DEFAULT_PRIZE_DISTRIBUTION: { rank: number; percentage: number }[] = [
  { rank: 1, percentage: 50 }, // First place: 50% of the prize pool
  { rank: 2, percentage: 30 }, // Second place: 30% of the prize pool
  { rank: 3, percentage: 15 }, // Third place: 15% of the prize pool
  // 5% goes to the treasury
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
      // Validate parameters
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
      
      // Create tournament
      const tournament = LeaderboardManager.createTournament({
        name,
        entryFee,
        startTime,
        endTime,
        status,
        difficulty
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
      const tournament = tournaments.find(t => t.id === tournamentId);
      
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
      
      // Make payment for entry fee
      try {
        await makePayment(connection, wallet, tournament.entryFee);
      } catch (error) {
        // Payment failed, don't proceed with entering tournament
        return false;
      }
      
      // Add player to tournament
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
    const tournament = tournaments.find(t => t.id === tournamentId);
    
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
      const tournament = tournaments.find(t => t.id === tournamentId);
      
      if (!tournament) {
        return [];
      }
      
      return DEFAULT_PRIZE_DISTRIBUTION.map(prize => ({
        ...prize,
        amount: (tournament.prizePool * prize.percentage) / 100
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
      const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
      
      if (tournamentIndex === -1) {
        toast.error('Tournament not found');
        return null;
      }
      
      const tournament = tournaments[tournamentIndex];
      
      // Set status to completed
      tournament.status = 'completed';
      
      // Get top players
      const leaderboard = LeaderboardManager.getTournamentLeaderboard(tournamentId);
      tournament.winners = leaderboard.slice(0, 3); // Top 3 winners
      
      // Update tournament
      tournaments[tournamentIndex] = tournament;
      localStorage.setItem(LeaderboardManager['TOURNAMENTS_STORAGE_KEY'], JSON.stringify(tournaments));
      
      return tournament;
    } catch (error) {
      console.error('Error ending tournament:', error);
      return null;
    }
  }

  /**
   * Check and update tournament statuses
   * (This should be called periodically to update tournament statuses)
   */
  static checkAndUpdateTournaments(): void {
    try {
      const tournaments = LeaderboardManager.getTournaments();
      let updated = false;
      
      const now = new Date();
      
      tournaments.forEach(tournament => {
        const startTime = new Date(tournament.startTime);
        const endTime = new Date(tournament.endTime);
        
        // Update upcoming to active
        if (tournament.status === 'upcoming' && now >= startTime && now < endTime) {
          tournament.status = 'active';
          updated = true;
        }
        
        // Update active to completed
        if (tournament.status === 'active' && now >= endTime) {
          tournament.status = 'completed';
          
          // Get winners
          const leaderboard = LeaderboardManager.getTournamentLeaderboard(tournament.id);
          tournament.winners = leaderboard.slice(0, 3); // Top 3 winners
          
          updated = true;
        }
      });
      
      // Save if any updates were made
      if (updated) {
        localStorage.setItem(LeaderboardManager['TOURNAMENTS_STORAGE_KEY'], JSON.stringify(tournaments));
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
      
      // Filter to only show active tournaments
      const activeTournaments = tournaments.filter(t => t.status === 'active');
      
      if (!playerWallet) {
        return activeTournaments;
      }
      
      // Mark if player has entered each tournament
      return activeTournaments.map(tournament => ({
        ...tournament,
        hasEntered: tournament.participants.includes(playerWallet)
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
      return tournaments.filter(t => t.status === 'active');
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
        // Create initial tournaments with different difficulties
        const now = new Date();

        // Create an "easy" tournament ending in 1 day
        const easyEndTime = new Date(now);
        easyEndTime.setDate(now.getDate() + 1);
        TournamentManager.createTournament(
          'Easy Tournament',
          0.01, // 0.01 SOL entry fee
          now,
          easyEndTime,
          'easy'
        );

        // Create a "medium" tournament ending in 3 days
        const mediumEndTime = new Date(now);
        mediumEndTime.setDate(now.getDate() + 3);
        TournamentManager.createTournament(
          'Medium Tournament',
          0.05, // 0.05 SOL entry fee
          now,
          mediumEndTime,
          'medium'
        );

        // Create a "hard" tournament ending in 7 days
        const hardEndTime = new Date(now);
        hardEndTime.setDate(now.getDate() + 7);
        TournamentManager.createTournament(
          'Hard Tournament',
          0.1, // 0.1 SOL entry fee
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

// Convenience function to initialize tournaments without accessing the manager directly
export function initializeTournaments(): void {
  TournamentManager.initializeTournaments();
}
