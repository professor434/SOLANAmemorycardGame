import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { truncateWalletAddress } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

export const WalletButton = () => {
  const { publicKey, disconnecting, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleWalletButtonClick = async () => {
    if (connected) {
      try {
        setIsDisconnecting(true);
        // For UX, we'll add a small delay before disconnecting to show the loading state
        await new Promise(resolve => setTimeout(resolve, 300));
        setVisible(true);
        setIsDisconnecting(false);
      } catch (error) {
        console.error('Error disconnecting:', error);
        setIsDisconnecting(false);
      }
    } else {
      setVisible(true);
    }
  };

  const buttonText = () => {
    if (connecting || isDisconnecting) {
      return 'Connecting...';
    }
    if (connected && publicKey) {
      return truncateWalletAddress(publicKey.toString());
    }
    return 'Connect Wallet';
  };

  return (
    <Button
      onClick={handleWalletButtonClick}
      variant="outline"
      className="wallet-adapter-button-custom"
      disabled={connecting || disconnecting || isDisconnecting}
    >
      {connecting || isDisconnecting ? (
        <Spinner size="sm" className="mr-2 border-amber-500 border-r-transparent" />
      ) : null}
      {buttonText()}
    </Button>
  );
};

export default WalletButton;