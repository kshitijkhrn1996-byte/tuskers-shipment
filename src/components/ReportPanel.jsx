import { useState } from 'react'
import { gbp0 as gbp } from '../api.js'

const DOT = { pass: 'bg-emerald-500', fail_Red: 'bg-red-500', fail_Amber: 'bg-amber-400', pending: 'bg-slate-300' }

export default function ReportPanel({ report, confirmed, onConfirm, onInvoice, showFailures = true }) {
  const { booking, checks, blocked, red_count, amber_count, recommendation, confirmation, next_steps } = report
  const fails = checks.filter((c) => c.status === 'fail')
  const status = blocked
    ? { label: 'On hold — fix before it ships', cls: 'bg-red-50 border-red-200 text-red-800', dot: 'bg-red-500' }
    : amber_count
      ? { label: 'Ready, with warnings', cls: 'bg-amber-50 border-amber-200 text-amber-900', dot: 'bg-amber-400' }
      : { label: 'Ready to book', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500' }

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${status.cls}`}>
        <span className={`w-3 h-3 rounded-full ${status.dot}`} />
        <div className="flex-1">
          <p className="font-semibold">{status.label}</p>
          <p className="text-xs opacity-80">{booking.booking_id} · {booking.seller_name} · {booking.origin_city} → {booking.destination_city}, {booking.destination_country}</p>
        </div>
        <div className="text-right text-xs font-semibold">
          <div className="text-red-700">{red_count} red</div>
          <div className="text-amber-700">{amber_count} amber</div>
        </div>
      </div>

      <div className="card">
        <h3 className="px-4 pt-3 pb-2 text-sm font-semibold">Pre-flight checks</h3>
        {showFailures && fails.length > 0 && (
          <div className="px-4 pb-3 space-y-2">
            {fails.map((c) => (
              <div key={c.rule_id} className={`rounded-lg border-l-4 px-3 py-2 text-sm ${c.severity === 'Red' ? 'border-red-500 bg-red-50' : 'border-amber-400 bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  <span className={`chip ${c.severity === 'Red' ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950'}`}>
                    {c.severity === 'Red' ? 'RED · blocks' : 'AMBER · warning'}
                  </span>
                  <span className="font-semibold">{c.rule_id} {c.title}</span>
                </div>
                <p className="mt-1 text-slate-700"><b>Problem:</b> {c.fault}</p>
                <p className="text-slate-700"><b>Fix:</b> {c.fix}</p>
              </div>
            ))}
          </div>
        )}
        <ul className="grid sm:grid-cols-2 gap-x-4 px-4 pb-3 text-sm">
          {checks.map((c) => (
            <li key={c.rule_id} className="flex items-center gap-2 py-1" title={c.fault || ''}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[c.status === 'fail' ? `fail_${c.severity}` : c.status]}`} />
              <span className="text-slate-500 w-9">{c.rule_id}</span>
              <span className={c.status === 'fail' ? 'font-medium' : 'text-slate-600'}>{c.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <CarrierCard recommendation={recommendation} priority={booking.seller_priority} pallets={booking.pallets} />

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Confirmation</h3>
        <p className="text-sm text-slate-700">{confirmation}</p>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">{blocked ? 'To do' : 'What happens next'}</p>
          <ol className="mt-1 space-y-1 text-sm list-decimal list-inside text-slate-700">
            {next_steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </div>
        {confirmed
          ? <div className="rounded-lg bg-brand-light text-brand-dark px-3 py-2 text-sm font-semibold">Booked ✓ Reference {confirmed.reference}</div>
          : <ConfirmButton blocked={blocked} onConfirm={onConfirm} />}
        {onInvoice && (
          <button className="btn-ghost w-full" onClick={onInvoice}>
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 2.5h7l3 3v12H5z M12 2.5v3h3 M7.5 9h5 M7.5 12h5 M7.5 15h3" strokeLinejoin="round" /></svg>
            Commercial invoice
          </button>
        )}
      </div>
    </div>
  )
}

function ConfirmButton({ blocked, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const click = async () => {
    setBusy(true); setErr('')
    try { await onConfirm() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div>
      <button className="btn-primary w-full" disabled={blocked || busy} onClick={click}>
        {blocked ? 'Fix red issues to confirm' : busy ? 'Confirming…' : 'Confirm booking'}
      </button>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  )
}

function CarrierCard({ recommendation, priority, pallets }) {
  const { chosen, ranked, excluded, reason } = recommendation
  const rows = [...ranked, ...excluded]
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recommended carrier</h3>
        <span className="chip bg-slate-100 text-slate-700">Priority: {priority}</span>
      </div>
      {chosen ? (
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-lg font-bold">{chosen.option.carrier} · {chosen.option.service}</p>
            <p className="text-sm text-slate-600">{chosen.option.transit_days} days · {chosen.option.on_time_rate}% on time · max {chosen.option.max_weight_per_pallet_kg} kg/pallet</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{gbp(chosen.total_cost)}</p>
            <p className="text-xs text-slate-500">{pallets} × {gbp(chosen.option.price_per_pallet)}</p>
          </div>
        </div>
      ) : <p className="mt-2 font-semibold text-red-700">No carrier can take this load as booked.</p>}
      <p className="text-sm text-slate-600 mt-2"><b>Why:</b> {reason}</p>
      <table className="w-full text-xs mt-3">
        <thead className="text-slate-500 uppercase">
          <tr><th className="text-left py-1">Option</th><th className="text-right">Cost</th><th className="text-right">Days</th><th className="text-right">On time</th>
            {priority === 'Balanced' && <th className="text-right">Score</th>}<th className="text-right">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const isPick = chosen && s.option.carrier === chosen.option.carrier && s.option.service === chosen.option.service
            return (
              <tr key={s.option.carrier + s.option.service} className={`border-t border-slate-100 ${isPick ? 'font-semibold' : ''} ${s.excluded_reason ? 'text-slate-400' : ''}`}>
                <td className="py-1.5">{s.option.carrier} · {s.option.service}</td>
                <td className="text-right">{gbp(s.total_cost)}</td>
                <td className="text-right">{s.option.transit_days}</td>
                <td className="text-right">{s.option.on_time_rate}%</td>
                {priority === 'Balanced' && <td className="text-right">{s.score ?? '—'}</td>}
                <td className="text-right">{s.excluded_reason ? 'too heavy' : isPick ? '★ pick' : 'fits'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
