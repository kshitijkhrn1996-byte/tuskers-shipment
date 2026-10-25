import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

const EXAMPLES = [
  'Northfield Goods here — 1080 ceramic mugs from Manchester to our Frankfurt warehouse, 3 pallets, 620 kg.',
  'I need to ship 200 table lamps from Leeds to a shop in Amsterdam next week, balanced please.',
]

export default function Chat({ state, setState }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef(null)

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [state.messages, busy])

  const send = async (text) => {
    const msg = text.trim()
    if (!msg || busy) return
    setInput('')
    setBusy(true)
    setState((s) => ({ ...s, messages: [...s.messages, { role: 'user', content: msg }] }))
    try {
      const r = await api.chat(state.id, msg)
      setState((s) => ({
        ...s, id: r.conversation_id, draft: r.draft, missing: r.missing,
        report: r.report ?? s.report, confirmed: r.confirmed ? { reference: r.confirmed.reference } : s.confirmed,
        messages: [...s.messages, { role: 'assistant', content: r.reply }],
      }))
    } catch (e) {
      setState((s) => ({ ...s, messages: [...s.messages, { role: 'assistant', content: `⚠️ ${e.message}`, error: true }] }))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => setState((s) => ({ id: null, messages: [s.messages[0]], draft: null, report: null, confirmed: null, missing: [] }))

  return (
    <div className="card flex flex-col h-[calc(100vh-10rem)] min-h-[480px]">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <span className="text-sm font-semibold">Booking assistant</span>
        <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-800">New booking</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {state.messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-brand text-white rounded-br-sm'
                : m.error ? 'bg-red-50 text-red-800 rounded-bl-sm' : 'bg-slate-100 rounded-bl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-slate-400 pl-1">Checking…</div>}
        {state.messages.length === 1 && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-slate-500">Try an example:</p>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => send(ex)} className="block text-left text-sm w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 hover:bg-slate-50">{ex}</button>
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="p-3 border-t border-slate-100 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder="e.g. add a pallet, or change the city to Lyon"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <button className="btn-primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  )
}
