import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ease } from './ui.jsx'
import { hsBus } from '../api.js'

const ORIGINS = ['London', 'Manchester', 'Birmingham', 'Leeds']
const DESTS = { Germany: ['Berlin', 'Frankfurt', 'Hamburg'], France: ['Paris', 'Lyon'], Netherlands: ['Amsterdam', 'Rotterdam'] }
const PRIORITIES = ['Cheapest', 'Fastest', 'Most reliable', 'Balanced']
const ITEM_ORIGINS = ['United Kingdom', 'China', 'India', 'Vietnam', 'Turkey', 'Germany']
const EMPTY_ITEM = { sku: '', description: '', hs_code: '', quantity: '', unit_price: '', units_per_carton: '', cartons: '', unit_weight_kg: '', country_of_origin: '' }

const toIso = (d) => (d && /^\d{2}-\d{2}-\d{4}$/.test(d) ? d.split('-').reverse().join('-') : '')
const fromIso = (d) => (d ? d.split('-').reverse().join('-') : '')
const clone = (x) => JSON.parse(JSON.stringify(x))

// Flags for one field: live issues + rejected input, worst first.
function flagsFor(path, issues, inputErrors) {
  const list = [
    ...inputErrors.filter((e) => e.field === path).map((e) => ({ severity: 'Red', message: e.message })),
    ...issues.filter((i) => i.field === path),
  ]
  return list
}

const ring = (flags) => (flags.some((f) => f.severity === 'Red') ? 'field-red'
  : flags.some((f) => f.severity === 'Amber') ? 'field-amber' : 'field-ok')

function Field({ label, path, issues, inputErrors, hint, children, className = '' }) {
  const flags = flagsFor(path, issues, inputErrors).filter((f) => f.severity !== 'Info')
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children(ring(flags))}
      <AnimatePresence initial={false}>
        {flags.map((f) => (
          <motion.span key={f.message} initial={{ opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease }}
            className={`block overflow-hidden pt-1 text-xs ${f.severity === 'Red' ? 'text-red-600' : 'text-amber-700'}`}>
            {f.severity === 'Red' ? '✗ ' : '! '}{f.message}
          </motion.span>
        ))}
      </AnimatePresence>
      {!flags.length && hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  )
}

const inputCls = 'field'

export default function BookingForm({ session, onSave, compact = false }) {
  const [form, setForm] = useState(() => clone(session.draft))
  const timer = useRef(null)
  const editing = useRef(0)

  // Adopt server changes (e.g. from the chat) unless the user is mid-edit.
  useEffect(() => {
    if (Date.now() - editing.current > 1500) setForm(clone(session.draft))
  }, [session.draft])

  const commit = (next) => {
    editing.current = Date.now()
    setForm(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave(next), 600)
  }
  const setB = (k, v) => {
    const next = clone(form)
    next.booking[k] = v
    if (k === 'destination_city') next.booking.destination_country = Object.keys(DESTS).find((c) => DESTS[c].includes(v)) || null
    commit(next)
  }
  const setItem = (i, k, v) => { const next = clone(form); next.items[i][k] = v; commit(next) }
  const addItem = () => { const next = clone(form); next.items.push({ ...EMPTY_ITEM }); commit(next) }
  const removeItem = (i) => {
    const next = clone(form)
    next.items.splice(i, 1)
    // keep "don't know" marks pointing at the right product after removal
    next.unknown = (next.unknown || []).flatMap((k) => {
      const [, idx, f] = k.split('.')
      return +idx === i ? [] : [`items.${+idx > i ? +idx - 1 : idx}.${f}`]
    })
    commit(next)
  }
  const isUnknown = (i, f) => (form.unknown || []).includes(`items.${i}.${f}`)
  const setUnknown = (i, f, on) => {
    const next = clone(form)
    const key = `items.${i}.${f}`
    next.unknown = (next.unknown || []).filter((k) => k !== key)
    if (on) { next.unknown.push(key); next.items[i][f] = '' }
    commit(next)
  }

  const b = form.booking
  const derived = form.derived || []
  const props = { issues: session.issues || [], inputErrors: session.inputErrors || [] }
  const val = (v) => (v ?? '')

  const sel = (k, opts, placeholder) => (cls) => (
    <select value={val(b[k])} onChange={(e) => setB(k, e.target.value || null)} className={`${inputCls} ${cls}`}>
      <option value="">{placeholder}</option>
      {opts.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
    </select>
  )
  const num = (k, placeholder) => (cls) => (
    <input inputMode="decimal" value={val(b[k])} placeholder={placeholder} onChange={(e) => setB(k, e.target.value)} className={`${inputCls} ${cls} font-mono`} />
  )

  const grid = compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'

  return (
    <div className="space-y-5">
      <section>
        <h4 className="label mb-2">Shipment</h4>
        <div className={`grid ${grid} gap-3`}>
          <Field label="Seller name" path="seller_name" {...props} className="col-span-2 md:col-span-1">
            {(cls) => <input value={val(b.seller_name)} onChange={(e) => setB('seller_name', e.target.value)} className={`${inputCls} ${cls}`} placeholder="Your business" />}
          </Field>
          <Field label="Collect from" path="origin_city" {...props}>{sel('origin_city', ORIGINS, 'Choose city')}</Field>
          <Field label="Deliver to" path="destination_city" {...props}>
            {sel('destination_city', Object.entries(DESTS).flatMap(([c, cities]) => cities.map((x) => [x, `${x}, ${c}`])), 'Choose city')}
          </Field>
          <Field label="Delivery site" path="destination_type" {...props}>{sel('destination_type', ['Warehouse', 'Business address'], 'Choose')}</Field>
          <Field label="Delivery appointment" path="delivery_appointment_booked" {...props}>
            {(cls) => (
              <select value={b.delivery_appointment_booked == null ? '' : b.delivery_appointment_booked ? 'yes' : 'no'}
                onChange={(e) => setB('delivery_appointment_booked', e.target.value === '' ? null : e.target.value === 'yes')}
                className={`${inputCls} ${cls}`}>
                <option value="">Choose</option><option value="yes">Booked</option><option value="no">Not booked</option>
              </select>
            )}
          </Field>
          <Field label="Ready to ship" path="ready_to_ship_date" {...props}>
            {(cls) => <input type="date" value={toIso(b.ready_to_ship_date)} onChange={(e) => setB('ready_to_ship_date', fromIso(e.target.value) || null)} className={`${inputCls} ${cls}`} />}
          </Field>
          <Field label="Priority" path="seller_priority" {...props}>{sel('seller_priority', PRIORITIES, 'Choose')}</Field>
          <Field label="Pallets" path="pallets" {...props}>{num('pallets', 'e.g. 3')}</Field>
          <Field label="Gross weight (kg)" path="total_gross_weight_kg" {...props} hint="Goods + cartons + pallets">{num('total_gross_weight_kg', 'e.g. 620')}</Field>
          <Field label="Total cartons" path="cartons" {...props} hint={derived.includes('cartons') ? 'Worked out from products' : null}>
            {num('cartons', 'from products')}
          </Field>
          <Field label="Declared value (£)" path="total_declared_value" {...props} hint={derived.includes('total_declared_value') ? 'Worked out from products' : null}>
            {num('total_declared_value', 'from products')}
          </Field>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="label">Products</h4>
          <button type="button" onClick={addItem} className="btn-ghost px-2.5 py-1 text-xs">+ Add product</button>
        </div>
        {form.items.length === 0 && (
          <button type="button" onClick={addItem} className="w-full rounded-xl border border-dashed border-slate-300 bg-white/40 py-5 text-sm text-slate-500 transition-all duration-200 hover:border-teal-400 hover:bg-white hover:text-teal-700">
            Add your first product
          </button>
        )}
        <div className="space-y-3">
          {form.items.map((it, i) => (
            <motion.div key={i} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="rounded-xl border border-slate-200/80 bg-white/60 p-3.5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-600">Product {i + 1}</span>
                <button type="button" onClick={() => removeItem(i)} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
              </div>
              <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-3`}>
                <Field label="Description" path={`items.${i}.description`} {...props} className="col-span-2">
                  {(cls) => <input value={val(it.description)} onChange={(e) => setItem(i, 'description', e.target.value)} className={`${inputCls} ${cls}`} placeholder="Ceramic coffee mug" />}
                </Field>
                <Field label={<>HS code <button type="button" onClick={(e) => { e.preventDefault(); hsBus.open({ query: it.description || '', item: i }) }}
                  className="ml-1 font-semibold text-teal-700 hover:text-teal-900">Find</button></>} path={`items.${i}.hs_code`} {...props}>
                  {(cls) => (
                    <>
                      <input value={val(it.hs_code)} placeholder={isUnknown(i, 'hs_code') ? "Don't know" : '6+ digits'} disabled={isUnknown(i, 'hs_code')}
                        onChange={(e) => setItem(i, 'hs_code', e.target.value)} className={`${inputCls} ${cls} font-mono disabled:bg-slate-100`} />
                      <span className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                        <input type="checkbox" checked={isUnknown(i, 'hs_code')} onChange={(e) => setUnknown(i, 'hs_code', e.target.checked)} /> I don't have it
                      </span>
                    </>
                  )}
                </Field>
                {[['sku', 'SKU', 'MUG-01'], ['quantity', 'Quantity', 'units'], ['unit_price', 'Unit price (£)', '5.00'],
                  ['units_per_carton', 'Units / carton', '12'], ['cartons', 'Cartons', ''], ['unit_weight_kg', 'Unit weight (kg)', '0.5']].map(([k, label, ph]) => (
                  <Field key={k} label={label} path={`items.${i}.${k}`} {...props}>
                    {(cls) => <input value={val(it[k])} placeholder={ph} onChange={(e) => setItem(i, k, e.target.value)} className={`${inputCls} ${cls} font-mono`} />}
                  </Field>
                ))}
                <Field label="Made in" path={`items.${i}.country_of_origin`} {...props}>
                  {(cls) => (
                    <select value={isUnknown(i, 'country_of_origin') ? '__unknown' : val(it.country_of_origin)}
                      onChange={(e) => {
                        const v = e.target.value
                        const next = clone(form)
                        const key = `items.${i}.country_of_origin`
                        next.unknown = (next.unknown || []).filter((k) => k !== key)
                        if (v === '__unknown') next.unknown.push(key)
                        next.items[i].country_of_origin = v === '__unknown' ? '' : v
                        commit(next)
                      }}
                      className={`${inputCls} ${cls}`}>
                      <option value="">Choose</option>
                      <option value="__unknown">Don't know</option>
                      {ITEM_ORIGINS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  )}
                </Field>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  )
}
