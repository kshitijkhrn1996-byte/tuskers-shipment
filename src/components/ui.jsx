import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export const ease = [0.22, 1, 0.36, 1]
export const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease } },
}

// Vertical three-lamp light. state: 'red' | 'amber' | 'green' | 'idle'
export function TrafficLight({ state = 'idle', className = '' }) {
  const lamps = [
    ['red', 'bg-red-500 shadow-glow-red'],
    ['amber', 'bg-amber-400 shadow-glow-amber'],
    ['green', 'bg-emerald-500 shadow-glow-green'],
  ]
  return (
    <div className={`flex flex-col gap-1.5 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 p-1.5 shadow-[0_8px_20px_-8px_rgba(15,23,42,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}
      role="img" aria-label={`Status: ${state}`}>
      {lamps.map(([key, on]) => (
        <motion.span key={key} className={`block h-3.5 w-3.5 rounded-full ${state === key ? `${on} lamp-on` : 'bg-slate-700/70'}`}
          animate={{ scale: state === key ? [1, 1.12, 1] : 1, opacity: state === key ? 1 : 0.55 }}
          transition={{ duration: 0.5, ease }} />
      ))}
    </div>
  )
}

// Small status glyph for a rule row.
export function StatusIcon({ status }) {
  const common = 'grid h-5 w-5 shrink-0 place-items-center rounded-full mt-px'
  if (status === 'pass') {
    return (
      <span className={`${common} bg-emerald-500/10 text-emerald-600`}>
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M3.5 8.5l3 3 6-7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease }} />
        </svg>
      </span>
    )
  }
  if (status === 'red') {
    return (
      <span className={`${common} bg-red-500 text-white shadow-[0_0_0_3px_rgba(239,68,68,0.15)]`}>
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </span>
    )
  }
  if (status === 'amber') {
    return <span className={`${common} bg-amber-400 text-amber-950 text-[11px] font-black shadow-[0_0_0_3px_rgba(245,158,11,0.15)]`}>!</span>
  }
  if (status === 'pending') {
    return <span className={`${common} border border-dashed border-sky-400 bg-sky-50`} />
  }
  return <span className={`${common} border border-slate-200 bg-white`}><span className="h-1 w-1 rounded-full bg-slate-300" /></span>
}

export function Tooltip({ content, children, side = 'top', className = '' }) {
  const [open, setOpen] = useState(false)
  if (!content) return children
  const pos = side === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2'
  return (
    <span className={`relative inline-flex ${className}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.span role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.98 }} transition={{ duration: 0.16, ease }}
            className={`pointer-events-none absolute z-50 w-max max-w-[18rem] rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-xs leading-snug text-white shadow-float ${pos}`}>
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export function Collapse({ open, children }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease }} className="overflow-hidden">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Logistics data (IDs, HS codes, money, weights, dates) rendered in mono inside running text.
const DATA_RE = /(“[^”]*\d[^”]*”|\b(?:BK|CHAT|FORM|TS|INV|ITEM)-[A-Z0-9-]+\b|£[\d,]+(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?kg\b|\b\d{2}-\d{2}-\d{4}\b|\b\d{4,}\b)/g

export function Rich({ text }) {
  if (!text) return null
  return text.split(DATA_RE).map((part, i) => (i % 2
    ? <span key={i} className="font-mono text-[0.93em] tracking-tight">{part}</span>
    : part))
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// Stripe-style arrow: a chevron whose stem draws in on hover (put `group` on the button).
export function Arrow({ className = '' }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 overflow-visible ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 6h8" className="origin-left scale-x-0 opacity-0 transition-all duration-200 ease-smooth group-hover:scale-x-100 group-hover:opacity-100" />
      <path d="M5.5 2.5L9 6l-3.5 3.5" className="transition-transform duration-200 ease-smooth group-hover:translate-x-0.5" />
    </svg>
  )
}
