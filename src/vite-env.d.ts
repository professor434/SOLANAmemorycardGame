/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_SOLANA_NETWORK?: string;
  readonly VITE_SOLANA_RPC?: string;
  readonly NEXT_PUBLIC_SOLANA_NETWORK?: string;
  readonly NEXT_PUBLIC_SOLANA_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  lastTransactionSignature?: string;
}