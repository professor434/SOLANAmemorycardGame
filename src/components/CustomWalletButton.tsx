import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Copy, Check, ExternalLink, LogOut } from 'lucide-react';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

const shortenAddress = (address: string) => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export default function CustomWalletButton() {
  const { publicKey, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  // Handle wallet disconnect
  const handleDisconnect = () => {
    disconnect();
  };

  // Handle address copy
  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle explorer link
  const handleExplorer = () => {
    if (publicKey) {
      window.open(`https://explorer.solana.com/address/${publicKey.toString()}`, '_blank');
    }
  };

  // If wallet is connected, show custom dropdown
  if (publicKey) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-amber-500 text-amber-400 hover:text-amber-500 hover:bg-amber-950/30">
            {shortenAddress(publicKey.toString())}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-black/90 border-amber-600/50 backdrop-blur-lg">
          <DropdownMenuLabel>My Wallet</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-amber-800/30" />
          <DropdownMenuItem
            className="cursor-pointer flex items-center justify-between"
            onClick={handleCopy}
          >
            <span>Copy Address</span>
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer flex items-center justify-between"
            onClick={handleExplorer}
          >
            <span>View on Explorer</span>
            <ExternalLink className="w-4 h-4" />
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-amber-800/30" />
          <DropdownMenuItem
            className="cursor-pointer flex items-center justify-between text-red-400"
            onClick={handleDisconnect}
          >
            <span>Disconnect</span>
            <LogOut className="w-4 h-4" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // If wallet is not connected, use default wallet adapter button with some styling
  return (
    <div className="wallet-adapter-dropdown">
      <WalletMultiButton 
        className="wallet-adapter-button wallet-adapter-button-custom"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          borderColor: "#d97706",
          borderWidth: "1px",
          color: "#f59e0b",
          fontFamily: "inherit",
          fontSize: "0.875rem",
          padding: "0.5rem 1rem",
          borderRadius: "0.375rem",
          backdropFilter: "blur(4px)",
        }} 
      />
    </div>
  );
}