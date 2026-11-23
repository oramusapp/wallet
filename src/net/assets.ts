// What the wallet shows and can send. Phase 2: testnets only.
export type AssetKind = 'evm' | 'erc20' | 'hl' | 'btc' | 'sol' | 'sui' | 'apt' | 'near' | 'xlm' | 'algo' | 'none';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  /** Which derived account holds it (chains.ts id). */
  chainId: string;
  network: string;
  decimals: number;
  kind: AssetKind;
  color: string;
  /** JSON-RPC / REST base for balances and sending. */
  rpc?: string;
  evmChainId?: number;
  /** ERC-20 contract (kind 'erc20'); the fee is paid in the network's native coin. */
  token?: string;
  feeSymbol?: string;
  /** OP-stack chain (Base, Optimism): an extra L1 data fee is charged on top of gas × price. */
  opStack?: boolean;
  explorerTx?: (hash: string) => string;
  explorerAddr?: (addr: string) => string;
  canSend: boolean;
  faucet?: string;
  note?: string;
}

export const ASSETS: Asset[] = [
  { id: 'eth-sepolia', symbol: 'ETH', name: 'Ethereum', chainId: 'evm', network: 'Sepolia', decimals: 18, kind: 'evm', color: '#7b8cff',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com', evmChainId: 11155111, canSend: true,
    explorerTx: (h) => 'https://sepolia.etherscan.io/tx/' + h, explorerAddr: (a) => 'https://sepolia.etherscan.io/address/' + a, faucet: 'https://www.alchemy.com/faucets/ethereum-sepolia' },
  { id: 'eth-arb-sepolia', symbol: 'ETH', name: 'Ethereum', chainId: 'evm', network: 'Arbitrum Sepolia', decimals: 18, kind: 'evm', color: '#2d9cdb',
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc', evmChainId: 421614, canSend: true,
    explorerTx: (h) => 'https://sepolia.arbiscan.io/tx/' + h, explorerAddr: (a) => 'https://sepolia.arbiscan.io/address/' + a },
  { id: 'eth-base-sepolia', symbol: 'ETH', name: 'Ethereum', chainId: 'evm', network: 'Base Sepolia', decimals: 18, kind: 'evm', color: '#3b6cff',
    rpc: 'https://sepolia.base.org', evmChainId: 84532, canSend: true, opStack: true,
    explorerTx: (h) => 'https://sepolia.basescan.org/tx/' + h, explorerAddr: (a) => 'https://sepolia.basescan.org/address/' + a },
  // USDC test tokens — addresses from Circle's docs (developers.circle.com/stablecoins/usdc-contract-addresses), symbol/decimals checked on-chain
  { id: 'usdc-arb-sepolia', symbol: 'USDC', name: 'USD Coin', chainId: 'evm', network: 'Arbitrum Sepolia', decimals: 6, kind: 'erc20', color: '#2775ca',
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc', evmChainId: 421614, token: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', feeSymbol: 'ETH', canSend: true,
    explorerTx: (h) => 'https://sepolia.arbiscan.io/tx/' + h, explorerAddr: (a) => 'https://sepolia.arbiscan.io/token/0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d?a=' + a, faucet: 'https://faucet.circle.com' },
  { id: 'usdc-base-sepolia', symbol: 'USDC', name: 'USD Coin', chainId: 'evm', network: 'Base Sepolia', decimals: 6, kind: 'erc20', color: '#2775ca',
    rpc: 'https://sepolia.base.org', evmChainId: 84532, token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', feeSymbol: 'ETH', canSend: true, opStack: true,
    explorerTx: (h) => 'https://sepolia.basescan.org/tx/' + h, explorerAddr: (a) => 'https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e?a=' + a, faucet: 'https://faucet.circle.com' },
  { id: 'usdc-hl', symbol: 'USDC', name: 'Konto Hyperliquid', chainId: 'evm', network: 'Hyperliquid testnet', decimals: 6, kind: 'hl', color: '#50e3c2',
    rpc: 'https://api.hyperliquid-testnet.xyz/info', canSend: false, explorerAddr: (a) => 'https://app.hyperliquid-testnet.xyz/explorer/address/' + a,
    note: 'Saldo konta (perpy + spot). Wpłaty: stary most Hyperliquid jest wycofany (deprecated), zalecany jest Circle CCTP — wpłaty dodamy po przygotowaniu tej ścieżki.' },
  { id: 'btc-testnet4', symbol: 'BTC', name: 'Bitcoin', chainId: 'btc', network: 'Testnet4', decimals: 8, kind: 'btc', color: '#f7931a',
    rpc: 'https://mempool.space/testnet4/api', canSend: true,
    explorerTx: (h) => 'https://mempool.space/testnet4/tx/' + h, explorerAddr: (a) => 'https://mempool.space/testnet4/address/' + a, faucet: 'https://mempool.space/testnet4/faucet' },
  { id: 'sol-devnet', symbol: 'SOL', name: 'Solana', chainId: 'sol', network: 'Devnet', decimals: 9, kind: 'sol', color: '#9945ff',
    rpc: 'https://api.devnet.solana.com', canSend: true, explorerTx: (h) => 'https://explorer.solana.com/tx/' + h + '?cluster=devnet', explorerAddr: (a) => 'https://explorer.solana.com/address/' + a + '?cluster=devnet', faucet: 'https://faucet.solana.com' },
  { id: 'sui-testnet', symbol: 'SUI', name: 'Sui', chainId: 'sui', network: 'Testnet', decimals: 9, kind: 'sui', color: '#4da2ff',
    rpc: 'https://graphql.testnet.sui.io/graphql', canSend: false, explorerAddr: (a) => 'https://suiscan.xyz/testnet/account/' + a },
  { id: 'apt-testnet', symbol: 'APT', name: 'Aptos', chainId: 'apt', network: 'Testnet', decimals: 8, kind: 'apt', color: '#2ed8a3',
    rpc: 'https://api.testnet.aptoslabs.com/v1', canSend: false, explorerAddr: (a) => 'https://explorer.aptoslabs.com/account/' + a + '?network=testnet' },
  { id: 'near-testnet', symbol: 'NEAR', name: 'NEAR', chainId: 'near', network: 'Testnet', decimals: 24, kind: 'near', color: '#c9d1d9',
    rpc: 'https://rpc.testnet.near.org', canSend: false, explorerAddr: (a) => 'https://testnet.nearblocks.io/address/' + a },
  { id: 'xlm-testnet', symbol: 'XLM', name: 'Stellar', chainId: 'xlm', network: 'Testnet', decimals: 7, kind: 'xlm', color: '#e6e6e6',
    rpc: 'https://horizon-testnet.stellar.org', canSend: true, explorerTx: (h) => 'https://stellar.expert/explorer/testnet/tx/' + h, explorerAddr: (a) => 'https://stellar.expert/explorer/testnet/account/' + a,
    note: 'Konto Stellar powstaje dopiero po pierwszej wpłacie (min. 1 XLM). Przy wpłacie na giełdę zwykle trzeba podać memo.' },
  { id: 'algo-testnet', symbol: 'ALGO', name: 'Algorand', chainId: 'algo', network: 'Testnet', decimals: 6, kind: 'algo', color: '#bfbfbf',
    rpc: 'https://testnet-api.algonode.cloud', canSend: true, explorerTx: (h) => 'https://lora.algokit.io/testnet/transaction/' + h, explorerAddr: (a) => 'https://lora.algokit.io/testnet/account/' + a },
  { id: 'ltc', symbol: 'LTC', name: 'Litecoin', chainId: 'ltc', network: 'Testnet', decimals: 8, kind: 'none', color: '#bebebe', canSend: false, note: 'Saldo i wysyłka w kolejnym etapie (brak publicznego API testnetu).' },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', chainId: 'doge', network: 'Testnet', decimals: 8, kind: 'none', color: '#c2a633', canSend: false, note: 'Saldo i wysyłka w kolejnym etapie (brak publicznego API testnetu).' },
  { id: 'dash', symbol: 'DASH', name: 'Dash', chainId: 'dash', network: 'Testnet', decimals: 8, kind: 'none', color: '#008de4', canSend: false, note: 'Saldo i wysyłka w kolejnym etapie (brak publicznego API testnetu).' },
  { id: 'zec', symbol: 'ZEC', name: 'Zcash', chainId: 'zec', network: 'Testnet', decimals: 8, kind: 'none', color: '#f4b728', canSend: false, note: 'Zcash podpisuje transakcje inaczej niż Bitcoin; osobny etap.' }
];

export const assetById = (id: string) => ASSETS.find((a) => a.id === id);
