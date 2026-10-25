import { gbp } from '../api.js'

const FIELDS = [
  ['seller_name', 'Seller'],
  ['origin_city', 'From'],
  ['destination_city', 'To', (v, b) => `${v}, ${b.destination_country}`],
  ['destination_type', 'Site'],
  ['pallets', 'Pallets'],
  ['cartons', 'Cartons'],
  ['total_gross_weight_kg', 'Gross weight', (v) => `${v} kg`],
  ['total_declared_value', 'Declared value', (v) => gbp(v)],
  ['ready_to_ship_date', 'Ready'],
  ['delivery_appointment_booked', 'Appointment', (v) => (v ? 'Booked' : 'Not booked')],
  ['seller_priority', 'Priority'],
]

export default function DraftSummary({ draft, missing }) {
  const b = draft.booking
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Booking so far</h3>
        <span className={`chip ${missing.length ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
          {missing.length ? `${missing.length} detail(s) to go` : 'Complete'}
        </span>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-3 text-sm">
        {FIELDS.map(([k, label, fmt]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className={b[k] == null ? 'text-slate-300' : 'font-medium'}>
              {b[k] == null ? '—' : fmt ? fmt(b[k], b) : String(b[k])}
            </dd>
          </div>
        ))}
      </dl>
      {draft.items.length > 0 && (
        <table className="w-full text-xs mt-3">
          <thead className="text-slate-500 uppercase">
            <tr><th className="text-left py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Per ctn</th><th className="text-right">Ctns</th><th className="text-right">kg/unit</th><th className="text-left pl-2">HS</th><th className="text-left">Origin</th></tr>
          </thead>
          <tbody>
            {draft.items.map((it, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1">{it.description || it.sku}</td>
                {['quantity', 'unit_price', 'units_per_carton', 'cartons', 'unit_weight_kg'].map((f) => (
                  <td key={f} className={`text-right ${it[f] == null ? 'text-slate-300' : ''}`}>{it[f] ?? '—'}</td>
                ))}
                <td className={`pl-2 ${it.hs_code ? '' : 'text-slate-300'}`}>{it.hs_code || '—'}</td>
                <td className={it.country_of_origin ? '' : 'text-slate-300'}>{it.country_of_origin || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
