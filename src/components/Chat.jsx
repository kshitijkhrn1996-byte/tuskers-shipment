import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { api } from '../api.js'
import { TuskerMark } from './Logo.jsx'
import { IssueCard } from './ValidationPanel.jsx'
import { Rich, ease } from './ui.jsx'
import { ProgressRing } from './art.jsx'

const EXAMPLES = [
  'Northfield Goods here — 1080 ceramic mugs from Manchester to our Frankfurt warehouse, 3 pallets, 620 kg.',
  'Gadget Lane: 300 lithium power banks, HS 8507, from London to a shop in Lyon next week.',
  'What does an HS code mean?',
]

let seq = 0
export const newMessage = (role, content, extra = {}) => ({ id: `${Date.now().toString(36)}-${seq++}`, role, content, ...extra })

export default function Chat({ sessionId, messages, setMessages, onTurn, progress = 0 }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef(null)
  const box = useRef(null)

  const toBottom = (smooth = true) => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => { toBottom() }, [messages.length, busy])

  const send = async (text) => {
    const msg = text.trim()
    if (!msg || busy) return
    setInput('')
    if (box.current) box.current.style.height = 'auto'
    setBusy(true)
    setMessages((m) => [...m, newMessage('user', msg)])
    try {
      const r = await api.chat(sessionId, msg)
      onTurn(r, r.confirmed ? { confirmed: { reference: r.confirmed.reference } } : {})
      setMessages((m) => [...m, newMessage('assistant', r.reply, { issues: r.new_issues, errors: r.input_errors, fresh: true })])
    } catch (e) {
      setMessages((m) => [...m, newMessage('assistant', `Sorry — ${e.message}. Please try again.`, { error: true, fresh: true })])
    } finally {
      setBusy(false)
    }
  }

  const settle = (id) => {
    setMessages((ms) => ms.map((x) => (x.id === id ? { ...x, fresh: false } : x)))
    // flag cards slide in after the text finishes; keep them in view
    setTimeout(() => toBottom(), 60)
    setTimeout(() => toBottom(), 650)
  }

  return (
    <div className="glass relative flex h-[calc(100vh-10.5rem)] min-h-[560px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-200/70 px-5 py-3.5">
        <span className="relative">
          <TuskerMark className="h-9 w-9" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Booking assistant</p>
          <p className="text-xs text-slate-500">Asks only for what’s missing · flags problems as you go</p>
        </div>
        <div className="flex items-center gap-2" title="How complete the booking is">
          <span className="hidden text-[11px] text-slate-500 sm:inline">Booking</span>
          <ProgressRing value={progress} size={40} tone={progress >= 1 ? '#10b981' : '#14b8a6'} />
        </div>
      </div>

      <div ref={scroller} className="thin-scroll flex-1 space-y-5 overflow-y-auto px-5 pb-32 pt-5">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <Message key={m.id} m={m} onSettled={() => settle(m.id)} onProgress={() => toBottom(false)} />
          ))}
        </AnimatePresence>
        <AnimatePresence>{busy && <Thinking key="thinking" />}</AnimatePresence>
        {messages.length === 1 && !busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }} className="space-y-2 pl-11">
            <p className="label">Try</p>
            {EXAMPLES.map((ex, i) => (
              <motion.button key={ex} onClick={() => send(ex)}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.35 + i * 0.07, duration: 0.35, ease } }}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                className="block w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-left text-sm text-slate-700 transition-shadow duration-200 hover:shadow-lift">
                {ex}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 via-white/60 to-transparent px-4 pb-4 pt-10">
        <div className="pointer-events-auto flex items-end gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2 pl-4 shadow-float backdrop-blur-xl
          transition-all duration-300 ease-smooth focus-within:-translate-y-0.5 focus-within:border-teal-400/70 focus-within:shadow-[0_0_0_4px_rgba(20,184,166,0.10),0_22px_44px_-18px_rgba(15,23,42,0.35)]">
          <textarea ref={box} rows={1} value={input} disabled={busy}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Describe the shipment, answer a question, or change a detail…"
            className="max-h-36 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-ink placeholder:text-slate-400 focus:outline-none" />
          <motion.button type="submit" disabled={busy || !input.trim()} whileTap={{ scale: 0.92 }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-teal-600 to-teal-700 text-white shadow-[0_6px_16px_-6px_rgba(13,148,136,0.7)]
              transition-all duration-200 hover:-translate-y-px hover:shadow-[0_10px_22px_-8px_rgba(13,148,136,0.8)] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            aria-label="Send">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 16V4M5 9l5-5 5 5" /></svg>
          </motion.button>
        </div>
      </form>
    </div>
  )
}

function Message({ m, onSettled, onProgress }) {
  const reduce = useReducedMotion()
  const text = m.content.split('\n').filter((l) => !l.startsWith('✗ ')).join('\n')
  const [shown, setShown] = useState(m.fresh && !reduce ? 0 : text.length)
  const done = shown >= text.length

  useEffect(() => {
    if (done) return
    const total = Math.min(1400, Math.max(350, text.length * 9))
    const start = performance.now()
    let raf
    const tick = (now) => {
      const n = Math.ceil(text.length * Math.min(1, (now - start) / total))
      setShown(n)
      onProgress()
      if (n < text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (done && m.fresh) onSettled() }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  if (m.role === 'user') {
    return (
      <motion.div layout initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease }}
        className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lift">
          {m.content}
        </div>
      </motion.div>
    )
  }

  const flags = [
    ...(m.errors || []).map((e, j) => ({ key: `e${j}`, rule_id: null, severity: 'Red', message: e.message, fix: null })),
    ...(m.issues || []),
  ]
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="flex gap-3">
      <TuskerMark className="mt-0.5 h-8 w-8 shrink-0" />
      <div className="min-w-0 max-w-[88%] space-y-2">
        <div className={`whitespace-pre-wrap rounded-2xl rounded-tl-md border px-4 py-2.5 text-sm leading-relaxed shadow-[0_1px_2px_rgba(15,23,42,0.04)]
          ${m.error ? 'border-red-200 bg-red-50/80 text-red-800' : 'border-slate-200/80 bg-white/85 text-slate-800'}`}>
          {text.slice(0, shown).split('\n').map((line, i) => (
            <span key={i} className={`block ${line.startsWith('✓') ? 'font-medium text-emerald-700' : ''} ${i === 0 && line.startsWith('Got it') ? 'text-slate-900' : ''}`}>
              <Rich text={line} />
            </span>
          ))}
          {!done && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-teal-500" />}
        </div>
        {done && flags.length > 0 && (
          <ul className="space-y-2">
            <AnimatePresence>{flags.map((f, i) => <IssueCard key={f.key} issue={f} index={i} compact />)}</AnimatePresence>
          </ul>
        )}
      </div>
    </motion.div>
  )
}

function Thinking() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease }} className="flex items-center gap-3">
      <TuskerMark className="h-8 w-8 shrink-0" />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white/85 px-4 py-3">
        {[0, 1, 2].map((d) => (
          <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-teal-500"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15, ease: 'easeInOut' }} />
        ))}
        <span className="shimmer ml-2 text-xs font-medium">Reading and checking…</span>
      </div>
    </motion.div>
  )
}
