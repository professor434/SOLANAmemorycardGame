import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

const NETWORK_FALLBACK = WalletAdapterNetwork.Devnet;

const NETWORK_ALIASES: Record<string, WalletAdapterNetwork> = {
  devnet: WalletAdapterNetwork.Devnet,
  mainnet: WalletAdapterNetwork.Mainnet,
  'mainnet-beta': WalletAdapterNetwork.Mainnet,
  mainnetbeta: WalletAdapterNetwork.Mainnet,
  testnet: WalletAdapterNetwork.Testnet,
};

const ENV = import.meta.env as Record<string, string | undefined>;

const readEnvValue = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = ENV[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const hasProtocol = (value: string) => /^https?:\/\//i.test(value);

const resolveNetworkAlias = (value?: string): WalletAdapterNetwork | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return NETWORK_ALIASES[normalized];
};

const sanitizeEndpoint = (value: string): string => {
  const aliasNetwork = resolveNetworkAlias(value);
  if (aliasNetwork) {
    return clusterApiUrl(aliasNetwork);
  }

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (hasProtocol(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
};

export const getConfiguredNetwork = (): WalletAdapterNetwork => {
  const envValue = readEnvValue('VITE_SOLANA_NETWORK', 'NEXT_PUBLIC_SOLANA_NETWORK');
  return resolveNetworkAlias(envValue) ?? NETWORK_FALLBACK;
};

export const getConfiguredEndpoint = (network?: WalletAdapterNetwork): string => {
  const resolvedNetwork = network ?? getConfiguredNetwork();
  const envEndpoint = readEnvValue('VITE_SOLANA_RPC', 'NEXT_PUBLIC_SOLANA_RPC');

  if (envEndpoint) {
    const sanitized = sanitizeEndpoint(envEndpoint);
    if (sanitized) {
      return sanitized;
    }
  }

  return clusterApiUrl(resolvedNetwork);
};
