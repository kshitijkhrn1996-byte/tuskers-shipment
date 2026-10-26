import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, gbp0 as gbp, useCarriers } from '../api.js'
import { LoadGauge, TradeoffRadar } from './insights.jsx'
import { Arrow, Rich, Spinner, ease } from './ui.jsx'

const COUNTRIES = ['Germany', 'France', 'Netherlands']
const PRIORITIES = [
  ['Cheapest', 'Lowest total price'],
  ['Fastest', 'Fewest days in transit'],
  ['Most reliable', 'Highest on-time rate'],
  ['Balanced', 'Weighted trade-off'],
]
const DEFAULT_WEIGHTS = { cost: 40, speed: 30, reliability: 30 }

export default function CarriersPage({ go }) {
  const { carriers } = useCarriers()
  const [country, setCountry] = useState('Germany')
  const [pallets, setPallets] = useState(3)
  const [gross, setGross] = useState(620)
  const [priority, setPriority] = useState('Balanced')
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    if (!pallets || !gross) return
    const id = ++seq.current
    setBusy(true)
    const t = setTimeout(async () => {
      try {
        const r = await api.compare({ destination_country: country, pallets, total_gross_weight_kg: gross, seller_priority: priority,
          weights: priority === 'Balanced' ? weights : null })
        if (id === seq.current) { setResult(r); setError('') }
      } catch (e) {
        if (id === seq.current) setError(e.message)
      } finally {
        if (id === seq.current) setBusy(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [country, pallets, gross, priority, weights])

  const rec = result?.recommendation
  const all = rec ? [...rec.ranked, ...rec.excluded] : []
  const pickKey = rec?.chosen ? rec.chosen.option.carrier + rec.chosen.option.service : null
  const limits = carriers.filter((c) => c.destination_country === country).map((c) => ({ label: c.carrier.replace('Carrier ', ''), max: c.max_weight_per_pallet_kg }))
  const totalW = weights.cost + weights.speed + weights.reliability || 1

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
        <p className="label">Carrier decision tool</p>
        <h1 className="mt-2 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-5xl">Carrier A, B or C? <span className="text-slate-400">See <span className="text-gradient">exactly why</span>, for your load.</span></h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Describe the load and what matters most. Services that can’t take your pallet weight are ruled out first, then the rest are
          ranked — the same logic that picks the carrier for every booking.
        </p>
      </motion.div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* controls */}
        <section className="glass space-y-6 p-5 lg:sticky lg:top-24">
          <Control label="Delivering to">
            <Segmented value={country} onChange={setCountry} options={COUNTRIES.map((c) => [c, c])} id="country" />
          </Control>

          <Control label="Pallets">
            <div className="flex items-center gap-3">
              <Stepper onClick={() => setPallets((p) => Math.max(1, p - 1))}>−</Stepper>
              <motion.span key={pallets} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-10 text-center font-mono text-2xl font-semibold">{pallets}</motion.span>
              <Stepper onClick={() => setPallets((p) => Math.min(60, p + 1))}>+</Stepper>
            </div>
          </Control>

          <Control label="Total gross weight (kg)">
            <div className="flex items-center gap-3">
              <input type="range" min="50" max="4000" step="10" value={gross} onChange={(e) => setGross(Number(e.target.value))} className="flex-1 accent-teal-600" />
              <input type="number" min="1" value={gross} onChange={(e) => setGross(Math.max(1, Number(e.target.value)))} className="field field-ok mt-0 w-24 font-mono" />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">= <span className="font-mono font-semibold text-ink">{Math.round(gross / pallets)} kg</span> per pallet</p>
          </Control>

          <Control label="What matters most">
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map(([p, hint]) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`relative rounded-xl border px-3 py-2 text-left transition-all duration-200 ${priority === p ? 'border-teal-500 bg-teal-50/70 shadow-[0_0_0_3px_rgba(20,184,166,0.12)]' : 'border-slate-200 bg-white/70 hover:shadow-lift'}`}>
                  <span className="block text-sm font-semibold">{p}</span>
                  <span className="block text-[11px] text-slate-500">{hint}</span>
                </button>
              ))}
            </div>
          </Control>

          <AnimatePresence initial={false}>
            {priority === 'Balanced' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease }} className="overflow-hidden">
                <Control label="Balance the trade-off" right={<button onClick={() => setWeights(DEFAULT_WEIGHTS)} className="text-xs font-medium text-teal-700">Reset 40/30/30</button>}>
                  {[['cost', 'Cost'], ['speed', 'Speed'], ['reliability', 'Reliability']].map(([k, label]) => (
                    <div key={k} className="mb-2.5">
                      <div className="flex justify-between text-xs"><span className="text-slate-600">{label}</span>
                        <span className="font-mono font-semibold">{Math.round((weights[k] / totalW) * 100)}%</span></div>
                      <input type="range" min="0" max="100" value={weights[k]} onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                        className="w-full accent-teal-600" />
                    </div>
                  ))}
                </Control>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* results */}
        <section className="min-w-0 space-y-4">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {!rec ? (
            <div className="glass grid h-60 place-items-center text-slate-400"><Spinner className="h-6 w-6" /></div>
          ) : (
            <>
              <motion.div layout className="glass overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-teal-50/80 to-transparent px-6 py-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="label">Recommended</p>
                      {busy && <Spinner className="h-3.5 w-3.5 text-slate-400" />}
                    </div>
                    <AnimatePresence mode="popLayout">
                      <motion.h2 key={pickKey || 'none'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3, ease }} className="text-2xl font-semibold tracking-tight">
                        {rec.chosen ? <>{rec.chosen.option.carrier} <span className="text-slate-400">· {rec.chosen.option.service}</span></> : <span className="text-red-600">No carrier can take this load</span>}
                      </motion.h2>
                    </AnimatePresence>
                  </div>
                  {rec.chosen && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Stat k="Total" v={gbp(rec.chosen.total_cost)} />
                      <Stat k="Transit" v={`${rec.chosen.option.transit_days} days`} />
                      <Stat k="On time" v={`${rec.chosen.option.on_time_rate}%`} />
                    </div>
                  )}
                </div>
                <p className="px-6 py-4 text-sm leading-relaxed text-slate-600"><span className="font-medium text-ink">Why · </span>
                  <Rich text={rec.note ? rec.reason.replace(rec.note, '').trim() : rec.reason} /></p>
                {rec.note && <p className="mx-6 mb-5 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-900"><Rich text={rec.note} /></p>}
              </motion.div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="glass p-5">
                  <p className="label mb-4">Will the pallets fit?</p>
                  <LoadGauge gross={gross} pallets={pallets} cartons={pallets * 24} limits={limits} />
                </div>
                <div className="glass p-5">
                  <p className="label mb-2">Trade-off</p>
                  <TradeoffRadar key={`${country}-${pallets}-${gross}-${priority}-${JSON.stringify(weights)}`} options={all} pickKey={pickKey} />
                </div>
              </div>

              <div className="glass overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr><th className="px-5 py-3">Rank</th><th>Service</th><th className="text-right">Total</th><th className="text-right">Days</th><th className="text-right">On time</th>
                      <th className="text-right">Max/pallet</th>{priority === 'Balanced' && <th className="text-right">Score</th>}<th className="px-5 text-right">Status</th></tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {all.map((s, i) => {
                        const key = s.option.carrier + s.option.service
                        const pick = key === pickKey
                        return (
                          <motion.tr key={key} layout transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                            className={`border-t border-slate-200/70 ${pick ? 'bg-teal-50/60' : ''} ${s.excluded_reason ? 'text-slate-400' : ''}`}>
                            <td className="px-5 py-3 font-mono">{s.excluded_reason ? '—' : i + 1}</td>
                            <td className="font-medium">{s.option.carrier} <span className="font-normal text-slate-500">· {s.option.service}</span></td>
                            <td className="text-right font-mono">{gbp(s.total_cost)}</td>
                            <td className="text-right font-mono">{s.option.transit_days}</td>
                            <td className="text-right font-mono">{s.option.on_time_rate}%</td>
                            <td className="text-right font-mono">{s.option.max_weight_per_pallet_kg} kg</td>
                            {priority === 'Balanced' && <td className="text-right font-mono">{s.score != null ? s.score.toFixed(2) : '—'}</td>}
                            <td className="px-5 text-right">{s.excluded_reason ? <span className="chip bg-slate-100 text-slate-500">Too heavy</span>
                              : pick ? <span className="chip bg-teal-600 text-white">★ Pick</span> : <span className="chip bg-white text-slate-600 ring-1 ring-slate-200">Fits</span>}</td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 px-5 py-4">
                <p className="text-sm text-slate-600">Happy with this? Book the consignment and the same choice is made for you, after the pre-flight checks.</p>
                <button className="btn-primary group" onClick={() => go('book')}>Book a shipment <Arrow /></button>
              </div>
            </>
          )}
        </section>
      </div>

      <RateCard carriers={carriers} />
    </div>
  )
}

function RateCard({ carriers }) {
  if (!carriers.length) return null
  const services = [...new Map(carriers.map((c) => [c.carrier, c])).values()]
  return (
    <section className="mt-12">
      <p className="label">Full rate card</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Price per pallet, by destination</h2>
      <div className="glass mt-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr><th className="px-5 py-3">Service</th>{COUNTRIES.map((c) => <th key={c} className="text-right">{c}</th>)}
              <th className="text-right">Days</th><th className="text-right">On time</th><th className="px-5 text-right">Max / pallet</th></tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.carrier} className="border-t border-slate-200/70">
                <td className="px-5 py-3 font-medium">{s.carrier} <span className="font-normal text-slate-500">· {s.service}</span></td>
                {COUNTRIES.map((c) => {
                  const row = carriers.find((x) => x.carrier === s.carrier && x.destination_country === c)
                  return <td key={c} className="text-right font-mono">{row ? gbp(row.price_per_pallet) : '—'}</td>
                })}
                <td className="text-right font-mono">{s.transit_days}</td>
                <td className="text-right font-mono">{s.on_time_rate}%</td>
                <td className="px-5 text-right font-mono">{s.max_weight_per_pallet_kg} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Control({ label, right, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><p className="label">{label}</p>{right}</div>
      {children}
    </div>
  )
}

function Segmented({ value, onChange, options, id }) {
  return (
    <div className="relative grid rounded-xl border border-slate-200/80 bg-white/60 p-1 text-sm" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={`relative z-10 rounded-lg px-2 py-1.5 font-medium transition-colors ${value === v ? 'text-ink' : 'text-slate-500 hover:text-ink'}`}>
          {value === v && <motion.span layoutId={`seg-${id}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="absolute inset-0 -z-10 rounded-lg bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.15)]" />}
          {label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ onClick, children }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition-shadow hover:shadow-lift">
      {children}
    </motion.button>
  )
}

function Stat({ k, v }) {
  return (
    <div className="min-w-[5.5rem] rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k}</p>
      <motion.p key={v} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="font-mono text-sm font-semibold">{v}</motion.p>
    </div>
  )
}
