import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { api, gbp } from '../api.js'

const Globe = lazy(() => import('react-globe.gl'))

const ORIGINS = {
  London: [51.5074, -0.1278], Manchester: [53.4808, -2.2426],
  Birmingham: [52.4862, -1.8904], Leeds: [53.8008, -1.5491],
}
const DESTINATIONS = {
  Berlin: [52.52, 13.405, 'Germany'], Frankfurt: [50.1109, 8.6821, 'Germany'], Hamburg: [53.5511, 9.9937, 'Germany'],
  Paris: [48.8566, 2.3522, 'France'], Lyon: [45.764, 4.8357, 'France'],
  Amsterdam: [52.3676, 4.9041, 'Netherlands'], Rotterdam: [51.9244, 4.4777, 'Netherlands'],
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 600, h: 520 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: Math.max(380, Math.min(560, e.contentRect.width)) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

export default function Landing({ onStart }) {
  const [carriers, setCarriers] = useState([])
  const [origin, setOrigin] = useState('London')
  const [dest, setDest] = useState('Frankfurt')
  const wrap = useRef(null)
  const globeRef = useRef(null)
  const { w, h } = useSize(wrap)

  useEffect(() => { api.carriers().then(setCarriers).catch(() => {}) }, [])

  const country = DESTINATIONS[dest][2]
  const arcs = useMemo(() => Object.entries(ORIGINS).flatMap(([o, [lat, lng]]) =>
    Object.entries(DESTINATIONS).map(([d, [dlat, dlng]]) => ({
      startLat: lat, startLng: lng, endLat: dlat, endLng: dlng,
      active: o === origin && d === dest,
    }))), [origin, dest])
  const points = useMemo(() => [
    ...Object.entries(ORIGINS).map(([name, [lat, lng]]) => ({ name, lat, lng, kind: 'origin' })),
    ...Object.entries(DESTINATIONS).map(([name, [lat, lng]]) => ({ name, lat, lng, kind: 'dest' })),
  ], [])
  const options = carriers.filter((c) => c.destination_country === country)

  const onGlobeReady = () => {
    globeRef.current?.pointOfView({ lat: 50.5, lng: 3, altitude: 0.55 }, 1200)
    const ctl = globeRef.current?.controls()
    if (ctl) { ctl.autoRotate = false; ctl.enableZoom = true }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-5 gap-8 items-start">
      <section className="lg:col-span-2 space-y-6">
        <div>
          <p className="text-sm font-semibold text-brand uppercase tracking-wide">UK → Germany · France · Netherlands</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 leading-tight">Book a pallet shipment in one conversation.</h1>
          <p className="mt-3 text-slate-600">
            Tell us what you're sending in plain English, or upload your booking sheet. We check it against 10 customs
            and warehouse rules <em>before</em> it leaves, tell you exactly what to fix, and pick the carrier that fits your priority.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={onStart}>Start booking →</button>
          <a className="btn-ghost" href="/sample-shipments.xlsx" download>Sample sheet</a>
        </div>

        <div className="card p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-slate-500">From</span>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full rounded-md border-slate-300 border px-2 py-1.5">
                {Object.keys(ORIGINS).map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-500">To</span>
              <select value={dest} onChange={(e) => setDest(e.target.value)} className="w-full rounded-md border-slate-300 border px-2 py-1.5">
                {Object.entries(DESTINATIONS).map(([d, [, , c]]) => <option key={d} value={d}>{d}, {c}</option>)}
              </select>
            </label>
          </div>
          <table className="w-full text-sm mt-4">
            <thead className="text-slate-500 text-xs uppercase">
              <tr><th className="text-left py-1">Service</th><th className="text-right">Per pallet</th><th className="text-right">Days</th><th className="text-right">On time</th><th className="text-right">Max kg</th></tr>
            </thead>
            <tbody>
              {options.map((c) => (
                <tr key={c.label} className="border-t border-slate-100">
                  <td className="py-1.5 font-medium">{c.label}</td>
                  <td className="text-right">{gbp(c.price_per_pallet)}</td>
                  <td className="text-right">{c.transit_days}</td>
                  <td className="text-right">{c.on_time_rate}%</td>
                  <td className="text-right">{c.max_weight_per_pallet_kg}</td>
                </tr>
              ))}
              {!options.length && <tr><td colSpan={5} className="py-2 text-slate-400">Loading rate card…</td></tr>}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2">{origin} → {dest}: transit times shown are door to door.</p>
        </div>
      </section>

      <section ref={wrap} className="lg:col-span-3 rounded-2xl overflow-hidden bg-slate-950 relative" style={{ height: h }}>
        <Suspense fallback={<div className="h-full grid place-items-center text-slate-400 text-sm">Loading globe…</div>}>
          <Globe
            ref={globeRef}
            width={w} height={h}
            onGlobeReady={onGlobeReady}
            globeImageUrl="/earth-dark.jpg"
            backgroundImageUrl="/night-sky.png"
            arcsData={arcs}
            arcColor={(a) => (a.active ? ['#5eead4', '#f59e0b'] : 'rgba(148,163,184,0.18)')}
            arcStroke={(a) => (a.active ? 0.9 : 0.25)}
            arcDashLength={(a) => (a.active ? 0.4 : 1)}
            arcDashGap={(a) => (a.active ? 0.15 : 0)}
            arcDashAnimateTime={(a) => (a.active ? 1600 : 0)}
            arcAltitude={0.06}
            pointsData={points}
            pointColor={(p) => (p.kind === 'origin' ? '#5eead4' : '#f59e0b')}
            pointAltitude={0.005}
            pointRadius={0.12}
            labelsData={points}
            labelText="name"
            labelSize={0.35}
            labelDotRadius={0}
            labelColor={() => 'rgba(226,232,240,0.85)'}
            labelAltitude={0.01}
          />
        </Suspense>
        <div className="absolute bottom-3 left-3 text-xs text-slate-300 bg-slate-900/70 rounded-md px-2 py-1">
          <span className="text-teal-300">●</span> Collection city &nbsp; <span className="text-amber-400">●</span> Delivery city · drag to rotate
        </div>
      </section>
    </div>
  )
}
