# Sieci i coiny

Coiny z SKB Portfolio (`oramusapp/portfolio`, `app/src/lib/tokens.ts`). Ścieżki jak w Trust Wallet Core.

## Grupa A — EVM (faza 1–2)
Jeden klucz `m/44'/60'/0'/0/0`, ten sam adres na wszystkich sieciach EVM.

| Sieć | Coiny |
| --- | --- |
| Ethereum | ETH, PEPE, SHIB, CRV, LINK, AAVE, UNI, PENDLE, ONDO, ENA, PAXG, WLFI, ZRO, LIT* |
| Arbitrum | ARB |
| Optimism | OP, WLD* |
| Base | AERO |
| BNB Chain | BNB, ASTER* |
| Avalanche C-Chain | AVAX |
| Hyperliquid / HyperEVM | HYPE (+ konto Hyperliquid podpisywane tym samym kluczem) |
| Monad | MON* |
| Plasma | XPL* |
| stablecoiny | USDC, USDT |

\* sieć do potwierdzenia przed obsługą tokena (nie zweryfikowane).

## Grupa B — Bitcoin i podobne
| Coin | Ścieżka (mainnet) | Adres |
| --- | --- | --- |
| BTC | m/84'/0'/0'/0/0 | bc1… (SegWit) |
| LTC | m/84'/2'/0'/0/0 | ltc1… |
| DOGE | m/44'/3'/0'/0/0 | D… |
| DASH | m/44'/5'/0'/0/0 | X… |
| ZEC | m/44'/133'/0'/0/0 | t1… (jawny); wysyłka w osobnym etapie — inny format podpisu |

Testnet: ścieżki z `1'` (tb1…, tltc1…, n…, y…).

## Grupa C — ed25519
| Coin | Ścieżka | Adres |
| --- | --- | --- |
| SOL (+ FARTCOIN, PUMP) | m/44'/501'/0' | base58 |
| SUI | m/44'/784'/0'/0'/0' | 0x + blake2b |
| APT | m/44'/637'/0'/0'/0' | 0x + sha3 |
| NEAR | m/44'/397'/0' | konto ukryte (hex) |
| XLM | m/44'/148'/0' | G… |
| ALGO | m/44'/283'/0'/0'/0' | base32 |

Uwaga: Phantom używa dla Solany innej ścieżki (m/44'/501'/0'/0'), więc te same słowa dadzą w nim inny adres SOL.

## Grupy D i E — przez Hyperliquid (decyzja autora, 23.11.2026)
XRP, TRX, ADA, DOT, FIL, ICP, INJ, TAO, GRAM, XMR — bez natywnych portfeli; ekspozycja przez konto Hyperliquid.

## Status (23.11.2026, wersja 0.6.0)
| Aktywo | Sieć główna | Testnet | Weryfikacja |
| --- | --- | --- | --- |
| ETH / BNB / AVAX / HYPE | Ethereum, Arbitrum, Base, Optimism, BNB Chain, Avalanche, HyperEVM | Sepolia, Arbitrum Sepolia, Base Sepolia | podpis odzyskuje nasz adres; chainId węzła sprawdzany |
| USDC i własne ERC-20 | Ethereum, Arbitrum, Base, Avalanche, HyperEVM (Circle) + dowolny kontrakt | Arbitrum Sepolia, Base Sepolia | dane transferu dekodowane w testach |
| BTC, LTC | tak (mempool.space, litecoinspace.org) | BTC testnet4, LTC testnet | podpis SegWit, plan wpłat i reszty |
| DOGE, DASH | tak (BlockCypher, P2PKH) | brak publicznego testnetu | podpis zweryfikowany względem sighash z bitcoinjs-lib |
| SOL | tak | devnet | bajt w bajt z @solana/web3.js |
| SUI | tak | testnet | bajt w bajt i podpis z @mysten/sui; format mutacji sprawdzony na węźle |
| APT | tak (chainId 1) | testnet (chainId 2) | bajt w bajt z @aptos-labs/ts-sdk; **prawdziwa wysyłka testnet** |
| NEAR | tak | testnet | bajt w bajt z @near-js/transactions |
| XLM | tak (z memo) | testnet | bajt w bajt z @stellar/stellar-sdk; **prawdziwa wysyłka testnet** |
| ALGO | tak | testnet | bajt w bajt z algosdk; **prawdziwa wysyłka testnet** |
| Konto Hyperliquid | saldo | saldo | wpłaty: stary most wycofany, CCTP — nie zrobione |
| ZEC | tylko adres | tylko adres | wysyłka wymaga formatu ZIP-244 — nie zrobione |
