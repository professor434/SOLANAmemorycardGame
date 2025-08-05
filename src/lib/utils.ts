import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PublicKey } from '@solana/web3.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Truncate wallet address for display
 */
export function truncateWalletAddress(address: string, startLength = 4, endLength = 4): string {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  
  const start = address.substring(0, startLength);
  const end = address.substring(address.length - endLength);
  
  return `${start}...${end}`;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

/**
 * Format currency (SOL)
 */
export function formatSOL(amount: number): string {
  return `${amount.toFixed(3)} SOL`;
}

/**
 * Shuffle an array (for card shuffling)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Calculate time remaining for a tournament
 */
export function calculateTimeRemaining(endTime: Date): { 
  days: number; 
  hours: number; 
  minutes: number; 
  seconds: number 
} {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds };
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(timeRemaining: { 
  days: number; 
  hours: number; 
  minutes: number; 
  seconds: number 
}): string {
  const { days, hours, minutes, seconds } = timeRemaining;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Generate a point score based on time and moves
 */
/**
 * Format seconds into mm:ss display format
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function calculateScore(timeElapsed: number, moves: number, difficulty: string): number {
  // Base points start higher for harder difficulties
  let basePoints = 1000;
  let timeMultiplier = 1.0;
  let moveMultiplier = 1.0;
  
  switch (difficulty) {
    case 'easy':
      basePoints = 1000;
      timeMultiplier = 0.8;
      moveMultiplier = 0.8;
      break;
    case 'medium':
      basePoints = 2000;
      timeMultiplier = 1.0;
      moveMultiplier = 1.0;
      break;
    case 'hard':
      basePoints = 3000;
      timeMultiplier = 1.2;
      moveMultiplier = 1.2;
      break;
    default:
      basePoints = 1000;
  }
  
  // Less time and fewer moves = higher score
  const timeDeduction = Math.floor(timeElapsed / 1000) * timeMultiplier;
  const moveDeduction = moves * moveMultiplier * 5;
  
  const score = Math.max(0, basePoints - timeDeduction - moveDeduction);
  return Math.round(score);
}