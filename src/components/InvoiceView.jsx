import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ease } from './ui.jsx'
import { api, gbp } from '../api.js'
import Logo from './Logo.jsx'

export default function InvoiceView({ conversationId, version, onClose, onEdit }) {
  const [inv, setInv] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.invoice(conversationId).then(setInv).catch((e) => setError(e.message))
  }, [conversationId, version])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }}
      className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/30 backdrop-blur-sm print:static print:bg-white" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.4, ease }}
        className="mx-auto my-8 max-w-4xl px-4 print:m-0 print:max-w-none print:p-0" onClick={(e) => e.stopPropagation()}>
        <div className="glass mb-3 flex items-center justify-between px-4 py-2.5 print:hidden">
          <p className="font-semibold">Commercial invoice</p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onEdit}>Edit details</button>
            <button className="btn-primary" onClick={() => window.print()} disabled={!inv}>Print / save PDF</button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
        {error && <div className="card p-4 text-red-700">{error}</div>}
        {!inv && !error && <div className="card p-8 text-center text-slate-500">Preparing invoice…</div>}
        {inv && <div className="print-area"><InvoiceSheet inv={inv} /></div>}
      </motion.div>
    </motion.div>
  )
}

function Party({ title, p, extra }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="font-semibold">{p.name || <Missing />}</p>
      <p className="whitespace-pre-line text-slate-700">{p.address || <Missing />}</p>
      {p.contact && <p className="text-slate-600">{p.contact}</p>}
      {extra}
    </div>
  )
}

const Missing = ({ label = 'missing' }) => <span className="inline-block rounded bg-red-100 text-red-700 px-1.5 text-xs font-semibold">{label}</span>

function InvoiceSheet({ inv }) {
  const reds = inv.missing.filter((m) => m.severity === 'Red')
  return (
    <div className="rounded-2xl bg-white shadow-float ring-1 ring-slate-200/70 print:rounded-none print:shadow-none print:ring-0">
      {(reds.length > 0 || inv.problems.length > 0) && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800 rounded-t-xl print:hidden">
          {reds.length > 0 && <p><b>Missing before you can use this invoice:</b> {reds.map((m) => m.label).join(', ')}.</p>}
          {inv.problems.map((p) => <p key={p}>✗ {p}</p>)}
          {inv.missing.filter((m) => m.severity === 'Amber').map((m) => <p key={m.field} className="text-amber-800">! {m.label}: {m.note}</p>)}
        </div>
      )}
      <div className="p-8 text-sm relative">
        {inv.is_draft && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none select-none">
            <span className="text-7xl font-black text-red-500/10 -rotate-12">DRAFT</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">COMMERCIAL INVOICE</h2>
            <p className="text-slate-500">Export invoice · {inv.reason_for_export}</p>
          </div>
          <div className="text-right">
            <Logo className="h-9 ml-auto" />
            <dl className="mt-2 text-xs grid grid-cols-[auto_auto] gap-x-3 justify-end">
              <dt className="text-slate-500">Invoice no.</dt><dd className="font-mono font-semibold">{inv.invoice_number}</dd>
              <dt className="text-slate-500">Date</dt><dd>{inv.invoice_date}</dd>
              <dt className="text-slate-500">Currency</dt><dd>{inv.currency}</dd>
              {inv.related_docs && <><dt className="text-slate-500">PO / contract</dt><dd>{inv.related_docs}</dd></>}
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-6 border-t border-slate-200 pt-4">
          <Party title="Seller / exporter" p={inv.seller}
            extra={<p className="text-slate-600">EORI: {inv.seller.eori || <Missing label="add EORI" />}</p>} />
          <Party title="Buyer" p={inv.buyer} />
          <Party title="Consignee" p={inv.consignee}
            extra={inv.consignee.same_as_buyer && inv.consignee.name ? <p className="text-xs text-slate-500">Same as buyer</p> : null} />
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 text-xs bg-slate-50 rounded-lg p-3">
          <div><p className="text-slate-500">Incoterms</p><p className="font-semibold">{inv.incoterms || <Missing />}</p></div>
          <div><p className="text-slate-500">Payment terms</p><p className="font-semibold">{inv.payment_terms || <Missing />}</p></div>
          <div className="col-span-2"><p className="text-slate-500">Transport</p><p className="font-semibold">{inv.transport}</p><p className="text-slate-500">Collection {inv.ship_date}</p></div>
        </div>

        <table className="w-full mt-5 text-xs [&_td.text-right]:font-mono">
          <thead className="text-slate-500 uppercase border-b border-slate-300">
            <tr>
              <th className="text-left py-2">Description</th><th className="text-left">HS code</th><th className="text-left">Origin</th>
              <th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Net kg</th><th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.sku} className="border-b border-slate-100 align-top">
                <td className="py-2"><p className="font-medium">{l.description}</p><p className="text-slate-500"><span className="font-mono">{l.sku}</span> · {l.cartons} cartons</p></td>
                <td className="font-mono">{l.hs_code || <Missing />}</td>
                <td>{l.country_of_origin || <Missing />}</td>
                <td className="text-right">{l.quantity.toLocaleString('en-GB')}</td>
                <td className="text-right">{gbp(l.unit_price)}</td>
                <td className="text-right">{l.net_weight_kg.toLocaleString('en-GB')}</td>
                <td className="text-right font-medium">{gbp(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-6 mt-4">
          <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 content-start">
            <dt className="text-slate-500">Packages</dt><dd>{inv.packages}</dd>
            <dt className="text-slate-500">Marks & numbers</dt><dd className="font-mono">{inv.marks}</dd>
            <dt className="text-slate-500">Net weight</dt><dd>{inv.net_weight_kg.toLocaleString('en-GB')} kg</dd>
            <dt className="text-slate-500">Gross weight</dt><dd>{inv.gross_weight_kg.toLocaleString('en-GB')} kg</dd>
          </dl>
          <dl className="text-sm grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt className="text-slate-500">Goods total</dt><dd className="text-right">{gbp(inv.goods_total)}</dd>
            {inv.freight != null && (
              <>
                <dt className="text-slate-500">Freight {inv.freight_on_invoice ? '' : '(paid by buyer, not invoiced)'}</dt>
                <dd className="text-right">{inv.freight_on_invoice ? gbp(inv.freight) : '—'}</dd>
              </>
            )}
            <dt className="font-semibold border-t border-slate-300 pt-1">Total invoice value</dt>
            <dd className="text-right font-mono font-bold border-t border-slate-300 pt-1">{gbp(inv.total)} {inv.currency}</dd>
          </dl>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 items-end">
          <p className="text-xs text-slate-600">{inv.declaration}</p>
          <div className="text-xs">
            <div className="border-b border-slate-400 h-8" />
            <p className="text-slate-500 mt-1">Signature, name and date — for {inv.seller.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
