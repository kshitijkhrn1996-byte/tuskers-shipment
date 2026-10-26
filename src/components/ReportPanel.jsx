import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { gbp0 as gbp } from '../api.js'
import { Rich, Spinner, ease } from './ui.jsx'
import { Journey, TradeoffRadar } from './insights.jsx'

// Carrier recommendation + confirmation for a fully evaluated booking.
export default function ReportPanel({ report, confirmed, onConfirm }) {
  return (
    <div className="space-y-4">
      <CarrierCard recommendation={report.recommendation} priority={report.booking.seller_priority} pallets={report.booking.pallets} />
      <ConfirmCard report={report} confirmed={confirmed} onConfirm={onConfirm} />
    </div>
  )
}

function CarrierCard({ recommendation, priority, pallets }) {
  const { chosen, ranked, excluded, reason, note } = recommendation
  const all = [...ranked, ...excluded].sort((a, b) => a.option.carrier.localeCompare(b.option.carrier))
  const isPick = (s) => chosen && s.option.carrier === chosen.option.carrier && s.option.service === chosen.option.service
  return (
    <motion.section layout className="glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Recommended carrier</p>
          <p className="text-sm text-slate-500 mt-0.5">Ranked for the seller’s priority, after removing services that can’t take the load</p>
        </div>
        <span className="chip shrink-0 bg-slate-900 text-white">Priority · {priority}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {all.map((s) => {
          const pick = isPick(s)
          const out = Boolean(s.excluded_reason)
          return (
            <motion.div key={s.option.carrier + s.option.service} layout
              whileHover={out ? {} : { y: -2 }} transition={{ duration: 0.2, ease }}
              className={`relative rounded-xl border p-3.5 transition-shadow duration-200 ${out ? 'border-dashed border-slate-200 bg-slate-50/60 opacity-60'
                : pick ? 'border-transparent bg-white shadow-lift' : 'border-slate-200/80 bg-white/70 hover:shadow-lift'}`}>
              {pick && (
                <motion.span layoutId="pick-ring" transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-teal-500/70 shadow-[0_0_0_6px_rgba(20,184,166,0.08)]" />
              )}
              <div className="flex h-5 items-center">
                {pick && <span className="chip bg-teal-600 text-white">★ Pick</span>}
                {out && <span className="chip bg-slate-200 text-slate-600">Too heavy</span>}
              </div>
              <p className="mt-1 font-semibold leading-tight">{s.option.carrier}</p>
              <p className="text-xs text-slate-500">{s.option.service}</p>
              <p className="mt-3 font-mono text-xl font-semibold tracking-tight">{gbp(s.total_cost)}</p>
              <p className="font-mono text-[11px] text-slate-500">{pallets} × {gbp(s.option.price_per_pallet)}</p>
              <div className="mt-3 space-y-1.5 text-xs">
                <Metric label="Transit" value={`${s.option.transit_days} d`} pct={(1 - (s.option.transit_days - 1) / 5) * 100} />
                <Metric label="On time" value={`${s.option.on_time_rate}%`} pct={((s.option.on_time_rate - 85) / 15) * 100} />
                <div className="flex justify-between text-slate-500"><span>Max / pallet</span><span className="font-mono text-slate-700">{s.option.max_weight_per_pallet_kg} kg</span></div>
                {s.score != null && <div className="flex justify-between text-slate-500"><span>Score</span><span className="font-mono text-slate-700">{s.score.toFixed(2)}</span></div>}
              </div>
            </motion.div>
          )
        })}
      </div>

      {!chosen && <p className="mt-4 rounded-xl border border-red-200/80 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">No carrier can take this load as booked.</p>}
      <div className="mt-5 space-y-4 border-t border-slate-200/70 pt-5">
        <TradeoffRadar options={all} pickKey={chosen ? chosen.option.carrier + chosen.option.service : null} />
        <p className="text-sm leading-relaxed text-slate-600"><span className="font-medium text-ink">Why · </span><Rich text={note ? reason.replace(note, '').trim() : reason} /></p>
      </div>
      {note && (
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}
          className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
          <Rich text={note} />
        </motion.p>
      )}
    </motion.section>
  )
}

function Metric({ label, value, pct }) {
  return (
    <div>
      <div className="flex justify-between text-slate-500"><span>{label}</span><span className="font-mono text-slate-700">{value}</span></div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600"
          initial={{ width: 0 }} animate={{ width: `${Math.max(6, Math.min(100, pct))}%` }} transition={{ duration: 0.7, ease }} />
      </div>
    </div>
  )
}

function ConfirmCard({ report, confirmed, onConfirm }) {
  const { blocked, confirmation, next_steps, booking } = report
  const chosen = report.recommendation.chosen
  return (
    <motion.section layout className="glass p-5">
      <div className="flex items-center justify-between">
        <p className="label">{blocked ? 'Before it can ship' : 'Confirmation'}</p>
        {blocked ? <span className="chip border border-red-200/70 bg-red-50 text-red-700">On hold</span>
          : <span className="chip border border-emerald-200/70 bg-emerald-50 text-emerald-700">Ready</span>}
      </div>
      {chosen && (
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/60 px-3 pb-3">
          <Journey key={`${booking.ready_to_ship_date}-${chosen.option.transit_days}-${booking.destination_city}`}
            readyDate={booking.ready_to_ship_date} transitDays={chosen.option.transit_days}
            origin={booking.origin_city} destination={booking.destination_city} country={booking.destination_country} />
        </div>
      )}
      <p className="mt-3 text-sm leading-relaxed text-slate-700"><Rich text={confirmation} /></p>

      <ol className="relative mt-4 space-y-3 pl-6">
        <span className="absolute bottom-1.5 left-[7px] top-1.5 w-px bg-gradient-to-b from-slate-300 to-transparent" />
        {next_steps.map((s, i) => (
          <motion.li key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.3, ease }}
            className="relative text-sm leading-relaxed text-slate-700">
            <span className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 bg-white ${blocked ? 'border-red-400' : 'border-teal-500'}`} />
            <Rich text={s} />
          </motion.li>
        ))}
      </ol>

      <div className="mt-5 space-y-2">
        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease }}
              className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path d="M3.5 8.5l3 3 6-7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease, delay: 0.1 }} />
                </svg>
              </span>
              <div className="text-sm">
                <p className="font-semibold text-emerald-800">Booked</p>
                <p className="text-emerald-700">Reference <span className="font-mono font-semibold">{confirmed.reference}</span></p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="btn" exit={{ opacity: 0, scale: 0.98 }}>
              <ConfirmButton blocked={blocked} onConfirm={onConfirm} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
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
      <button className={blocked ? 'btn w-full border border-slate-200 bg-slate-100 text-slate-500' : 'btn-primary w-full py-2.5'} disabled={blocked || busy} onClick={click}>
        {blocked ? (
          <><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg> Fix blockers to confirm</>
        ) : busy ? <><Spinner /> Confirming…</> : 'Confirm booking'}
      </button>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  )
}
