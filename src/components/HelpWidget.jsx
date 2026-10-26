import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../api.js'
import { Rich, ease } from './ui.jsx'
import { HsFinderPanel } from './HsFinder.jsx'
import { RuleIcon } from './art.jsx'

const SUGGESTIONS = ['What is an HS code?', 'What is a commercial invoice?', 'Why does my pallet weight matter?', 'What does red vs amber mean?']

// Floating dock: HS code finder + shipping help. One panel open at a time.
export default function HelpWidget({ context }) {
  const [panel, setPanel] = useState(null)
  const open = panel === 'help'
  const setOpen = (fn) => setPanel((p) => ((typeof fn === 'function' ? fn(p === 'help') : fn) ? 'help' : null))
  const [items, setItems] = useState([])
  const [request, setRequest] = useState(null)

  useEffect(() => {
    const onItems = (e) => setItems(e.detail || [])
    const onOpen = (e) => { setRequest({ ...(e.detail || {}), nonce: Date.now() }); setPanel('hs') }
    window.addEventListener('tuskers:items', onItems)
    window.addEventListener('tuskers:open-hs', onOpen)
    return () => { window.removeEventListener('tuskers:items', onItems); window.removeEventListener('tuskers:open-hs', onOpen) }
  }, [])
  const [qa, setQa] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const ask = async (question) => {
    if (!question.trim() || busy) return
    setQ('')
    setBusy(true)
    setQa((x) => [...x, { q: question }])
    try {
      const r = await api.help(question, context)
      setQa((x) => x.map((e, i) => (i === x.length - 1 ? { ...e, a: r.answer } : e)))
    } catch (e) {
      setQa((x) => x.map((it, i) => (i === x.length - 1 ? { ...it, a: `Sorry, help is unavailable right now (${e.message}).` } : it)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end print:hidden">
      <AnimatePresence mode="popLayout">
        {panel === 'hs' && <HsFinderPanel key="hs" onClose={() => setPanel(null)} items={items} request={request} />}
        {open && (
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.28, ease }} style={{ transformOrigin: 'bottom right' }}
            className="glass mb-3 flex max-h-[70vh] w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col shadow-float">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Shipping help</p>
                <p className="text-xs text-slate-500">Plain-English answers to logistics terms</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close help"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">×</button>
            </div>
            <div className="thin-scroll flex-1 space-y-3 overflow-y-auto p-3 text-sm">
              {qa.length === 0 && SUGGESTIONS.map((s, i) => (
                <motion.button key={s} onClick={() => ask(s)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.05 * i } }}
                  whileHover={{ x: 2 }}
                  className="block w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-left transition-shadow duration-200 hover:shadow-lift">{s}</motion.button>
              ))}
              {qa.map((e, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="space-y-1">
                  <p className="font-semibold">{e.q}</p>
                  {e.a ? <p className="whitespace-pre-wrap leading-relaxed text-slate-700"><Rich text={e.a} /></p>
                    : <p className="flex gap-1 py-1">{[0, 1, 2].map((d) => <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-teal-500"
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />)}</p>}
                </motion.div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(q) }} className="flex gap-2 border-t border-slate-200/70 p-2.5">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a term…" className="field field-ok mt-0 py-1.5" />
              <button className="btn-primary px-3 py-1.5" disabled={busy || !q.trim()}>Ask</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        <motion.button onClick={() => setPanel((p) => (p === 'hs' ? null : 'hs'))} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-float transition-shadow hover:shadow-[0_18px_40px_-14px_rgba(15,23,42,0.45)]
            ${panel === 'hs' ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white text-ink'}`}>
          <RuleIcon id="R-01" className="h-4 w-4" />
          {panel === 'hs' ? 'Close finder' : 'Find HS code'}
        </motion.button>
        <motion.button onClick={() => setOpen((o) => !o)} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-float transition-shadow hover:shadow-[0_18px_40px_-14px_rgba(15,23,42,0.6)]">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-slate-900">?</span>
          {open ? 'Close help' : 'Help'}
        </motion.button>
      </div>
    </div>
  )
}
