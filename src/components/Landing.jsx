import { useEffect, useState } from 'react'
import { api, gbp } from '../api.js'
import RouteMap, { DESTINATIONS, ORIGINS } from './RouteMap.jsx'

const STEPS = [
  ['Describe or upload', 'Chat in plain English or drop in your Bookings + Items sheet.'],
  ['Pre-flight check', '10 customs and warehouse rules, with a fix for anything wrong.'],
  ['Carrier & confirm', 'The best option for your priority, and what happens next.'],
]

export default function Landing({ onStart }) {
  const [carriers, setCarriers] = useState([])
  const [origin, setOrigin] = useState('London')
  const [dest, setDest] = useState('Frankfurt')

  useEffect(() => { api.carriers().then(setCarriers).catch(() => {}) }, [])

  const country = DESTINATIONS[dest][2]
  const options = carriers.filter((c) => c.destination_country === country)
  const best = (key, dir) => options.length && options.reduce((a, b) => (dir * (b[key] - a[key]) > 0 ? b : a))
  const tags = (c) => [
    c === best('price_per_pallet', -1) && 'Cheapest',
    c === best('transit_days', -1) && 'Fastest',
    c === best('on_time_rate', 1) && 'Most reliable',
  ].filter(Boolean)

  return (
    <div className="bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-12 grid lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-5 space-y-6">
          <div>
            <span className="chip bg-brand-light text-brand-dark">UK → Germany · France · Netherlands</span>
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight mt-4 leading-[1.1]">
              Book your pallets.<br /><span className="text-brand">Catch the mistakes</span> before they ship.
            </h1>
            <p className="mt-4 text-slate-600">
              Tell us what you're sending, or upload your booking sheet. We check it before collection, so nothing gets stuck at customs or the warehouse.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <button className="btn-primary px-5 py-2.5 text-base" onClick={onStart}>Start a booking</button>
              <a className="btn-ghost px-5 py-2.5 text-base" href="/sample-shipments.xlsx" download>Sample sheet</a>
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <CityPicker label="Collect from" value={origin} onChange={setOrigin}
                options={Object.keys(ORIGINS).map((o) => [o, o])} dot="bg-brand" />
              <CityPicker label="Deliver to" value={dest} onChange={setDest}
                options={Object.entries(DESTINATIONS).map(([d, [, , c]]) => [d, `${d}, ${c}`])} dot="bg-amber-500" />
            </div>
            <div className="space-y-2">
              {options.map((c) => (
                <div key={c.label} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{c.carrier} <span className="font-normal text-slate-500">· {c.service}</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {c.transit_days} days · {c.on_time_rate}% on time · max {c.max_weight_per_pallet_kg} kg/pallet
                    </p>
                    {tags(c).length > 0 && (
                      <div className="flex gap-1 mt-1.5">{tags(c).map((t) => <span key={t} className="chip bg-slate-100 text-slate-600">{t}</span>)}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{gbp(c.price_per_pallet)}</p>
                    <p className="text-[11px] text-slate-500">per pallet</p>
                  </div>
                </div>
              ))}
              {!options.length && <p className="text-sm text-slate-400">Loading rates…</p>}
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 card overflow-hidden">
          <RouteMap origin={origin} dest={dest} onOrigin={setOrigin} onDest={setDest} />
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
            <p className="text-sm">
              <span className="font-semibold">{origin} → {dest}</span>
              <span className="text-slate-500"> · tap a city to change the route</span>
            </p>
            <button className="btn-primary" onClick={onStart}>Book this route</button>
          </div>
        </section>

        <ol className="lg:col-span-12 grid sm:grid-cols-3 gap-4 pt-2">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="w-7 h-7 shrink-0 rounded-full bg-ink text-white grid place-items-center text-sm font-semibold">{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-slate-500">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function CityPicker({ label, value, onChange, options, dot }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
        <span className={`w-2 h-2 rounded-full ${dot}`} />{label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand/40">
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  )
}
