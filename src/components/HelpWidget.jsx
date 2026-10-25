import { useState } from 'react'
import { api } from '../api.js'

const SUGGESTIONS = ['What is an HS code?', 'What is a commercial invoice?', 'Why does my pallet weight matter?', 'What does red vs amber mean?']

export default function HelpWidget({ context }) {
  const [open, setOpen] = useState(false)
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
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="card w-[22rem] max-w-[calc(100vw-2rem)] mb-3 flex flex-col max-h-[70vh]">
          <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold">Shipping help</p>
              <p className="text-xs text-slate-500">Plain-English answers to logistics terms</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none" aria-label="Close help">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {qa.length === 0 && (
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="block w-full text-left rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">{s}</button>
                ))}
              </div>
            )}
            {qa.map((e, i) => (
              <div key={i} className="space-y-1">
                <p className="font-semibold">{e.q}</p>
                <p className="text-slate-700 whitespace-pre-wrap">{e.a ?? 'Thinking…'}</p>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q) }} className="p-2 border-t border-slate-100 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a term…"
              className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
            <button className="btn-primary px-3 py-1.5" disabled={busy || !q.trim()}>Ask</button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)}
        className="ml-auto flex items-center gap-2 rounded-full bg-ink text-white px-4 py-2.5 shadow-lg text-sm font-semibold hover:bg-slate-800">
        <span className="w-5 h-5 rounded-full bg-white text-ink grid place-items-center text-xs font-bold">?</span>
        {open ? 'Close help' : 'Help'}
      </button>
    </div>
  )
}
