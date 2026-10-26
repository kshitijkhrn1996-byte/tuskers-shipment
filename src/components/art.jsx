import { motion } from 'framer-motion'
import { TuskerMark } from './Logo.jsx'

// ---------- illustrations ----------

export function Truck({ className = 'w-56', moving = false }) {
  const wheel = (cx) => (
    <g key={cx}>
      <circle cx={cx} cy="80" r="10" fill="#1e293b" />
      <g className={moving ? 'wheel-spin' : ''} style={{ transformOrigin: `${cx}px 80px` }}>
        <circle cx={cx} cy="80" r="4.5" fill="#cbd5e1" />
        <path d={`M${cx - 4.5} 80h9M${cx} 75.5v9`} stroke="#64748b" strokeWidth="1.2" />
      </g>
    </g>
  )
  return (
    <svg viewBox="0 0 224 96" className={className} aria-hidden>
      <ellipse cx="112" cy="91" rx="104" ry="4" fill="#0f172a" opacity=".08" />
      {/* trailer */}
      <rect x="6" y="16" width="134" height="58" rx="7" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="6" y="62" width="134" height="12" rx="3" fill="#0f766e" />
      <rect x="6" y="62" width="134" height="3" fill="#f59e0b" />
      <foreignObject x="14" y="24" width="30" height="30"><TuskerMark className="h-[30px] w-[30px]" /></foreignObject>
      <text x="50" y="40" fontFamily="Geist, sans-serif" fontWeight="800" fontSize="15" fill="#0f172a" letterSpacing="-0.3">Tuskers</text>
      <text x="50" y="51" fontFamily="Geist, sans-serif" fontWeight="700" fontSize="6.4" fill="#d97706" letterSpacing="2.2">FREIGHT</text>
      {/* cab */}
      <path d="M143 30h36c5 0 8.5 2.2 11 6.4l12 19.6c1.3 2.1 2 4.6 2 7.1V74h-61z" fill="#14b8a6" />
      <path d="M143 30h36c5 0 8.5 2.2 11 6.4l3 4.8h-50z" fill="#2dd4bf" opacity=".5" />
      <path d="M152 37h24c3 0 5 1.2 6.6 3.8l7.4 12.2h-38z" fill="#ecfeff" />
      <path d="M154 39h10l-6 12h-4z" fill="#fff" opacity=".7" />
      <rect x="143" y="62" width="61" height="12" rx="2" fill="#0f766e" />
      <rect x="198" y="57" width="7" height="5" rx="1.5" fill="#fde68a" />
      <rect x="137" y="70" width="70" height="5" rx="2.5" fill="#334155" />
      {[30, 54, 112, 166, 190].map(wheel)}
    </svg>
  )
}

export function Pallet({ rows = 3, tone = 'ok', className = 'w-12' }) {
  const box = tone === 'over' ? ['#fecaca', '#f87171'] : tone === 'warn' ? ['#fde68a', '#f59e0b'] : ['#e9c48f', '#c8955a']
  const r = Math.max(1, Math.min(4, rows))
  return (
    <svg viewBox="0 0 60 64" className={className} aria-hidden>
      {Array.from({ length: r }).flatMap((_, row) => [0, 1, 2].map((col) => {
        const x = 4 + col * 17.5
        const y = 46 - (row + 1) * 11
        return (
          <g key={`${row}-${col}`}>
            <rect x={x} y={y} width="16.5" height="10.5" rx="1.2" fill={box[0]} stroke={box[1]} strokeWidth=".8" />
            <path d={`M${x + 8.25} ${y}v10.5`} stroke={box[1]} strokeWidth=".8" opacity=".7" />
          </g>
        )
      }))}
      <rect x="2" y="47" width="56" height="3.5" rx="1" fill="#b45309" />
      <rect x="4" y="50.5" width="6" height="4" fill="#92400e" />
      <rect x="27" y="50.5" width="6" height="4" fill="#92400e" />
      <rect x="50" y="50.5" width="6" height="4" fill="#92400e" />
      <rect x="2" y="54.5" width="56" height="3" rx="1" fill="#b45309" />
    </svg>
  )
}

export function Scene({ className = 'w-full' }) {
  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      <svg viewBox="0 0 420 150" className="w-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0fdfa" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="420" height="150" fill="url(#sky)" />
        <circle cx="352" cy="34" r="16" fill="#fde68a" opacity=".7" />
        <path d="M30 40c8-10 24-10 30 0 10-2 16 6 12 12H24c-6-4-2-12 6-12z" fill="#fff" />
        <path d="M250 26c6-8 18-8 23 0 8-2 13 5 9 10h-36c-5-3-2-10 4-10z" fill="#fff" />
        {/* warehouse */}
        <path d="M300 118V74l46-22 46 22v44z" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" />
        <rect x="320" y="88" width="52" height="30" rx="2" fill="#f1f5f9" stroke="#e2e8f0" />
        {[94, 101, 108].map((y) => <path key={y} d={`M320 ${y}h52`} stroke="#e2e8f0" />)}
        <rect x="336" y="64" width="20" height="8" rx="2" fill="#ccfbf1" />
        {/* road */}
        <rect x="0" y="118" width="420" height="10" fill="#e2e8f0" />
        <path d="M0 123h420" stroke="#fff" strokeWidth="1.5" strokeDasharray="10 10" className="road-dash" />
      </svg>
      <div className="absolute bottom-[14%] left-[6%] w-[46%] truck-bob"><Truck className="w-full" moving /></div>
      <div className="absolute bottom-[14%] left-[58%] flex w-[16%] gap-0.5">
        <Pallet rows={2} className="w-1/2" /><Pallet rows={3} className="w-1/2" />
      </div>
    </div>
  )
}

// ---------- rule icons ----------

const ICONS = {
  'R-01': <><path d="M3 4v12M6 4v12M8.5 4v12M11 4v12M14 4v12M17 4v12" strokeWidth="1.4" /></>,
  'R-02': <><circle cx="10" cy="10" r="7" /><path d="M12.5 7.2a2.6 2.6 0 0 0-4.6 1.6V13M6.8 10.5h4.4M6.8 13h6" /></>,
  'R-03': <><rect x="3" y="5" width="14" height="11" rx="1.5" /><path d="M3 9h14M10 5v11" /></>,
  'R-04': <><rect x="3" y="10" width="6" height="6" rx="1" /><rect x="11" y="10" width="6" height="6" rx="1" /><rect x="7" y="3.5" width="6" height="6" rx="1" /></>,
  'R-05': <><path d="M6.5 7h7l2.5 9.5h-12z" /><path d="M8 7a2 2 0 1 1 4 0" /></>,
  'R-06': <><path d="M10 17c3.3 0 5.5-2.3 5.5-5.3 0-3.6-3.3-5.2-4-8.7-2.2 1.5-3 3.6-2.6 5.6-1.2-.4-2-1.4-2.2-2.6C5.3 7.5 4.5 9.5 4.5 11.7 4.5 14.7 6.7 17 10 17z" /></>,
  'R-07': <><path d="M10 3v14M5 17h10M3.5 6.5h13" /><path d="M3.5 6.5L1.8 11a2.2 2.2 0 0 0 3.4 0zM16.5 6.5L14.8 11a2.2 2.2 0 0 0 3.4 0z" /></>,
  'R-08': <><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8.5h14M7 3v3M13 3v3M7.5 12.5l1.8 1.8 3.4-3.6" /></>,
  'R-09': <><path d="M5 17V3.5M5 4h9.5l-2 3.2 2 3.3H5" /></>,
  'R-10': <><circle cx="10" cy="10" r="7" /><path d="M10 6v4.2l2.8 1.8" /></>,
}

export function RuleIcon({ id, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[id]}
    </svg>
  )
}

// ---------- small animated progress ring ----------

export function ProgressRing({ value, size = 44, stroke = 4, tone = '#14b8a6', label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <span className="absolute font-mono text-[10px] font-semibold text-slate-700">{label ?? `${Math.round(value * 100)}%`}</span>
    </div>
  )
}
