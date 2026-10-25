import { useEffect, useState } from 'react'
import Chat from './Chat.jsx'
import Upload from './Upload.jsx'
import ReportPanel from './ReportPanel.jsx'
import DraftSummary from './DraftSummary.jsx'
import { api } from '../api.js'

const GREETING = {
  role: 'assistant',
  content: "Hi! Tell me about the shipment you'd like to send — what it is, where it's going, and anything else you know. I'll only ask for what's missing.",
}

export default function Workspace({ onContext }) {
  const [mode, setMode] = useState('chat')
  const [chat, setChat] = useState({ id: null, messages: [GREETING], draft: null, report: null, confirmed: null, missing: [] })
  const [upload, setUpload] = useState({ result: null, selected: 0, confirmed: {} })

  const uploadReport = upload.result?.reports?.[upload.selected]
  const report = mode === 'chat' ? chat.report : uploadReport

  useEffect(() => {
    if (!report) return onContext(mode === 'chat' ? 'chat booking, collecting details' : 'file upload')
    const fails = report.checks.filter((c) => c.status === 'fail').map((c) => `${c.rule_id} ${c.title}`)
    onContext(`booking ${report.booking.booking_id}; failing checks: ${fails.join(', ') || 'none'}`)
  }, [report, mode, onContext])

  const confirmChat = async () => {
    const r = await api.confirmChat(chat.id)
    setChat((c) => ({ ...c, confirmed: r, messages: [...c.messages, { role: 'assistant', content: r.message }] }))
  }
  const confirmUpload = async () => {
    const ref = uploadReport.reference
    const r = await api.confirmBooking(ref)
    setUpload((u) => ({ ...u, confirmed: { ...u.confirmed, [ref]: r } }))
  }

  const confirmed = mode === 'chat' ? chat.confirmed : upload.confirmed[uploadReport?.reference]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">
      <section className="space-y-3 min-w-0">
        <div className="inline-flex rounded-lg bg-slate-200/70 p-1 text-sm">
          {[['chat', 'Describe it (chat)'], ['upload', 'Upload booking sheet']].map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`px-3 py-1.5 rounded-md font-medium ${mode === k ? 'bg-white shadow-sm' : 'text-slate-600'}`}>{label}</button>
          ))}
        </div>
        {mode === 'chat'
          ? <Chat state={chat} setState={setChat} />
          : <Upload state={upload} setState={setUpload} />}
      </section>

      <section className="space-y-4 min-w-0">
        {mode === 'chat' && chat.draft && <DraftSummary draft={chat.draft} missing={chat.missing} />}
        {report
          ? <ReportPanel report={report} confirmed={confirmed}
              onConfirm={mode === 'chat' ? confirmChat : confirmUpload} />
          : <EmptyResults mode={mode} />}
      </section>
    </div>
  )
}

function EmptyResults({ mode }) {
  return (
    <div className="card p-8 text-center text-slate-500">
      <p className="font-semibold text-slate-700">Pre-flight checks appear here</p>
      <p className="text-sm mt-1">
        {mode === 'chat'
          ? 'Once the booking has everything it needs, we run all 10 rules and pick a carrier. Change any detail and it re-checks instantly.'
          : 'Upload a workbook with Bookings and Items sheets; every booking is checked and you can pick one to review.'}
      </p>
    </div>
  )
}
