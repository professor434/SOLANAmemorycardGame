import { v4 as uuidv4 } from 'uuid';
import { calculateTimeRemaining } from './utils';

export interface LeaderboardEntry {
  id: string;
  playerWallet: string;
  score: number;
  difficulty: string;
  moves: number;
  time: number;
  date: Date;
  tournamentId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'active' | 'completed';
  startTime: Date;
  endTime: Date;
  entryFee: number;
  prizePool: number;
  participants: string[];
  difficulty: string;
  winners?: LeaderboardEntry[];
  hasEntered?: boolean;
}

export class LeaderboardManager {
  private static readonly LEADERBOARD_STORAGE_KEY = 'solana_memory_game_leaderboard';
  private static readonly TOURNAMENTS_STORAGE_KEY = 'solana_memory_game_tournaments';

  /**
   * Add a score to the leaderboard
   */
  static addScore(
    playerWallet: string,
    score: number,
    difficulty: string,
    moves: number,
    time: number,
    tournamentId?: string
  ): LeaderboardEntry {
    try {
      // Create entry
      const entry: LeaderboardEntry = {
        id: uuidv4(),
        playerWallet,
        score,
        difficulty,
        moves,
        time,
        date: new Date(),
        tournamentId
      };

      // Get existing leaderboard
      const leaderboard = this.getLeaderboard();
      
      // Add new entry
      leaderboard.push(entry);
      
      // Sort by score (descending)
      leaderboard.sort((a, b) => b.score - a.score);
      
      // Save updated leaderboard
      localStorage.setItem(this.LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
      
      return entry;
    } catch (error) {
      console.error('Error adding score:', error);
      throw error;
    }
  }

  /**
   * Get the full leaderboard
   */
  static getLeaderboard(): LeaderboardEntry[] {
    try {
      const leaderboardData = localStorage.getItem(this.LEADERBOARD_STORAGE_KEY);
      return leaderboardData ? JSON.parse(leaderboardData) : [];
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Get leaderboard filtered by difficulty
   */
  static getLeaderboardByDifficulty(difficulty: string): LeaderboardEntry[] {
    try {
      const leaderboard = this.getLeaderboard();
      return leaderboard
        .filter(entry => entry.difficulty === difficulty && !entry.tournamentId)
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error getting leaderboard by difficulty:', error);
      return [];
    }
  }

  /**
   * Get a player's best score
   */
  static getPlayerBestScore(playerWallet: string, difficulty: string): number {
    try {
      const leaderboard = this.getLeaderboard();
      const playerEntries = leaderboard.filter(
        entry => entry.playerWallet === playerWallet && 
                entry.difficulty === difficulty &&
                !entry.tournamentId // Exclude tournament scores
      );
      
      if (playerEntries.length === 0) {
        return 0;
      }
      
      // Return highest score
      return Math.max(...playerEntries.map(entry => entry.score));
    } catch (error) {
      console.error('Error getting player best score:', error);
      return 0;
    }
  }

  /**
   * Get a player's rank on the leaderboard
   */
  static getPlayerRank(playerWallet: string, difficulty: string): number {
    try {
      const leaderboard = this.getLeaderboardByDifficulty(difficulty);
      
      // Find the player's best entry
      const bestPlayerScore = this.getPlayerBestScore(playerWallet, difficulty);
      
      if (bestPlayerScore === 0) {
        return 0; // Player has no scores
      }
      
      // Find the rank (position + 1)
      const position = leaderboard.findIndex(
        entry => entry.playerWallet === playerWallet && entry.score === bestPlayerScore
      );
      
      return position !== -1 ? position + 1 : 0;
    } catch (error) {
      console.error('Error getting player rank:', error);
      return 0;
    }
  }

  /**
   * Get all tournaments
   */
  static getTournaments(): Tournament[] {
    try {
      const tournamentsData = localStorage.getItem(this.TOURNAMENTS_STORAGE_KEY);
      const tournaments = tournamentsData ? JSON.parse(tournamentsData) : [];
      
      // Convert date strings back to Date objects
      return tournaments.map((tournament: any) => ({
        ...tournament,
        startTime: new Date(tournament.startTime),
        endTime: new Date(tournament.endTime)
      }));
    } catch (error) {
      console.error('Error getting tournaments:', error);
      return [];
    }
  }

  /**
   * Create a new tournament
   */
  static createTournament(tournamentData: Omit<Tournament, 'id' | 'prizePool' | 'participants' | 'winners'>): Tournament {
    try {
      const tournament: Tournament = {
        ...tournamentData,
        id: uuidv4(),
        prizePool: 0,
        participants: [],
        winners: []
      };
      
      const tournaments = this.getTournaments();
      tournaments.push(tournament);
      
      localStorage.setItem(this.TOURNAMENTS_STORAGE_KEY, JSON.stringify(tournaments));
      
      return tournament;
    } catch (error) {
      console.error('Error creating tournament:', error);
      throw error;
    }
  }

  /**
   * Join a tournament
   */
  static joinTournament(tournamentId: string, playerWallet: string, entryFee: number): boolean {
    try {
      const tournaments = this.getTournaments();
      const tournament = tournaments.find(t => t.id === tournamentId);
      
      if (!tournament) {
        console.error('Tournament not found');
        return false;
      }
      
      if (tournament.participants.includes(playerWallet)) {
        console.log('Player already in tournament');
        return true;
      }
      
      // Add player to participants
      tournament.participants.push(playerWallet);
      
      // Add entry fee to prize pool
      tournament.prizePool += entryFee;
      
      // Update tournaments
      localStorage.setItem(this.TOURNAMENTS_STORAGE_KEY, JSON.stringify(tournaments));
      
      return true;
    } catch (error) {
      console.error('Error joining tournament:', error);
      return false;
    }
  }

  /**
   * Get active tournament for a specific difficulty
   */
  static getActiveTournamentByDifficulty(difficulty: string): Tournament | null {
    try {
      const tournaments = this.getTournaments();
      
      // Find active tournament for this difficulty
      return tournaments.find(
        t => t.difficulty === difficulty && t.status === 'active'
      ) || null;
    } catch (error) {
      console.error('Error getting active tournament:', error);
      return null;
    }
  }

  /**
   * Get tournament leaderboard
   */
  static getTournamentLeaderboard(tournamentId: string): LeaderboardEntry[] {
    try {
      const leaderboard = this.getLeaderboard();
      
      // Filter entries for this tournament and sort by score
      return leaderboard
        .filter(entry => entry.tournamentId === tournamentId)
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error getting tournament leaderboard:', error);
      return [];
    }
  }

  /**
   * Get a player's tournament rank
   */
  static getPlayerTournamentRank(playerWallet: string, tournamentId: string): number {
    try {
      const tournamentLeaderboard = this.getTournamentLeaderboard(tournamentId);
      
      // Find the player's position
      const position = tournamentLeaderboard.findIndex(entry => entry.playerWallet === playerWallet);
      
      return position !== -1 ? position + 1 : 0;
    } catch (error) {
      console.error('Error getting player tournament rank:', error);
      return 0;
    }
  }

  /**
   * Get time remaining for a tournament
   */
  static getTournamentTimeRemaining(tournamentId: string) {
    try {
      const tournaments = this.getTournaments();
      const tournament = tournaments.find(t => t.id === tournamentId);
      
      if (!tournament) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      
      return calculateTimeRemaining(tournament.endTime);
    } catch (error) {
      console.error('Error calculating tournament time remaining:', error);
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
  }

  /**
   * Reset all leaderboard data (for testing purposes)
   */
  static resetLeaderboard(): void {
    localStorage.removeItem(this.LEADERBOARD_STORAGE_KEY);
  }

  /**
   * Reset all tournament data (for testing purposes)
   */
  static resetTournaments(): void {
    localStorage.removeItem(this.TOURNAMENTS_STORAGE_KEY);
  }
}