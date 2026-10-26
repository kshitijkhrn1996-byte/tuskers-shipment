import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView } from 'framer-motion'
import { gbp0 as gbp, useCarriers } from '../api.js'
import RouteMap, { DESTINATIONS, ORIGINS } from './RouteMap.jsx'
import { RuleIcon, Truck } from './art.jsx'
import { Arrow, StatusIcon, TrafficLight, ease } from './ui.jsx'

const rise = (i = 0) => ({ initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.55, delay: i * 0.08, ease } })

export default function Landing({ go }) {
  const [checked, setChecked] = useState(null)
  useEffect(() => { fetch('/api/stats').then((r) => r.json()).then((d) => setChecked(d.consignments_checked)).catch(() => {}) }, [])

  return (
    <div className="overflow-x-clip">
      {/* ---------- hero ---------- */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[46rem] w-[46rem] opacity-70 md:-right-24">
          <div className="ribbon absolute inset-[18%] rounded-[45%]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-10 lg:grid-cols-12 lg:pt-14">
          <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <button onClick={() => go('book')} className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur transition-shadow hover:shadow-lift">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {checked != null ? <>Consignments checked on Tuskers: <span className="font-mono text-ink">{checked}</span></> : 'Pre-flight checks for UK → EU road freight'}
              <Arrow className="text-teal-600" />
            </button>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl xl:text-6xl">
              Pre-flight checks for UK → EU freight.{' '}
              <span className="text-slate-400">Catch the customs and warehouse mistakes <span className="text-gradient">before your consignment leaves</span>, then book the right carrier.</span>
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="btn-primary group px-5 py-2.5 text-base" onClick={() => go('book')}>Check a consignment <Arrow /></button>
            </div>
            <p className="mt-5 text-sm text-slate-500">Chat, form or spreadsheet · Germany, France and the Netherlands · no login</p>
          </motion.div>
          <div className="lg:col-span-5"><HeroPreview /></div>
        </div>
      </section>

      {/* ---------- routes & rates ---------- */}
      <RatesExplorer go={go} />

      {/* ---------- bento ---------- */}
      <section className="mx-auto max-w-7xl px-4 pt-20">
        <motion.div {...rise()} className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Everything a consignment needs. <span className="text-slate-400">Checked as you go, booked in one flow.</span>
          </h2>
        </motion.div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Bento i={0} span="md:col-span-2" title="Describe it however you like" cta="Start booking" onClick={() => go('book')}
            text="Chat in plain English, fill in the form, or switch between the two — you only get asked for what’s missing."><ChatMock /></Bento>
          <Bento i={1} title="Ten checks, live" cta="See the checks" onClick={() => go('checks')}
            text="Each rule runs the moment its data arrives, in red or amber, with the fix."><ChecksMock /></Bento>
          <Bento i={2} title="The right carrier, explained" cta="Compare carriers" onClick={() => go('carriers')}
            text="A, B or C for your priority — and why the others lost."><CarrierMock /></Bento>
          <Bento i={3} title="Invoice, filled in for you" cta="Create an invoice" onClick={() => go('book')}
            text="Products, HS codes, origin, weights and route go straight onto the commercial invoice."><InvoiceMock /></Bento>
          <Bento i={4} title="Or upload the whole sheet" cta="Upload a sheet" onClick={() => go('book')}
            text="Bookings + Items, in the case template. Every row checked at once."><SheetMock /></Bento>
        </div>
      </section>

      {/* ---------- numbers band ---------- */}
      <section className="relative mt-20 overflow-hidden bg-gradient-to-br from-[#042f2e] via-[#0b2b29] to-[#0f172a] text-white">
        <div aria-hidden className="grain absolute inset-0" />
        <div aria-hidden className="ribbon absolute -bottom-40 -right-20 h-96 w-[40rem] rounded-[45%] opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 py-16">
          <dl className="grid grid-cols-2 gap-8 sm:grid-cols-5">
            {[[10, 'pre-flight checks on every consignment'], [4, 'UK collection cities'], [7, 'EU delivery cities'], [3, 'delivery countries'], [9, 'carrier services to choose from']].map(([n, label], i) => (
              <motion.div key={label} {...rise(i)} className="border-l border-white/15 pl-4">
                <dt className="text-4xl font-semibold tracking-tight"><CountUp to={n} /></dt>
                <dd className="mt-1 text-sm text-white/60">{label}</dd>
              </motion.div>
            ))}
          </dl>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8">
            <p className="max-w-xl text-lg text-white/80">Mistakes caught at booking cost nothing. At customs, they cost days.</p>
            <div className="flex gap-3">
              <button className="btn group bg-white px-5 py-2.5 text-ink hover:-translate-y-px hover:shadow-lift" onClick={() => go('book')}>Check a consignment <Arrow /></button>
              <a className="btn group border border-white/20 px-5 py-2.5 text-white hover:bg-white/10" href="/sample-shipments.xlsx" download>Sample sheet <Arrow /></a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ---------- hero product preview ---------- */

function HeroPreview() {
  const [step, setStep] = useState(0)
  useEffect(() => { const t = setInterval(() => setStep((s) => (s + 1) % 3), 2600); return () => clearInterval(t) }, [])
  const fixed = step === 2
  return (
    <div className="relative mx-auto h-[23rem] w-full max-w-md">
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="glass absolute left-0 top-0 w-[85%] p-4 shadow-float">
        <div className="flex items-center gap-3">
          <TrafficLight state={fixed ? 'green' : 'red'} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pre-flight · <span className="font-mono">BK-002</span></p>
            <motion.p key={fixed ? 'ok' : 'hold'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className={`text-lg font-semibold ${fixed ? 'text-emerald-600' : 'text-red-600'}`}>{fixed ? 'Cleared to ship' : 'On hold'}</motion.p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs">
          {[['R-01', 'HS code 6+ digits', 'pass'], ['R-02', 'Declared value matches items', fixed ? 'pass' : 'red'], ['R-05', 'Pallet within carrier limit', 'pass']].map(([id, t, st]) => (
            <li key={id} className="flex items-center gap-2"><StatusIcon status={st} /><span className="font-mono text-slate-400">{id}</span><span className="text-slate-700">{t}</span></li>
          ))}
        </ul>
        {!fixed && (
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="pulse-red mt-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs">
            <p className="font-semibold text-red-700">Declared <span className="font-mono">£4,000</span> ≠ items <span className="font-mono">£4,800</span></p>
            <p className="text-slate-600">Fix · use <span className="font-mono">£4,800</span></p>
          </motion.div>
        )}
      </motion.div>
      <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        className="glass absolute bottom-6 right-0 w-[68%] p-4 shadow-float">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recommended · Balanced</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="font-semibold">Carrier B <span className="text-slate-400">· Road standard</span></p>
          <p className="font-mono font-semibold">£420</p>
        </div>
        <div className="mt-3 space-y-1.5">
          {[['A', 40], ['B', 65], ['C', 60]].map(([c, v]) => (
            <div key={c} className="flex items-center gap-2 text-[11px]">
              <span className="w-3 font-mono text-slate-500">{c}</span>
              <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                <motion.div className={`h-full rounded-full ${c === 'B' ? 'bg-teal-500' : 'bg-slate-300'}`} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 1, ease }} />
              </div>
              <span className="w-8 text-right font-mono text-slate-500">0.{v}</span>
            </div>
          ))}
        </div>
      </motion.div>
      <div className="absolute -bottom-2 left-6 w-40 opacity-90"><Truck className="w-full" moving /></div>
    </div>
  )
}

/* ---------- bento ---------- */

function Bento({ i, span = '', title, text, cta, onClick, children }) {
  return (
    <motion.button {...rise(i)} onClick={onClick} whileHover={{ y: -4 }}
      className={`glass group flex flex-col overflow-hidden text-left transition-shadow duration-300 hover:shadow-float ${span}`}>
      <div className="relative h-48 overflow-hidden border-b border-slate-200/70 bg-gradient-to-br from-teal-50/70 via-white/40 to-amber-50/50">{children}</div>
      <div className="flex flex-1 flex-col p-5">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 flex-1 text-sm text-slate-600">{text}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">{cta} <Arrow /></span>
      </div>
    </motion.button>
  )
}

function useLoop(n, ms) {
  const [k, setK] = useState(0)
  useEffect(() => { const t = setInterval(() => setK((x) => (x + 1) % n), ms); return () => clearInterval(t) }, [n, ms])
  return k
}

function ChatMock() {
  const k = useLoop(5, 1400)
  const msgs = [
    ['me', '1080 mugs, Manchester → Frankfurt warehouse, 3 pallets'],
    ['bot', 'Got it. Price per unit and HS code?'],
    ['me', '£5 each, HS 691200, made in the UK'],
    ['bot', 'Cleared to ship · Carrier B · £660'],
  ]
  return (
    <div className="absolute inset-0 flex flex-col justify-end gap-2 p-5">
      {msgs.slice(0, Math.max(1, k)).map(([who, t], i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}
          className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-xs ${who === 'me' ? 'ml-auto rounded-br-md bg-slate-900 text-white' : 'rounded-tl-md border border-slate-200 bg-white text-slate-700'}`}>
          {t}
        </motion.div>
      ))}
    </div>
  )
}

function ChecksMock() {
  const k = useLoop(6, 700)
  const rows = ['R-01', 'R-02', 'R-03', 'R-05', 'R-06']
  return (
    <div className="absolute inset-0 space-y-1.5 p-5">
      {rows.map((id, i) => (
        <div key={id} className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs shadow-sm">
          <StatusIcon status={i < k ? (id === 'R-06' ? 'red' : 'pass') : 'waiting'} />
          <RuleIcon id={id} className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-mono text-slate-500">{id}</span>
        </div>
      ))}
    </div>
  )
}

function CarrierMock() {
  const k = useLoop(3, 1800)
  return (
    <div className="absolute inset-0 grid grid-cols-3 gap-2 p-5 pt-8">
      {['A', 'B', 'C'].map((c, i) => (
        <div key={c} className="relative rounded-xl border border-slate-200 bg-white/90 p-2 text-center">
          {i === k && <motion.span layoutId="mock-pick" className="absolute inset-0 rounded-xl ring-2 ring-teal-500" transition={{ type: 'spring', stiffness: 300, damping: 26 }} />}
          <p className="text-xs font-semibold">Carrier {c}</p>
          <p className="mt-1 font-mono text-sm font-semibold">£{[540, 660, 1020][i]}</p>
          <p className="font-mono text-[10px] text-slate-500">{[5, 3, 2][i]}d · {[92, 95, 98][i]}%</p>
        </div>
      ))}
      <p className="col-span-3 text-center text-[11px] text-slate-500">{['Cheapest', 'Balanced', 'Fastest'][k]} → Carrier {['A', 'B', 'C'][k]}</p>
    </div>
  )
}

function InvoiceMock() {
  return (
    <div className="absolute inset-x-6 top-5 rounded-lg border border-slate-200 bg-white p-3 shadow-lift">
      <div className="flex justify-between"><p className="text-[10px] font-bold tracking-wide">COMMERCIAL INVOICE</p><p className="font-mono text-[9px] text-slate-400">INV-BK-001</p></div>
      {[['Ceramic mug', '691200', '£5,400'], ['Wool scarf', '611710', '£1,200']].map(([d, hs, v], i) => (
        <motion.div key={d} {...rise(i)} className="mt-2 flex justify-between border-t border-slate-100 pt-1.5 text-[10px]">
          <span>{d}</span><span className="font-mono text-slate-500">{hs}</span><span className="font-mono">{v}</span>
        </motion.div>
      ))}
      <div className="mt-2 flex justify-between border-t border-slate-300 pt-1.5 text-[10px] font-bold"><span>Total</span><span className="font-mono">£6,600</span></div>
    </div>
  )
}

function SheetMock() {
  const k = useLoop(6, 650)
  const rows = [['BK-001', 'clear'], ['BK-002', 'red'], ['BK-003', 'amber'], ['BK-004', 'red'], ['BK-005', 'clear']]
  const dot = { clear: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-400' }
  return (
    <div className="absolute inset-0 p-5">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-[11px]">
        {rows.map(([id, st], i) => (
          <div key={id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 last:border-0">
            <span className={`h-2 w-2 rounded-full transition-colors duration-300 ${i < k ? dot[st] : 'bg-slate-200'}`} />
            <span className="font-mono">{id}</span>
            <span className="ml-auto text-slate-400">{i < k ? (st === 'clear' ? 'clear' : st === 'red' ? 'on hold' : 'warning') : 'checking…'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- routes & rates ---------- */

function RatesExplorer({ go }) {
  const { carriers } = useCarriers()
  const [origin, setOrigin] = useState('London')
  const [dest, setDest] = useState('Frankfurt')
  const country = DESTINATIONS[dest][2]
  const options = carriers.filter((c) => c.destination_country === country)
  const best = (key, dir) => options.length && options.reduce((a, b) => (dir * (b[key] - a[key]) > 0 ? b : a))
  const tags = (c) => [c === best('price_per_pallet', -1) && 'Cheapest', c === best('transit_days', -1) && 'Fastest', c === best('on_time_rate', 1) && 'Most reliable'].filter(Boolean)

  return (
    <section className="mx-auto max-w-7xl px-4 pt-4">
      <motion.h2 {...rise()} className="max-w-3xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
        Pick a route. <span className="text-slate-400">See every service, price and limit before you book.</span>
      </motion.h2>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-12">
        <motion.div {...rise(1)} className="glass space-y-4 p-4 lg:col-span-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <CityPicker label="Collect from" value={origin} onChange={setOrigin} options={Object.keys(ORIGINS).map((o) => [o, o])} dot="bg-brand" />
            <CityPicker label="Deliver to" value={dest} onChange={setDest} options={Object.entries(DESTINATIONS).map(([d, [, , c]]) => [d, `${d}, ${c}`])} dot="bg-amber-500" />
          </div>
          {options.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.3, ease }}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 transition-shadow duration-200 hover:shadow-lift">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.carrier} <span className="font-normal text-slate-500">· {c.service}</span></p>
                <p className="mt-0.5 text-xs text-slate-500"><span className="font-mono">{c.transit_days}</span> days · <span className="font-mono">{c.on_time_rate}%</span> on time · max <span className="font-mono">{c.max_weight_per_pallet_kg}</span> kg/pallet</p>
                {tags(c).length > 0 && <div className="mt-1.5 flex gap-1">{tags(c).map((t) => <span key={t} className="chip bg-slate-100 text-slate-600">{t}</span>)}</div>}
              </div>
              <div className="shrink-0 text-right"><p className="font-mono font-bold">{gbp(c.price_per_pallet)}</p><p className="text-[11px] text-slate-500">per pallet</p></div>
            </motion.div>
          ))}
          <div className="flex justify-end pt-1">
            <button onClick={() => go('carriers')} className="group inline-flex items-center gap-1 text-sm font-semibold text-teal-700">Compare for your load <Arrow /></button>
          </div>
        </motion.div>
        <motion.div {...rise(2)} className="glass overflow-hidden lg:col-span-7">
          <RouteMap origin={origin} dest={dest} onOrigin={setOrigin} onDest={setDest} />
          <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-4 py-3">
            <p className="text-sm"><span className="font-semibold">{origin} → {dest}</span><span className="text-slate-500"> · tap a city to change the route</span></p>
            <button className="btn-primary group" onClick={() => go('book')}>Book this route <Arrow /></button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function CountUp({ to }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, { duration: 1.1, ease, onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [inView, to])
  return <span ref={ref} className="font-mono">{n}</span>
}

function CityPicker({ label, value, onChange, options, dot }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field field-ok mt-0 font-medium">
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  )
}
