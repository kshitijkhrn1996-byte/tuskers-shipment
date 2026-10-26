import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, hsBus } from '../api.js'
import { RuleIcon } from './art.jsx'
import { Spinner, ease } from './ui.jsx'

const EXAMPLES = ['ceramic coffee mug', 'cotton t-shirt', 'steel claw hammer', '8507']

// Floating HS code finder: description or code in, verified codes from the HS database out.
export function HsFinderPanel({ onClose, items, request }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)
  const [notices, setNotices] = useState([])
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null)
  const [applied, setApplied] = useState('')
  const input = useRef(null)

  const search = async (text) => {
    const query = (text ?? q).trim()
    if (!query) return
    setQ(query); setBusy(true); setError(''); setApplied('')
    try { const r = await api.hsSearch(query); setResults(r.results); setNotices(r.notices || []) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  // opened from a flag: pre-fill with that product's description and target it
  useEffect(() => {
    input.current?.focus()
    if (!request) return
    if (request.item != null) setTarget(request.item)
    if (request.query) search(request.query)
  }, [request?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const use = (code, index) => {
    hsBus.apply({ index, code })
    setApplied(`${code} → ${items.find((i) => i.index === index)?.description || `product ${index + 1}`}`)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.28, ease }} style={{ transformOrigin: 'bottom right' }}
      className="glass mb-3 flex max-h-[72vh] w-[26rem] max-w-[calc(100vw-2.5rem)] flex-col shadow-float">
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700"><RuleIcon id="R-01" className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-semibold">HS code finder</p>
            <p className="text-xs text-slate-500">UK/EU commodity codes (8-digit) and the HS nomenclature</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close finder" className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">×</button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); search() }} className="flex gap-2 border-b border-slate-200/70 p-3">
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Describe the product, or type a code"
          className="field field-ok mt-0 py-1.5" />
        <button className="btn-primary px-3 py-1.5" disabled={busy || !q.trim()}>{busy ? <Spinner /> : 'Find'}</button>
      </form>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {!results && !busy && (
          <div className="space-y-1.5">
            <p className="label">Try</p>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => search(ex)} className="block w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-left transition-shadow hover:shadow-lift">{ex}</button>
            ))}
          </div>
        )}
        {busy && <p className="flex items-center gap-2 text-slate-500"><Spinner /> <span className="shimmer font-medium">Searching the HS nomenclature…</span></p>}
        {error && <p className="text-red-600">{error}</p>}
        {!busy && notices.map((n, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border px-3 py-2 text-xs ${n.kind === 'restricted' || n.kind === 'invalid' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <span className="font-semibold">{{ vague: 'Too vague', restricted: 'Restricted', ambiguous: 'Which one?', invalid: 'Not a valid code', none: 'No confident match' }[n.kind] || 'Note'} · </span>{n.message}
          </motion.div>
        ))}
        {results && !busy && results.length === 0 && !notices.length && <p className="text-slate-500">No matching codes. Try simpler words (material + what it is).</p>}
        <AnimatePresence>
          {results && !busy && results.map((r, i) => (
            <motion.div key={r.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3, ease } }}
              className={`rounded-xl border bg-white/85 p-3 ${i === 0 ? 'border-teal-300 shadow-[0_0_0_3px_rgba(20,184,166,0.08)]' : 'border-slate-200/80'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-base font-semibold">{r.code}</p>
                <span className="flex gap-1">
                  {i === 0 && <span className="chip bg-teal-600 text-white">Best match</span>}
                  {r.source && <span className="chip bg-slate-100 text-slate-500">{r.source}</span>}
                </span>
              </div>
              {r.product && <p className="mt-1 font-medium">{r.product}</p>}
              <p className={`leading-snug text-slate-800 ${r.product ? 'text-xs text-slate-600' : 'mt-1'}`}>{r.subheading}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">{r.chapter} › {r.heading}</p>
              {r.why && <p className="mt-1.5 text-xs text-slate-600">{r.why}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {items.length > 0 ? items.map((it) => (
                  <button key={it.index} onClick={() => use(r.code, it.index)}
                    className={`btn px-2.5 py-1 text-xs ${target === it.index ? 'btn-primary' : 'btn-ghost'}`}>
                    Use for {it.description ? it.description.slice(0, 22) : `product ${it.index + 1}`}
                  </button>
                )) : (
                  <button onClick={() => navigator.clipboard?.writeText(r.code)} className="btn-ghost px-2.5 py-1 text-xs">Copy code</button>
                )}
                <a href={`https://www.trade-tariff.service.gov.uk/search?q=${r.code}`} target="_blank" rel="noreferrer"
                  className="text-xs font-medium text-teal-700 hover:text-teal-900">Check on UK Trade Tariff ↗</a>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {applied && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✓ Applied <span className="font-mono">{applied}</span>. The checks re-run straight away.
          </motion.p>
        )}
      </div>
      <p className="border-t border-slate-200/70 px-4 py-2 text-[10px] leading-snug text-slate-400">
        Every code shown exists in the UK/EU tariff. Answer the deciding question, then confirm the 10-digit code on the Trade Tariff before you ship.
      </p>
    </motion.div>
  )
}
