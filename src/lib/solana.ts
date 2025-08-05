import { PublicKey, Transaction, SystemProgram, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';

// Treasury wallet address - The wallet that will receive entry fees
const TREASURY_WALLET = new PublicKey('2WPrEmPFTWfG9WfMDd3W6SGYUvFeTgLbNpAwbJ5nvX4c');

// Fee settings (0.1%)
const FEE_PERCENTAGE = 0.001; // 0.1%

/**
 * Make a payment of SOL
 */
export async function makePayment(
  connection: Connection,
  wallet: WalletContextState,
  amount: number,
): Promise<boolean> {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error('Wallet not connected');
      return false;
    }

    // Calculate fee
    const fee = amount * FEE_PERCENTAGE;

    const totalAmount = amount + fee;

    // Convert SOL to lamports
    const lamports = Math.floor(totalAmount * LAMPORTS_PER_SOL);

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: TREASURY_WALLET,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signedTransaction.serialize());

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txid, 'confirmed');
    
    if (confirmation.value.err) {
      toast.error('Transaction failed');
      return false;
    }

    toast.success(`Payment of ${totalAmount} SOL successful!`);
    return true;
  } catch (error) {
    console.error('Payment error:', error);
    toast.error(`Payment failed: ${error.message}`);
    return false;
  }
}

/**
 * Distribute prize to winner
 */
export async function distributePrize(
  connection: Connection,
  wallet: WalletContextState, // Admin wallet
  winnerAddress: string,
  amount: number
): Promise<boolean> {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error('Admin wallet not connected');
      return false;
    }

    const winnerPublicKey = new PublicKey(winnerAddress);
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: winnerPublicKey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const txid = await connection.sendRawTransaction(signedTransaction.serialize());

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txid, 'confirmed');
    
    if (confirmation.value.err) {
      toast.error('Prize distribution failed');
      return false;
    }

    toast.success(`Prize of ${amount} SOL sent to ${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}`);
    return true;
  } catch (error) {
    console.error('Prize distribution error:', error);
    toast.error(`Prize distribution failed: ${error.message}`);
    return false;
  }
}

/**
 * Get SOL balance for a wallet
 */
export async function getBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

/**
 * Airdrop SOL to a wallet (for devnet testing)
 */
export async function requestAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  amount = 1
): Promise<boolean> {
  try {
    const lamports = amount * LAMPORTS_PER_SOL;
    const signature = await connection.requestAirdrop(publicKey, lamports);
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      toast.error('Airdrop failed');
      return false;
    }
    
    toast.success(`${amount} SOL airdropped successfully!`);
    return true;
  } catch (error) {
    console.error('Airdrop error:', error);
    toast.error(`Airdrop failed: ${error.message}`);
    return false;
  }
}
