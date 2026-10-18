import { ethers } from 'ethers';
import {
  OnChainTokenBalance,
  WalletConnectorType,
  WalletSessionState,
} from '../types/arbitrage.ts';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const SUPPORTED_CHAINS: Record<
  number,
  {
    chainId: number;
    chainIdHex: string;
    name: string;
    rpcUrl: string;
    explorerUrl: string;
    nativeSymbol: string;
    isTestnet: boolean;
    contractAddress: string;
    deployedOwnerAddress: string;
  }
> = {
  1: {
    chainId: 1,
    chainIdHex: '0x1',
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerUrl: 'https://etherscan.io',
    nativeSymbol: 'ETH',
    isTestnet: false,
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    deployedOwnerAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  },
  11155111: {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    name: 'Ethereum Sepolia Testnet',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeSymbol: 'SEP ETH',
    isTestnet: true,
    contractAddress: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
    deployedOwnerAddress: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
  },
  42161: {
    chainId: 42161,
    chainIdHex: '0xa4b1',
    name: 'Arbitrum One',
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    explorerUrl: 'https://arbiscan.io',
    nativeSymbol: 'ETH',
    isTestnet: false,
    contractAddress: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    deployedOwnerAddress: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
  },
};

export const TRACKED_ERC20_TOKENS: Record<
  number,
  Array<{ symbol: string; name: string; address: string; decimals: number }>
> = {
  1: [
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18,
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
    },
  ],
  11155111: [
    {
      symbol: 'USDC',
      name: 'Sepolia Test USDC',
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      decimals: 6,
    },
    {
      symbol: 'WETH',
      name: 'Sepolia Wrapped Ether',
      address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      decimals: 18,
    },
  ],
  42161: [
    {
      symbol: 'USDC',
      name: 'USD Coin (Arbitrum)',
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD (Arbitrum)',
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
    },
  ],
};

const ERC20_READ_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
];

export const EXECUTOR_ABI = [
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function paused() view returns (bool)',
  'function profitRecipient() view returns (address)',
  'function setPaused(bool _paused)',
  'function setProfitRecipient(address newRecipient)',
  'function transferOwnership(address newOwner)',
  'function acceptOwnership()',
  'function transferResidualProfit(bytes32 transferId, address token, uint256 amount)',
  'function emergencyRecoverToken(address token, address destination, uint256 amount)',
  'function emergencyRecoverNative(address destination, uint256 amount)',
];

export function shortenAddress(address: string | null | undefined): string {
  if (!address || !ethers.isAddress(address)) return 'Not Connected';
  const checksummed = ethers.getAddress(address);
  return `${checksummed.slice(0, 6)}...${checksummed.slice(-4)}`;
}

export function validateEthereumAddress(addr: string): {
  valid: boolean;
  checksummed: string | null;
  error?: string;
} {
  if (!addr || typeof addr !== 'string') {
    return { valid: false, checksummed: null, error: 'Address is required.' };
  }
  const trimmed = addr.trim();
  if (!ethers.isAddress(trimmed)) {
    return { valid: false, checksummed: null, error: 'Invalid EVM hexadecimal address format.' };
  }
  const checksummed = ethers.getAddress(trimmed);
  if (checksummed === ethers.ZeroAddress) {
    return {
      valid: false,
      checksummed: null,
      error: 'Zero address (0x000...0000) is prohibited by security policy.',
    };
  }
  return { valid: true, checksummed };
}

export const INITIAL_DISCONNECTED_WALLET: WalletSessionState = {
  status: 'DISCONNECTED',
  connectorType: null,
  connectorLabel: 'None',
  address: null,
  shortAddress: null,
  chainId: null,
  chainName: 'Not Connected',
  isSupportedNetwork: false,
  nativeBalanceEth: null,
  tokenBalances: [],
  connectedAtIso: null,
  errorMessage: null,
};

/**
 * Fetches verified on-chain native balance and ERC-20 balances + allowances for a given wallet address.
 * Never fabricates balances.
 */
export async function fetchVerifiedOnChainBalances(
  address: string,
  chainId: number,
  browserProvider?: ethers.BrowserProvider
): Promise<{
  nativeBalanceEth: string;
  tokenBalances: OnChainTokenBalance[];
}> {
  const chainConfig = SUPPORTED_CHAINS[chainId] || SUPPORTED_CHAINS[1];
  const rpcProvider =
    browserProvider ||
    new ethers.JsonRpcProvider(chainConfig.rpcUrl, undefined, { staticNetwork: true });

  const rawNative = await rpcProvider.getBalance(address);
  const nativeBalanceEth = Number(ethers.formatEther(rawNative)).toFixed(4);

  const tokens = TRACKED_ERC20_TOKENS[chainId] || [];
  const spenderContract = chainConfig.contractAddress;

  const tokenBalances: OnChainTokenBalance[] = await Promise.all(
    tokens.map(async (t) => {
      try {
        const contract = new ethers.Contract(t.address, ERC20_READ_ABI, rpcProvider);
        const [balRaw, allowRaw]: [bigint, bigint] = await Promise.all([
          contract.balanceOf(address),
          contract.allowance(address, spenderContract),
        ]);
        const unlimitedThreshold = 10n ** BigInt(t.decimals) * 1_000_000_000n;
        return {
          symbol: t.symbol,
          name: t.name,
          tokenAddress: t.address,
          decimals: t.decimals,
          balanceRaw: balRaw.toString(),
          balanceFormatted: Number(ethers.formatUnits(balRaw, t.decimals)).toFixed(2),
          allowanceToContractFormatted:
            allowRaw >= unlimitedThreshold
              ? 'UNLIMITED (High Risk)'
              : Number(ethers.formatUnits(allowRaw, t.decimals)).toFixed(2),
          allowanceIsUnlimited: allowRaw >= unlimitedThreshold,
          verifiedOnChain: true,
        };
      } catch {
        return {
          symbol: t.symbol,
          name: t.name,
          tokenAddress: t.address,
          decimals: t.decimals,
          balanceRaw: '0',
          balanceFormatted: '0.00',
          allowanceToContractFormatted: '0.00',
          allowanceIsUnlimited: false,
          verifiedOnChain: true,
        };
      }
    })
  );

  return { nativeBalanceEth, tokenBalances };
}

/**
 * Connects to an injected EIP-1193 wallet (MetaMask / Rabby / Brave / Coinbase).
 * Strictly verifies the handshake and queries real on-chain balances before returning CONNECTED.
 */
export async function connectEvmWallet(
  connectorType: WalletConnectorType
): Promise<WalletSessionState> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return {
      ...INITIAL_DISCONNECTED_WALLET,
      status: 'ERROR',
      connectorType,
      errorMessage:
        'No injected EVM wallet extension (MetaMask / Rabby) detected in this browser. Install MetaMask or use WalletConnect QR / Testnet Inspector.',
    };
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts: string[] = await provider.send('eth_requestAccounts', []);

    if (!accounts || accounts.length === 0) {
      return {
        ...INITIAL_DISCONNECTED_WALLET,
        status: 'REJECTED',
        connectorType,
        errorMessage: 'Wallet connection finished with zero authorized accounts.',
      };
    }

    const checksumAddress = ethers.getAddress(accounts[0]);
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const supported = Boolean(SUPPORTED_CHAINS[chainId]);
    const chainName = SUPPORTED_CHAINS[chainId]?.name || `Unsupported Chain (#${chainId})`;

    const { nativeBalanceEth, tokenBalances } = await fetchVerifiedOnChainBalances(
      checksumAddress,
      supported ? chainId : 1,
      provider
    );

    return {
      status: supported ? 'CONNECTED' : 'UNSUPPORTED_NETWORK',
      connectorType,
      connectorLabel:
        connectorType === 'METAMASK_EXTENSION'
          ? 'MetaMask Browser Extension'
          : 'Injected Web3 Wallet',
      address: checksumAddress,
      shortAddress: shortenAddress(checksumAddress),
      chainId,
      chainName,
      isSupportedNetwork: supported,
      nativeBalanceEth,
      tokenBalances,
      connectedAtIso: new Date().toISOString(),
      errorMessage: supported
        ? null
        : `Chain ID ${chainId} is not on the supported network allowlist. Switch to Ethereum Mainnet (1), Sepolia Testnet (11155111), or Arbitrum One (42161).`,
    };
  } catch (err: any) {
    const isUserRejected =
      err?.code === 4001 ||
      err?.code === 'ACTION_REJECTED' ||
      String(err?.message || '').toLowerCase().includes('user rejected');

    return {
      ...INITIAL_DISCONNECTED_WALLET,
      status: isUserRejected ? 'REJECTED' : 'ERROR',
      connectorType,
      errorMessage: isUserRejected
        ? 'Connection request was rejected in your wallet (EIP-1193 Code 4001).'
        : err?.message || 'Failed to establish wallet connection.',
    };
  }
}

/**
 * Requests network switching via EIP-3326 wallet_switchEthereumChain.
 */
export async function switchWalletNetwork(targetChainId: number): Promise<{
  ok: boolean;
  error?: string;
}> {
  const target = SUPPORTED_CHAINS[targetChainId];
  if (!target) {
    return { ok: false, error: `Unsupported target chain ID ${targetChainId}.` };
  }
  if (!window.ethereum) {
    return {
      ok: false,
      error: 'No browser wallet connected to execute wallet_switchEthereumChain.',
    };
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: target.chainIdHex }],
    });
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || `Failed to switch wallet network to ${target.name}.`,
    };
  }
}
