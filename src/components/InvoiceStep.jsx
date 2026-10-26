import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ProgressRing } from './art.jsx'
import { ease } from './ui.jsx'

const INCOTERMS = [['DAP', 'DAP · delivered, buyer pays import duty'], ['DDP', 'DDP · delivered, duty paid by you'], ['FCA', 'FCA · buyer collects from your carrier'],
  ['EXW', 'EXW · buyer collects from your premises'], ['CPT', 'CPT'], ['CIP', 'CIP'], ['DPU', 'DPU']]
const FIELDS = [
  ['seller_address', 'Your business address', 'e.g. 22 Brick Lane, London E1 6RF', true],
  ['seller_eori', 'Your EORI number', 'e.g. GB123456789000', false],
  ['buyer_name', 'Buyer name', 'e.g. Maison Lumière SARL', true],
  ['buyer_address', 'Buyer address', 'e.g. 8 Rue Oberkampf, 75011 Paris', true],
  ['payment_terms', 'Payment terms', 'e.g. 30 days, bank transfer', true],
  ['related_docs', 'PO / contract number', 'e.g. PO-7781', false],
]
const REQUIRED = ['seller_address', 'buyer_name', 'buyer_address', 'incoterms', 'payment_terms']

// Step 5: the invoice-only details, collected once the booking itself is complete.
export default function InvoiceStep({ session, onSave, onOpen }) {
  const [inv, setInv] = useState(() => ({ ...(session.draft.invoice || {}) }))
  const editing = useRef(0)
  const timer = useRef(null)

  useEffect(() => {
    if (Date.now() - editing.current > 1500) setInv({ ...(session.draft.invoice || {}) })
  }, [session.draft.invoice])

  const set = (k, v) => {
    editing.current = Date.now()
    const next = { ...inv, [k]: v }
    setInv(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave({ ...session.draft, invoice: next }), 600)
  }

  const done = REQUIRED.filter((k) => inv[k]).length
  const eoriIssue = (session.issues || []).find((i) => i.field === 'invoice.seller_eori')
  const field = (k, label, ph, req) => (
    <label key={k} className="block">
      <span className="text-xs font-medium text-slate-500">{label}{req && <span className="text-red-500"> *</span>}</span>
      <input value={inv[k] || ''} placeholder={ph} onChange={(e) => set(k, e.target.value)}
        className={`field ${k === 'seller_eori' && eoriIssue ? 'field-amber' : 'field-ok'} ${k === 'seller_eori' || k === 'related_docs' ? 'font-mono' : ''}`} />
      {k === 'seller_eori' && eoriIssue && <span className="mt-1 block text-xs text-amber-700">! {eoriIssue.message}</span>}
    </label>
  )

  return (
    <motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Commercial invoice</p>
          <p className="mt-0.5 text-sm text-slate-500">Everything else is filled in from the booking — products, HS codes, origin, weights, carrier and route.</p>
        </div>
        <ProgressRing value={done / REQUIRED.length} size={44} label={`${done}/${REQUIRED.length}`} tone={done === REQUIRED.length ? '#10b981' : '#14b8a6'} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.slice(0, 4).map(([k, l, ph, req]) => field(k, l, ph, req))}
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Incoterms<span className="text-red-500"> *</span></span>
          <select value={inv.incoterms || ''} onChange={(e) => set('incoterms', e.target.value)} className="field field-ok">
            <option value="">Choose</option>
            {INCOTERMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {FIELDS.slice(4).map(([k, l, ph, req]) => field(k, l, ph, req))}
      </div>
      <button className={`mt-5 w-full py-2.5 ${done === REQUIRED.length ? 'btn-primary' : 'btn-ghost'}`} onClick={onOpen}>
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M5 2.5h7l3 3v12H5z M12 2.5v3h3 M7.5 9h5 M7.5 12h5 M7.5 15h3" /></svg>
        {done === REQUIRED.length ? 'Generate commercial invoice' : `Preview draft invoice · ${REQUIRED.length - done} detail${REQUIRED.length - done === 1 ? '' : 's'} missing`}
      </button>
    </motion.section>
  )
}

const STEPS = ['Details', 'Pre-flight checks', 'Carrier', 'Confirm', 'Invoice']

export function Stepper({ session }) {
  const { missing, issues, report, confirmed, invoiceMissing } = session
  const reds = issues.some((i) => i.severity === 'Red')
  const state = [
    missing.length === 0 ? 'done' : 'active',
    report ? (report.blocked ? 'red' : 'done') : reds ? 'red' : 'todo',
    report?.recommendation?.chosen ? 'done' : 'todo',
    confirmed ? 'done' : 'todo',
    report && invoiceMissing.length === 0 ? 'done' : 'todo',
  ]
  const firstOpen = state.findIndex((s) => s !== 'done')
  if (firstOpen >= 0 && state[firstOpen] === 'todo') state[firstOpen] = 'active'
  const progress = (firstOpen < 0 ? STEPS.length - 1 : Math.max(0, firstOpen)) / (STEPS.length - 1)
  return (
    <div className="glass mb-5 px-5 py-4">
      <div className="relative">
        <div className="absolute left-[10%] right-[10%] top-3.5 h-0.5 rounded-full bg-slate-200" />
        <motion.div className="absolute left-[10%] top-3.5 h-0.5 rounded-full bg-gradient-to-r from-teal-400 to-teal-600"
          animate={{ width: `${progress * 80}%` }} transition={{ duration: 0.6, ease }} />
        <ol className="relative grid grid-cols-5">
          {STEPS.map((label, i) => {
            const st = state[i]
            return (
              <li key={label} className="flex flex-col items-center text-center">
                <motion.span layout animate={{ scale: st === 'active' ? 1.1 : 1 }}
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-semibold transition-colors duration-300
                    ${st === 'done' ? 'border-teal-500 bg-teal-500 text-white' : st === 'red' ? 'border-red-500 bg-red-500 text-white'
                      : st === 'active' ? 'border-teal-500 bg-white text-teal-700 shadow-[0_0_0_4px_rgba(20,184,166,0.15)]' : 'border-slate-200 bg-white text-slate-400'}`}>
                  {st === 'done' ? '✓' : st === 'red' ? '!' : <span className="font-mono">{i + 1}</span>}
                </motion.span>
                <span className={`mt-1.5 text-[11px] font-medium sm:text-xs ${st === 'todo' ? 'text-slate-400' : st === 'red' ? 'text-red-600' : 'text-ink'}`}>{label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
