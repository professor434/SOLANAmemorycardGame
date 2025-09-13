// src/App.tsx
import React from 'react';
import '../styles/index.css';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SolanaWalletProvider } from './components/SolanaWalletProvider';
import Index from './pages/Index';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta');
const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || network;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConnectionProvider endpoint={endpoint}>
          <SolanaWalletProvider>
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SolanaWalletProvider>
        </ConnectionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
