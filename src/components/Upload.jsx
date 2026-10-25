import { useRef, useState } from 'react'
import { api } from '../api.js'

export default function Upload({ state, setState }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const input = useRef(null)

  const handle = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const result = await api.upload(file)
      setState({ result: { ...result, filename: file.name }, selected: 0, confirmed: {} })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const { result } = state
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
        onClick={() => input.current?.click()}
        className={`card cursor-pointer border-2 border-dashed p-8 text-center transition ${drag ? 'border-brand bg-brand-light/40' : 'border-slate-300'}`}>
        <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => handle(e.target.files[0])} />
        <p className="font-semibold">{busy ? 'Checking every booking…' : 'Drop your .xlsx here, or click to choose'}</p>
        <p className="text-sm text-slate-500 mt-1">Needs the Bookings (Sheet 1) and Items (Sheet 2) sheets in the case template format.</p>
        <a href="/sample-shipments.xlsx" download onClick={(e) => e.stopPropagation()} className="text-sm text-brand font-medium mt-2 inline-block hover:underline">
          Download a sample with planted mistakes
        </a>
      </div>
      {error && <div className="card p-3 text-sm text-red-700 bg-red-50 border-red-200">{error}</div>}

      {result && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 text-sm flex justify-between">
            <span className="font-semibold">{result.filename}</span>
            <span className="text-slate-500">{result.reports.length} booking(s) · {result.reports.filter((r) => r.blocked).length} on hold</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {result.reports.map((r, i) => (
              <li key={r.reference}>
                <button onClick={() => setState((s) => ({ ...s, selected: i }))}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-slate-50 ${state.selected === i ? 'bg-slate-50' : ''}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${r.red_count ? 'bg-red-500' : r.amber_count ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  <span className="font-semibold w-20">{r.booking.booking_id}</span>
                  <span className="flex-1 truncate text-slate-600">{r.booking.seller_name} · {r.booking.origin_city} → {r.booking.destination_city}</span>
                  {r.red_count > 0 && <span className="chip bg-red-100 text-red-700">{r.red_count} red</span>}
                  {r.amber_count > 0 && <span className="chip bg-amber-100 text-amber-800">{r.amber_count} amber</span>}
                  {!r.red_count && !r.amber_count && <span className="chip bg-emerald-100 text-emerald-700">ready</span>}
                  {state.confirmed[r.reference] && <span className="chip bg-brand-light text-brand-dark">confirmed</span>}
                </button>
              </li>
            ))}
          </ul>
          {result.row_errors.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-red-50 text-sm">
              <p className="font-semibold text-red-800">Rows we couldn't read</p>
              {result.row_errors.map((e) => (
                <p key={e.booking_id} className="text-red-700 mt-1"><b>{e.booking_id}:</b> {e.errors.join('; ')}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
