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
