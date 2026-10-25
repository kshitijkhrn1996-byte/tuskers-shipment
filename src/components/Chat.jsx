import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { TuskerMark } from './Logo.jsx'

const EXAMPLES = [
  'Northfield Goods here — 1080 ceramic mugs from Manchester to our Frankfurt warehouse, 3 pallets, 620 kg.',
  'Gadget Lane: 300 lithium power banks, HS 8507, from London to a shop in Lyon next week.',
]

export default function Chat({ sessionId, messages, setMessages, onTurn }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef(null)

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, busy])

  const send = async (text) => {
    const msg = text.trim()
    if (!msg || busy) return
    setInput('')
    setBusy(true)
    setMessages((m) => [...m, { role: 'user', content: msg }])
    try {
      const r = await api.chat(sessionId, msg)
      onTurn(r, r.confirmed ? { confirmed: { reference: r.confirmed.reference } } : {})
      setMessages((m) => [...m, { role: 'assistant', content: r.reply, issues: r.new_issues, errors: r.input_errors }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${e.message}`, error: true }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex flex-col h-[calc(100vh-11rem)] min-h-[520px]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <TuskerMark className="w-7 h-7" />
        <div>
          <p className="text-sm font-semibold leading-tight">Booking assistant</p>
          <p className="text-[11px] text-slate-500 leading-tight">Checks every detail as you go</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[88%] space-y-2">
              <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-brand text-white rounded-br-sm'
                  : m.error ? 'bg-red-50 text-red-800 rounded-bl-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                {m.content.split('\n').filter((l) => !l.startsWith('✗ ')).join('\n')}
              </div>
              {(m.errors || []).map((e, j) => (
                <Flag key={`e${j}`} sev="Red" title="Not accepted" text={e.message} />
              ))}
              {(m.issues || []).map((iss) => (
                <Flag key={iss.key} sev={iss.severity} title={iss.rule_id ? `${iss.rule_id} · ${iss.severity === 'Red' ? 'blocks shipping' : 'warning'}` : iss.severity === 'Red' ? 'Problem' : 'Check this'}
                  text={iss.message} fix={iss.fix} />
              ))}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-1 pl-2">
            {[0, 1, 2].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}
          </div>
        )}
        {messages.length === 1 && (
          <div className="pt-1 space-y-2">
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
          placeholder="Describe the shipment, answer a question, or change a detail…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
        <button className="btn-primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  )
}

function Flag({ sev, title, text, fix }) {
  const cls = sev === 'Red' ? 'border-red-500 bg-red-50 text-red-900' : 'border-amber-400 bg-amber-50 text-amber-950'
  return (
    <div className={`rounded-lg border-l-4 px-3 py-2 text-sm ${cls}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{sev === 'Red' ? '✗' : '!'} {title}</p>
      <p>{text}</p>
      {fix && <p className="opacity-80"><b>Fix:</b> {fix}</p>}
    </div>
  )
}
