import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Chat, { newMessage } from './Chat.jsx'
import Upload from './Upload.jsx'
import ReportPanel from './ReportPanel.jsx'
import BookingForm from './BookingForm.jsx'
import ValidationPanel, { issuesFromReport } from './ValidationPanel.jsx'
import InvoiceView from './InvoiceView.jsx'
import InvoiceStep, { Stepper } from './InvoiceStep.jsx'
import { Collapse, ease } from './ui.jsx'
import RouteMap from './RouteMap.jsx'
import { Scene } from './art.jsx'
import { LoadGauge, Reconcile, reconcileRows } from './insights.jsx'
import { api, gbp0, hsBus } from '../api.js'

const greeting = () => newMessage('assistant',
  "Hi! Tell me about the shipment — what you're sending, where from and to, and anything else you know. I'll flag problems as we go and only ask for what's missing.")
const EMPTY_DRAFT = { booking: { origin_country: 'United Kingdom', currency: 'GBP' }, items: [], invoice: {}, unknown: [], derived: [] }
const NEW_SESSION = { id: null, draft: EMPTY_DRAFT, missing: ['items'], issues: [], report: null, invoiceMissing: [], inputErrors: [], confirmed: null, version: 0 }

const MODES = [
  ['chat', 'Chat', 'M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6a2.5 2.5 0 0 1-2.5 2.5H8l-4 3v-3.2A2.5 2.5 0 0 1 3 11.5z'],
  ['form', 'Form', 'M5 2.5h7l3 3v12H5z M7.5 9h5 M7.5 12h5'],
  ['upload', 'Upload sheet', 'M10 13V3 M6 7l4-4 4 4 M3.5 13v3.5h13V13'],
]

export default function Workspace({ onContext }) {
  const [mode, setMode] = useState('chat')
  const [session, setSession] = useState(NEW_SESSION)
  const [messages, setMessages] = useState(() => [greeting()])
  const [upload, setUpload] = useState({ result: null, selected: 0, confirmed: {} })
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [carriers, setCarriers] = useState([])
  const saveSeq = useRef(0)

  const applySnapshot = useCallback((r, extra = {}) => {
    setSession((s) => ({
      ...s, id: r.conversation_id ?? s.id, draft: r.draft, missing: r.missing, issues: r.issues,
      report: r.report, invoiceMissing: r.invoice_missing, inputErrors: r.input_errors || [],
      version: s.version + 1, ...extra,
    }))
  }, [])

  const saveForm = useCallback(async (draft) => {
    const seq = ++saveSeq.current
    try {
      const r = await api.saveDraft(session.id, draft)
      if (seq === saveSeq.current) applySnapshot(r)
    } catch (e) {
      setSession((s) => ({ ...s, inputErrors: [{ field: '', message: e.message }] }))
    }
  }, [session.id, applySnapshot])

  useEffect(() => { api.carriers().then(setCarriers).catch(() => {}) }, [])

  // HS finder (in the floating dock) needs the products, and can write a code back to one of them
  const latest = useRef(session)
  latest.current = session
  useEffect(() => {
    hsBus.items(session.draft.items.map((it, index) => ({ index, description: it.description, hs_code: it.hs_code })))
  }, [session.draft.items])
  useEffect(() => {
    const onApply = (e) => {
      const { index, code } = e.detail
      const draft = JSON.parse(JSON.stringify(latest.current.draft))
      if (!draft.items[index]) return
      draft.items[index].hs_code = code
      draft.unknown = (draft.unknown || []).filter((k) => k !== `items.${index}.hs_code`)
      setSession((s) => ({ ...s, draft }))
      saveForm(draft)
    }
    window.addEventListener('tuskers:apply-hs', onApply)
    return () => window.removeEventListener('tuskers:apply-hs', onApply)
  }, [saveForm])

  const startOver = () => { setSession(NEW_SESSION); setMessages([greeting()]) }

  const uploadReport = upload.result?.reports?.[upload.selected]
  const report = mode === 'upload' ? uploadReport : session.report
  const note = session.report?.recommendation?.note
  const liveIssues = [...session.issues, ...(note ? [{ key: 'carrier-note', rule_id: null, severity: 'Info', message: note }] : [])]

  useEffect(() => {
    if (!report) return onContext(mode === 'upload' ? 'file upload' : 'booking in progress')
    const fails = report.checks.filter((c) => c.status === 'fail').map((c) => `${c.rule_id} ${c.title}`)
    onContext(`booking ${report.booking.booking_id}; failing checks: ${fails.join(', ') || 'none'}`)
  }, [report, mode, onContext])

  const confirmSession = async () => {
    const r = await api.confirm(session.id, mode === 'form' ? 'form' : 'chat')
    setSession((s) => ({ ...s, confirmed: r }))
    setMessages((m) => [...m, newMessage('assistant', r.message, { fresh: true })])
  }
  const confirmUpload = async () => {
    const ref = uploadReport.reference
    const r = await api.confirmBooking(ref)
    setUpload((u) => ({ ...u, confirmed: { ...u.confirmed, [ref]: r } }))
  }
  const fixInForm = async () => {
    const { draft } = await api.bookingDraft(uploadReport.reference)
    const r = await api.saveDraft(null, draft)
    setSession({ ...NEW_SESSION })
    applySnapshot(r)
    setMode('form')
  }

  const strip = mode === 'upload' ? uploadReport?.booking : session.draft.booking
  const items = mode === 'upload' ? uploadReport?.booking.items || [] : session.draft.items
  const bookingId = mode === 'upload' ? uploadReport?.booking.booking_id : session.draft.booking_id
  const missingWeight = session.missing.reduce((n, m) => n + (m === 'items' ? 9 : 1), 0)
  const progress = 1 - missingWeight / (9 + Math.max(1, session.draft.items.length) * 9)
  const showData = strip && (mode === 'upload' || session.draft.booking.seller_name || session.draft.items.length > 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Booking workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight">Book, check and confirm a shipment</h1>
        </div>
        <div className="flex items-center gap-3">
          {mode !== 'upload' && (
            <button onClick={startOver} className="whitespace-nowrap text-xs font-medium text-slate-500 transition-colors hover:text-ink">Start over</button>
          )}
          <div className="relative inline-flex rounded-xl border border-slate-200/70 bg-white/60 p-1 text-sm shadow-glass backdrop-blur-xl">
            {MODES.map(([k, label, icon]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition-colors duration-200 sm:px-3.5 ${mode === k ? 'text-ink' : 'text-slate-500 hover:text-ink'}`}>
                {mode === k && (
                  <motion.span layoutId="mode-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 -z-10 rounded-lg bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.15)]" />
                )}
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode !== 'upload' && <Stepper session={session} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <div className="min-w-0 lg:sticky lg:top-24">
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease }}>
              {mode === 'chat' && <Chat sessionId={session.id} messages={messages} setMessages={setMessages} onTurn={applySnapshot} progress={progress} />}
              {mode === 'form' && (
                <div className="glass p-5">
                  <div className="mb-4">
                    <p className="label">Fill in a form</p>
                    <p className="text-sm text-slate-500">Same booking as the chat — every field is checked as you type.</p>
                  </div>
                  <BookingForm session={session} onSave={saveForm} />
                </div>
              )}
              {mode === 'upload' && <Upload state={upload} setState={setUpload} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="min-w-0 space-y-4">
          {showData && <BookingStrip b={strip} />}

          {mode === 'upload' && !uploadReport ? (
            <Empty title="Upload the Bookings and Items sheets"
              text="Every booking is checked against all 10 rules. Pick one on the left to see what’s wrong, how serious it is, and how to fix it." />
          ) : (
            <ValidationPanel report={report} bookingId={bookingId}
              issues={mode === 'upload' ? issuesFromReport(uploadReport) : liveIssues}
              missing={mode === 'upload' ? [] : session.missing} />
          )}

          {showData && (mode === 'upload' ? uploadReport : true) && (
            <InsightsCard b={strip} items={items} derived={mode === 'upload' ? [] : session.draft.derived || []} carriers={carriers} />
          )}

          {mode === 'chat' && (
            <section className="glass">
              <button onClick={() => setDetailsOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3.5 text-left">
                <span>
                  <span className="label">Booking details</span>
                  <span className="block text-sm text-slate-500">Edit any field directly — the chat keeps up</span>
                </span>
                <motion.span animate={{ rotate: detailsOpen ? 180 : 0 }} transition={{ duration: 0.25, ease }}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/80 bg-white/80 text-slate-500">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6l4 4 4-4" /></svg>
                </motion.span>
              </button>
              <Collapse open={detailsOpen}>
                <div className="border-t border-slate-200/70 px-5 py-4"><BookingForm session={session} onSave={saveForm} compact /></div>
              </Collapse>
            </section>
          )}

          {mode === 'upload' && uploadReport && (
            <>
              <ReportPanel report={uploadReport} confirmed={upload.confirmed[uploadReport.reference]} onConfirm={confirmUpload} />
              <button className="btn-ghost w-full" onClick={fixInForm}>Open this booking in the form to fix it or create its invoice</button>
            </>
          )}
          {mode !== 'upload' && (session.report
            ? <ReportPanel report={session.report} confirmed={session.confirmed} onConfirm={confirmSession} />
            : <Empty title="Carrier and confirmation appear here"
                text="As soon as the booking has everything it needs, the best carrier for the seller’s priority is picked and you can confirm or create the commercial invoice." />)}
          {mode !== 'upload' && session.report && (
            <InvoiceStep session={session} onSave={saveForm} onOpen={() => setInvoiceOpen(true)} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {invoiceOpen && session.id && (
          <InvoiceView key="invoice" conversationId={session.id} version={session.version} onClose={() => setInvoiceOpen(false)}
            onEdit={() => { setInvoiceOpen(false); setMode('form') }} />
        )}
      </AnimatePresence>
    </div>
  )
}

const fmtDate = (d) => {
  if (!d) return null
  const [a, b, c] = d.split('-')
  const iso = a.length === 4 ? `${a}-${b}-${c}` : `${c}-${b}-${a}`
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function BookingStrip({ b }) {
  const cells = [
    ['Pallets', b.pallets],
    ['Cartons', b.cartons],
    ['Gross', b.total_gross_weight_kg != null ? `${b.total_gross_weight_kg} kg` : null],
    ['Value', b.total_declared_value != null ? gbp0(b.total_declared_value) : null],
    ['Ready', fmtDate(b.ready_to_ship_date)],
  ]
  return (
    <motion.section layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}
      className="glass grid gap-4 px-4 py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <div className="hidden overflow-hidden rounded-xl border border-slate-200/70 sm:block">
        <RouteMap origin={b.origin_city || null} dest={b.destination_city || null} compact />
      </div>
      <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="truncate font-semibold">{b.seller_name || <span className="text-slate-400">Seller —</span>}</p>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <span className={b.origin_city ? '' : 'text-slate-400'}>{b.origin_city || 'Origin'}</span>
          <svg viewBox="0 0 24 8" className="h-2 w-6 text-teal-500"><path d="M0 4h21M18 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
          <span className={b.destination_city ? '' : 'text-slate-400'}>{b.destination_city ? `${b.destination_city}, ${b.destination_country}` : 'Destination'}</span>
          {b.destination_type && <span className="chip bg-slate-100 text-slate-600">{b.destination_type}</span>}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(4.6rem,1fr))] gap-2">
        {cells.map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-xl border border-slate-200/70 bg-white/70 px-2.5 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
            <motion.dd key={String(v)} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease }} className={`font-mono text-sm font-medium ${v == null ? 'text-slate-300' : 'text-ink'}`}>
              {v ?? '—'}
            </motion.dd>
          </div>
        ))}
      </dl>
      </div>
    </motion.section>
  )
}

function InsightsCard({ b, items, derived, carriers }) {
  const limits = carriers.filter((c) => c.destination_country === b.destination_country)
    .map((c) => ({ label: c.carrier.replace('Carrier ', ''), max: c.max_weight_per_pallet_kg }))
  const num = (v) => (v == null || v === '' ? null : Number(v))
  return (
    <motion.section layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="glass p-5">
      <p className="label">Load & paperwork at a glance</p>
      <div className="mt-4">
        <p className="mb-3 text-sm font-medium">Weight per pallet vs carrier limits <span className="font-mono text-[11px] text-slate-400">R-05</span></p>
        <LoadGauge gross={num(b.total_gross_weight_kg)} pallets={num(b.pallets)} cartons={num(b.cartons)} limits={limits} />
      </div>
      <div className="mt-5 border-t border-slate-200/70 pt-5">
        <Reconcile rows={reconcileRows(b, items, derived)} />
      </div>
    </motion.section>
  )
}

function Empty({ title, text }) {
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass overflow-hidden border-dashed px-6 pb-6 text-center">
      <Scene className="-mx-6 mb-2" />
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{text}</p>
    </motion.section>
  )
}
