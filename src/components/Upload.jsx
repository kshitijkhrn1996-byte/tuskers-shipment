import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../api.js'
import { Spinner, ease } from './ui.jsx'

export default function Upload({ state, setState }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const input = useRef(null)

  const handle = async (fileList) => {
    const files = [...(fileList || [])]
    if (!files.length) return
    setBusy(true)
    setError('')
    try {
      const result = await api.upload(files)
      setState({ result: { ...result, filename: files.map((f) => f.name).join(', ') }, selected: 0, confirmed: {} })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const { result } = state
  const blocked = result ? result.reports.filter((r) => r.blocked).length : 0
  return (
    <div className="space-y-4">
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files) }}
        onClick={() => input.current?.click()}
        animate={{ scale: drag ? 1.01 : 1 }} transition={{ duration: 0.2, ease }}
        className={`glass group relative cursor-pointer overflow-hidden px-6 py-10 text-center transition-all duration-300 ease-smooth hover:shadow-lift
          ${drag ? 'border-teal-400 bg-teal-50/60 ring-4 ring-teal-500/10' : ''}`}>
        <input ref={input} type="file" accept=".xlsx,.csv" multiple hidden onChange={(e) => handle(e.target.files)} />
        <motion.div animate={{ y: drag ? -4 : 0 }} className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-white to-slate-50 text-teal-600 shadow-lift">
          {busy ? <Spinner className="h-5 w-5" /> : (
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13V3 M6 7l4-4 4 4 M3.5 13v3.5h13V13" /></svg>
          )}
        </motion.div>
        <p className="mt-3 font-semibold">{busy ? 'Checking every booking…' : drag ? 'Drop to check' : 'Drop the booking sheet here, or click to choose'}</p>
        <p className="mt-1 text-sm text-slate-500">One .xlsx with Bookings + Items sheets, or separate files (.xlsx or .csv)</p>
        <a href="/sample-shipments.xlsx" download onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 transition-colors hover:text-teal-900">
          Download a sample with planted mistakes <span aria-hidden>→</span>
        </a>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">{error}</motion.div>
        )}
      </AnimatePresence>

      {result && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="glass overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3">
            <span className="truncate font-mono text-xs text-slate-500">{result.filename}</span>
            <span className="shrink-0 text-xs text-slate-500">
              <span className="font-mono text-ink">{result.reports.length}</span> bookings · <span className="font-mono text-red-600">{blocked}</span> on hold
            </span>
          </div>
          <ul className="p-2">
            {result.reports.map((r, i) => {
              const tone = r.red_count ? 'bg-red-500 shadow-glow-red' : r.amber_count ? 'bg-amber-400 shadow-glow-amber' : 'bg-emerald-500 shadow-glow-green'
              const active = state.selected === i
              return (
                <motion.li key={r.reference} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05, duration: 0.3, ease } }}>
                  <button onClick={() => setState((s) => ({ ...s, selected: i }))}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-200 ${active ? '' : 'hover:bg-white/70'}`}>
                    {active && <motion.span layoutId="upload-active" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl border border-slate-200/80 bg-white shadow-lift" />}
                    <span className={`relative h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />
                    <span className="relative w-16 font-mono text-xs font-semibold">{r.booking.booking_id}</span>
                    <span className="relative min-w-0 flex-1 truncate text-slate-600">{r.booking.seller_name} · {r.booking.origin_city} → {r.booking.destination_city}</span>
                    {r.red_count > 0 && <span className="chip relative bg-red-50 text-red-700"><span className="font-mono">{r.red_count}</span> red</span>}
                    {r.amber_count > 0 && <span className="chip relative bg-amber-50 text-amber-800"><span className="font-mono">{r.amber_count}</span> amber</span>}
                    {!r.red_count && !r.amber_count && <span className="chip relative bg-emerald-50 text-emerald-700">clear</span>}
                    {state.confirmed[r.reference] && <span className="chip relative bg-teal-600 text-white">booked</span>}
                  </button>
                </motion.li>
              )
            })}
          </ul>
          {result.row_errors.length > 0 && (
            <div className="border-t border-red-100 bg-red-50/60 px-5 py-3 text-sm">
              <p className="font-semibold text-red-800">Rows we couldn’t check</p>
              {result.row_errors.map((e) => (
                <p key={e.booking_id} className="mt-1 text-red-700"><span className="font-mono font-semibold">{e.booking_id}</span> · {e.errors.join('; ')}</p>
              ))}
            </div>
          )}
        </motion.section>
      )}
    </div>
  )
}
