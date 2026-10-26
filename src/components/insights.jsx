import { motion } from 'framer-motion'
import { gbp0 } from '../api.js'
import { Pallet, Truck } from './art.jsx'
import { StatusIcon, ease } from './ui.jsx'

const TONE = { pass: '#10b981', red: '#ef4444', amber: '#f59e0b', pending: '#38bdf8', waiting: '#e2e8f0' }

// ---------- 10-segment readiness ring: one arc per rule ----------

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export function ReadinessRing({ rows, size = 92, live = false }) {
  const passing = rows.filter((r) => r.status === 'pass').length
  const flagged = rows.filter((r) => r.status === 'red' || r.status === 'amber').length
  const c = size / 2
  const r = size / 2 - 7
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {rows.map((row, i) => (
          <g key={row.id}>
            <title>{`${row.id} · ${row.title}`}</title>
            <motion.path d={arc(c, c, r, i * 36 + 3, i * 36 + 33)} fill="none" stroke={TONE[row.status]} strokeWidth="8" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: i * 0.05, ease }} />
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <motion.div key={live ? `f${flagged}` : passing} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="font-mono text-xl font-semibold leading-none">{live ? flagged : passing}<span className="text-sm text-slate-400">/10</span></motion.div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">{live ? 'flagged' : 'passing'}</div>
        </div>
      </div>
    </div>
  )
}

// ---------- pallet load vs each carrier's limit (R-05) ----------

export function LoadGauge({ gross, pallets, cartons, limits }) {
  if (!gross || !pallets) {
    return <Waiting text="Needs pallets and gross weight" />
  }
  const per = gross / pallets
  const sorted = [...limits].sort((a, b) => a.max - b.max)
  const top = Math.max(per * 1.12, (sorted.at(-1)?.max || 500) * 1.12)
  const fits = sorted.filter((l) => l.max >= per)
  const tone = !sorted.length ? 'ok' : !fits.length ? 'over' : fits.length < sorted.length ? 'warn' : 'ok'
  const bar = { ok: 'from-teal-400 to-teal-600', warn: 'from-amber-300 to-amber-500', over: 'from-red-400 to-red-600' }[tone]
  const perCarton = cartons ? Math.ceil(cartons / pallets) : 12
  const shown = Math.min(pallets, 6)
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-1">
          {Array.from({ length: shown }).map((_, i) => (
            <motion.div key={i} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.07, type: 'spring', stiffness: 380, damping: 18 }}>
              <Pallet rows={Math.ceil(perCarton / 12)} tone={tone} className="w-10" />
            </motion.div>
          ))}
          {pallets > shown && <span className="mb-2 font-mono text-xs text-slate-500">+{pallets - shown}</span>}
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold leading-none">{Math.round(per)}<span className="text-sm text-slate-400"> kg</span></p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{gross} kg ÷ {pallets} pallet{pallets > 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="relative mt-7 h-3 rounded-full bg-slate-100">
        <motion.div className={`h-full rounded-full bg-gradient-to-r ${bar}`} initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (per / top) * 100)}%` }} transition={{ duration: 0.9, ease }} />
        {sorted.map((l, i) => {
          const ok = l.max >= per
          return (
            <div key={l.label} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(l.max / top) * 100}%` }}>
              <div className={`h-6 w-0.5 rounded-full ${ok ? 'bg-slate-700' : 'bg-red-500'}`} />
              <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] ${i % 2 ? 'top-7' : '-top-5'} ${ok ? 'text-slate-600' : 'text-red-600 line-through'}`}>
                {l.label} {l.max}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-8 text-xs text-slate-500">
        {tone === 'over' ? 'Too heavy for every carrier on this route — add pallets.'
          : tone === 'warn' ? `Fits ${fits.map((f) => f.label).join(', ')} only.` : 'Fits every carrier on this route.'}
      </p>
    </div>
  )
}

// ---------- reconciliation bars (R-02, R-04, R-07) ----------

export function Reconcile({ rows }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {rows.map((r, i) => {
        if (r.a == null || r.b == null) {
          return (
            <div key={r.rule} className="text-sm text-slate-400">
              <div className="flex items-center gap-2"><StatusIcon status="waiting" /><span className="whitespace-nowrap font-mono text-[11px]">{r.rule}</span></div>
              <p className="mt-1.5 leading-snug">{r.title}</p>
              <p className="text-xs">Waiting for details</p>
            </div>
          )
        }
        const max = Math.max(r.a, r.b, 1)
        return (
          <div key={r.rule}>
            <div className="flex items-center gap-2">
              <StatusIcon status={r.status} />
              <span className="whitespace-nowrap font-mono text-[11px] text-slate-400">{r.rule}</span>
            </div>
            <p className="mt-1.5 text-sm font-medium leading-snug">{r.title}</p>
            {r.note && <p className="text-[11px] text-slate-400">{r.note}</p>}
            <div className="mt-2.5 space-y-2">
              {[[r.aLabel, r.a, 'from-slate-300 to-slate-400'], [r.bLabel, r.b, r.status === 'pass' ? 'from-teal-400 to-teal-600' : r.status === 'red' ? 'from-red-400 to-red-500' : 'from-amber-300 to-amber-500']].map(([label, v, grad], k) => (
                <div key={label} className="text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className="font-mono text-slate-700">{r.fmt(v)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <motion.div className={`h-full rounded-full bg-gradient-to-r ${grad}`} initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 + k * 0.08, ease }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function reconcileRows(b, items, derived = []) {
  const full = items.length > 0 && items.every((it) => it.quantity != null && it.quantity !== '' && it.unit_price != null && it.unit_price !== '' && it.cartons != null && it.cartons !== '')
  const num = (v) => (v == null || v === '' ? null : Number(v))
  const itemsValue = full ? items.reduce((s, it) => s + num(it.quantity) * num(it.unit_price), 0) : null
  const itemCartons = full ? items.reduce((s, it) => s + num(it.cartons), 0) : null
  const weighed = items.length > 0 && items.every((it) => num(it.unit_weight_kg) != null && num(it.quantity) != null)
  const net = weighed ? items.reduce((s, it) => s + num(it.unit_weight_kg) * num(it.quantity), 0) : null
  const declared = num(b.total_declared_value)
  const cartons = num(b.cartons)
  const gross = num(b.total_gross_weight_kg)
  const kg = (v) => `${Math.round(v * 10) / 10} kg`
  return [
    {
      rule: 'R-02', title: 'Declared value vs products', aLabel: 'Products', a: itemsValue, bLabel: 'Declared', b: declared, fmt: gbp0,
      status: itemsValue != null && declared != null && Math.abs(declared - itemsValue) <= 0.01 * itemsValue ? 'pass' : 'red',
      note: derived.includes('total_declared_value') ? 'worked out from products' : 'within 1% allowed',
    },
    {
      rule: 'R-04', title: 'Booking cartons vs products', aLabel: 'Products', a: itemCartons, bLabel: 'Booking', b: cartons, fmt: (v) => `${v} ctn`,
      status: itemCartons === cartons ? 'pass' : 'red', note: derived.includes('cartons') ? 'worked out from products' : null,
    },
    {
      rule: 'R-07', title: 'Gross weight vs goods', aLabel: 'Goods (net)', a: net, bLabel: 'Gross', b: gross, fmt: kg,
      status: net != null && gross != null && gross >= net ? 'pass' : 'amber',
      note: net != null && gross != null && gross >= net ? `${kg(gross - net)} packaging` : null,
    },
  ]
}

// ---------- carrier trade-off triangle ----------

export function TradeoffRadar({ options, pickKey }) {
  const size = 190
  const c = size / 2
  const R = 66
  const axes = [['Cheap', -90], ['Reliable', 30], ['Fast', 150]]
  const pt = (angle, k) => [c + R * k * Math.cos(angle * Math.PI / 180), c + R * k * Math.sin(angle * Math.PI / 180)]
  const vals = (key) => options.map((o) => key(o))
  const mm = (v, arr, higher) => {
    const lo = Math.min(...arr); const hi = Math.max(...arr)
    const x = hi === lo ? 1 : (v - lo) / (hi - lo)
    return 0.22 + 0.78 * (higher ? x : 1 - x)
  }
  const costs = vals((o) => o.total_cost)
  const days = vals((o) => o.option.transit_days)
  const rates = vals((o) => o.option.on_time_rate)
  const COLORS = ['#94a3b8', '#38bdf8', '#a78bfa']
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0 overflow-visible">
        {[0.33, 0.66, 1].map((k) => (
          <polygon key={k} points={axes.map(([, a]) => pt(a, k).join(',')).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {axes.map(([label, a]) => {
          const [x, y] = pt(a, 1.22)
          const [lx, ly] = pt(a, 1)
          return (
            <g key={label}>
              <line x1={c} y1={c} x2={lx} y2={ly} stroke="#e2e8f0" />
              <text x={x} y={y + 3} textAnchor="middle" className="fill-slate-500" fontSize="10" fontWeight="600">{label}</text>
            </g>
          )
        })}
        {options.map((o, i) => {
          const key = o.option.carrier + o.option.service
          const pick = key === pickKey
          const pts = [
            pt(-90, mm(o.total_cost, costs, false)),
            pt(30, mm(o.option.on_time_rate, rates, true)),
            pt(150, mm(o.option.transit_days, days, false)),
          ]
          const color = pick ? '#14b8a6' : COLORS[i % COLORS.length]
          return (
            <motion.polygon key={key} points={pts.map((p) => p.join(',')).join(' ')}
              fill={color} fillOpacity={pick ? 0.28 : 0.06} stroke={color} strokeWidth={pick ? 2.2 : 1.2} strokeLinejoin="round"
              style={{ transformOrigin: `${c}px ${c}px` }}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: o.excluded_reason ? 0.35 : 1 }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease }} />
          )
        })}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {options.map((o, i) => {
          const key = o.option.carrier + o.option.service
          const pick = key === pickKey
          return (
            <li key={key} className={`flex items-center gap-2 ${o.excluded_reason ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: pick ? '#14b8a6' : COLORS[i % COLORS.length] }} />
              <span className={pick ? 'font-semibold text-ink' : ''}>{o.option.carrier}</span>
              <span className="text-slate-400">{o.option.service.replace('Road ', '')}</span>
            </li>
          )
        })}
        <li className="pt-1 text-[10px] leading-snug text-slate-400">Each corner is scaled across these options — bigger triangle, better all-round.</li>
      </ul>
    </div>
  )
}

// ---------- journey timeline ----------

const toDate = (d) => {
  if (!d) return null
  const [a, b, c] = d.split('-')
  return new Date(a.length === 4 ? `${a}-${b}-${c}T00:00:00` : `${c}-${b}-${a}T00:00:00`)
}
const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

export function Journey({ readyDate, transitDays, origin, destination, country }) {
  const start = toDate(readyDate)
  if (!start || !transitDays) return null
  const eta = new Date(start)
  eta.setDate(eta.getDate() + transitDays)
  const steps = [
    ['Collected', origin, fmt(start)],
    ['UK export', 'customs', fmt(start)],
    [`${country} import`, 'customs', `+${Math.max(1, transitDays - 1)}d`],
    ['Delivered', destination, fmt(eta)],
  ]
  return (
    <div className="relative">
      <div className="relative mx-3 mt-9 h-1 rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-amber-400" initial={{ width: 0 }} animate={{ width: '100%' }}
          transition={{ duration: 1.8, ease }} />
        <motion.div className="absolute -top-8 w-16 -translate-x-1/2" initial={{ left: '0%' }} animate={{ left: '100%' }} transition={{ duration: 1.8, ease }}>
          <Truck className="w-16" moving />
        </motion.div>
        {steps.map((s, i) => (
          <motion.span key={s[0]} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-500 shadow"
            style={{ left: `${(i / (steps.length - 1)) * 100}%` }}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.25 + i * 0.4, type: 'spring', stiffness: 500, damping: 20 }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {steps.map(([t, sub, d]) => (
          <div key={t}>
            <p className="font-mono text-xs font-semibold text-ink">{d}</p>
            <p className="text-[11px] font-medium text-slate-700">{t}</p>
            <p className="text-[10px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Waiting({ text }) {
  return <p className="flex items-center gap-2 text-sm text-slate-400"><StatusIcon status="waiting" /> {text}</p>
}
