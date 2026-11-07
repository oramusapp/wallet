import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Coin } from '../config/coins';
import { fmtAmount, fmtCompactUsd, fmtPct, fmtPrice, fmtUsd, fmtUsdDelta, signClass, trendClass } from '../lib/format';
import type { Position } from '../lib/portfolio';
import type { MarketStats } from '../lib/hyperliquid';

/* ---------- icons (inline SVG, currentColor) ---------- */

const paths = {
  send: <path d="M4 5h16l-6.5 7.5V19l-3 1.5v-8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M7 10l5 5 5-5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  sliders: <path d="M7 4v6M7 14v6M5 14h4M17 4v4M17 12v8M15 8h4M12 4v10M12 18v2M10 14h4" />,
  cash: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  coins: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M14.5 9.6a5.5 5.5 0 1 1-4.9 4.9" />
    </>
  ),
  receive: <path d="M12 4v12M6 10l6 6 6-6M5 20h14" />,
  swap: <path d="M7 4v14M3.5 14.5L7 18l3.5-3.5M17 20V6M13.5 9.5L17 6l3.5 3.5" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  dots: (
    <>
      <circle cx="5.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18.5" cy="12" r="1.3" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, filled = false, className }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/* ---------- primitives ---------- */

const FALLBACK_COLORS = ['#5b8def', '#e8833a', '#3fb68b', '#a99cf6', '#e0517a', '#d4b13f', '#4fb3c9', '#8c6be8'];

/** Coin logo; a lettered avatar is shown until the image loads, and stays if it fails. */
export function CoinIcon({ coin, size = 44 }: { coin: Coin; size?: number }) {
  // keyed by URL so a different coin in the same slot starts over
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ok = loaded === coin.icon;
  let h = 0;
  for (const ch of coin.symbol) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={`coin-icon coin-fallback${ok ? ' loaded' : ''}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * (coin.symbol.length > 3 ? 0.3 : 0.36),
        background: ok ? 'transparent' : FALLBACK_COLORS[h % FALLBACK_COLORS.length],
      }}
    >
      {!ok && coin.symbol.slice(0, 4)}
      {coin.icon && failed !== coin.icon && (
        <img
          src={coin.icon}
          alt=""
          draggable={false}
          loading="lazy"
          style={{ opacity: ok ? 1 : 0 }}
          onLoad={() => setLoaded(coin.icon)}
          onError={() => setFailed(coin.icon)}
        />
      )}
    </span>
  );
}

export function IconButton({ icon, label, ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function Button({ variant = 'primary', className = '', ...rest }: { variant?: 'primary' | 'secondary' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`btn btn-${variant} ${className}`} {...rest} />;
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={`chip${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={onChange}>
      <span />
    </button>
  );
}

export function Avatar({ name, size = 36, onClick }: { name: string; size?: number; onClick?: () => void }) {
  const initials = initialsOf(name);
  const El = onClick ? 'button' : 'span';
  return (
    <El className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} onClick={onClick} {...(onClick ? { type: 'button', 'aria-label': 'Open menu' } : {})}>
      {initials}
    </El>
  );
}

export function initialsOf(name: string): string {
  const m = name.match(/^Account (\d+)$/);
  if (m) return `A${m[1]}`;
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function SectionTitle({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  if (!onClick) return <h2 className="section-title">{children}</h2>;
  return (
    <button type="button" className="section-title link" onClick={onClick}>
      {children}
      <Icon name="chevronRight" size={18} />
    </button>
  );
}

export function SheetHeader({ title, onBack, onClose, right }: { title: string; onBack?: () => void; onClose?: () => void; right?: ReactNode }) {
  return (
    <div className="sheet-header">
      {onBack && <IconButton icon="back" label="Back" onClick={onBack} />}
      {!onBack && onClose && <IconButton icon="close" label="Close" onClick={onClose} />}
      <h1>{title}</h1>
      <div className="sheet-header-right">{right}</div>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = 'Search', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="search-field">
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} />
    </label>
  );
}

export function Pct({ value, badge = false }: { value: number | undefined; badge?: boolean }) {
  return <span className={`${trendClass(value)}${badge ? ' badge' : ''}`}>{fmtPct(value)}</span>;
}

/* ---------- rows ---------- */

/** Rounded card row: icon · name / amount · value / 24h delta (Tokens list). */
export function TokenCard({ p, onClick }: { p: Position; onClick?: () => void }) {
  const t = signClass(p.delta24h);
  return (
    <button type="button" className="token-card" onClick={onClick}>
      <CoinIcon coin={p.coin} />
      <div className="col grow">
        <span className="row-title">{p.coin.name}</span>
        <span className="row-sub">{fmtAmount(p.amount, p.coin.symbol)}</span>
      </div>
      <div className="col end">
        <span className="row-title">{p.price === undefined ? '—' : fmtUsd(p.value)}</span>
        <span className={`row-sub ${t}`}>{p.price === undefined ? '' : fmtUsdDelta(p.delta24h)}</span>
      </div>
    </button>
  );
}

/** Plain market row: icon · SYMBOL / MC · price / 24h % (Explore Markets list). */
export function MarketRow({ coin, stats, mc, onClick }: { coin: Coin; stats: MarketStats | undefined; mc: number | undefined; onClick?: () => void }) {
  return (
    <button type="button" className="market-row" onClick={onClick}>
      <CoinIcon coin={coin} size={48} />
      <div className="col grow">
        <span className="row-title lg">{coin.symbol}</span>
        <span className="row-sub lg">{mc !== undefined ? `${fmtCompactUsd(mc)} MC` : stats?.volume24h ? `${fmtCompactUsd(stats.volume24h)} Vol` : coin.name}</span>
      </div>
      <div className="col end">
        <span className="row-title lg">{fmtPrice(stats?.price)}</span>
        <span className="row-sub lg">
          <Pct value={stats?.change24h} />
        </span>
      </div>
    </button>
  );
}

export function Skeleton({ h = 64 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />;
}
