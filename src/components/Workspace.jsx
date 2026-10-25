import { useCallback, useEffect, useRef, useState } from 'react'
import Chat from './Chat.jsx'
import Upload from './Upload.jsx'
import ReportPanel from './ReportPanel.jsx'
import BookingForm from './BookingForm.jsx'
import IssuesPanel from './IssuesPanel.jsx'
import InvoiceView from './InvoiceView.jsx'
import { api } from '../api.js'

const GREETING = {
  role: 'assistant',
  content: "Hi! Tell me about the shipment — what you're sending, where from and to, and anything else you know. I'll flag problems as we go and only ask for what's missing.",
}
const EMPTY_DRAFT = { booking: { origin_country: 'United Kingdom', currency: 'GBP' }, items: [], invoice: {}, unknown: [], derived: [] }
const NEW_SESSION = { id: null, draft: EMPTY_DRAFT, missing: ['items'], issues: [], report: null, invoiceMissing: [], inputErrors: [], confirmed: null, version: 0 }

const MODES = [
  ['chat', 'Chat', 'M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6a2.5 2.5 0 0 1-2.5 2.5H8l-4 3v-3.2A2.5 2.5 0 0 1 3 11.5z'],
  ['form', 'Fill in a form', 'M5 2.5h7l3 3v12H5z M7.5 9h5 M7.5 12h5'],
  ['upload', 'Upload sheet', 'M10 13V3 M6 7l4-4 4 4 M3.5 13v3.5h13V13'],
]

export default function Workspace({ onContext }) {
  const [mode, setMode] = useState('chat')
  const [session, setSession] = useState(NEW_SESSION)
  const [messages, setMessages] = useState([GREETING])
  const [upload, setUpload] = useState({ result: null, selected: 0, confirmed: {} })
  const [invoiceOpen, setInvoiceOpen] = useState(false)
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

  const newBooking = () => { setSession(NEW_SESSION); setMessages([GREETING]) }

  const uploadReport = upload.result?.reports?.[upload.selected]
  const report = mode === 'upload' ? uploadReport : session.report

  useEffect(() => {
    if (!report) return onContext(mode === 'upload' ? 'file upload' : 'booking in progress')
    const fails = report.checks.filter((c) => c.status === 'fail').map((c) => `${c.rule_id} ${c.title}`)
    onContext(`booking ${report.booking.booking_id}; failing checks: ${fails.join(', ') || 'none'}`)
  }, [report, mode, onContext])

  const confirmSession = async () => {
    const r = await api.confirm(session.id, mode === 'form' ? 'form' : 'chat')
    setSession((s) => ({ ...s, confirmed: r }))
    setMessages((m) => [...m, { role: 'assistant', content: r.message }])
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-sm">
          {MODES.map(([k, label, icon]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition ${mode === k ? 'bg-white shadow-sm text-ink' : 'text-slate-600 hover:text-ink'}`}>
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
              {label}
            </button>
          ))}
        </div>
        {mode !== 'upload' && (
          <p className="text-xs text-slate-500">Chat and form edit the same booking — switch any time.
            <button onClick={newBooking} className="ml-2 font-semibold text-slate-700 hover:underline">Start over</button>
          </p>
        )}
      </div>

      {mode === 'upload' ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <Upload state={upload} setState={setUpload} />
          <div className="space-y-4 min-w-0">
            {uploadReport ? (
              <>
                <ReportPanel report={uploadReport} confirmed={upload.confirmed[uploadReport.reference]} onConfirm={confirmUpload} />
                <button className="btn-ghost w-full" onClick={fixInForm}>Open this booking in the form to fix it</button>
              </>
            ) : <Empty text="Upload a workbook with Bookings and Items sheets. Every booking is checked; pick one to see what's wrong and how to fix it." />}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="min-w-0">
            {mode === 'chat'
              ? <Chat sessionId={session.id} messages={messages} setMessages={setMessages} onTurn={applySnapshot} />
              : (
                <div className="card p-4">
                  <BookingForm session={session} onSave={saveForm} />
                </div>
              )}
          </div>
          <div className="space-y-4 min-w-0">
            <IssuesPanel issues={session.issues} missing={session.missing} complete={!!session.report} />
            {mode === 'chat' && (
              <details className="card group" open>
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex items-center justify-between list-none">
                  Booking details <span className="text-xs font-normal text-slate-500">edit anything here — the chat keeps up</span>
                </summary>
                <div className="px-4 pb-4"><BookingForm session={session} onSave={saveForm} compact /></div>
              </details>
            )}
            {session.report
              ? <ReportPanel report={session.report} confirmed={session.confirmed} onConfirm={confirmSession}
                  onInvoice={() => setInvoiceOpen(true)} showFailures={false} />
              : <Empty text="Once the booking has everything it needs, all 10 rules run, a carrier is picked and you can confirm or create the commercial invoice." />}
          </div>
        </div>
      )}

      {invoiceOpen && session.id && (
        <InvoiceView conversationId={session.id} version={session.version} onClose={() => setInvoiceOpen(false)}
          onEdit={() => { setInvoiceOpen(false); setMode('form') }} />
      )}
    </div>
  )
}

function Empty({ text }) {
  return <div className="card p-6 text-center text-sm text-slate-500">{text}</div>
}
