import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RuleIcon } from './art.jsx'
import { Rich, ease } from './ui.jsx'

const RULES = [
  ['R-01', 'HS code of at least 6 digits', 'Red', 'Every product has a customs (HS) code with 6 or more digits.',
    'Customs uses the code to set duty and restrictions; a missing or short code is the classic reason for a hold.',
    'HS code “8507” on a power bank — only 4 digits.', 'Look it up in the UK Trade Tariff and use the full code (e.g. 850760).'],
  ['R-02', 'Declared value matches the items', 'Red', 'Total declared value equals Σ quantity × unit price, within 1%.',
    'The commercial invoice and the booking must tally, or customs questions the value.',
    'Declared £4,000 but 600 × £6 + 300 × £4 = £4,800.', 'Change the declared value to £4,800, or correct prices/quantities.'],
  ['R-03', 'Units per carton × cartons = quantity', 'Red', 'For each product, the packed units add up to the stated quantity.',
    'The receiving warehouse counts units; a mismatch is reported as missing stock.',
    '25 cartons × 10 per carton = 250, but quantity says 300.', 'Recount: 300 units need 30 cartons of 10.'],
  ['R-04', 'Booking cartons = item cartons', 'Red', 'The booking’s carton total equals the sum of every product’s cartons.',
    'Carriers and warehouses check carton counts on arrival.',
    'Booking says 50 cartons, products add up to 45.', 'Set the booking total to 45, or fix the product carton counts.'],
  ['R-05', 'Pallet weight within the carrier’s limit', 'Red', 'Gross weight ÷ pallets is at or under the chosen carrier’s max per pallet.',
    'Overweight pallets are refused at collection.',
    '800 kg on 1 pallet — the highest limit to Germany is 750 kg.', 'Spread the load over 2 pallets (400 kg each).'],
  ['R-06', 'No lithium batteries, aerosols or flammable liquids', 'Red', 'Product descriptions are screened for dangerous goods.',
    'These road services can’t carry them; they need a specialist dangerous-goods service.',
    '“Lithium power bank 10000mAh”, “Hairspray 250 ml”, “Nail polish remover”.', 'Remove them from this booking and ship separately.'],
  ['R-07', 'Gross weight ≥ net weight of the goods', 'Amber', 'Total gross weight is at least Σ unit weight × quantity.',
    'Gross includes cartons and pallets, so it can never be less than the goods alone.',
    'Gross 650 kg, but 400 hammers × 1.8 kg = 720 kg.', 'Reweigh: gross must be 720 kg plus packaging.'],
  ['R-08', 'Warehouse delivery has an appointment', 'Amber', 'Deliveries to a warehouse have a booked delivery slot.',
    'Warehouses turn away trucks without a slot, adding days and re-delivery fees.',
    'Destination type “Warehouse”, appointment “No”.', 'Book a slot with the receiving warehouse before collection.'],
  ['R-09', 'Every item has a country of origin', 'Amber', 'Each product says where it was made (not where it ships from).',
    'Origin decides the duty rate and any trade-deal preference.',
    'Cushion covers with a blank country of origin.', 'Add the manufacturing country, e.g. India.'],
  ['R-10', 'Ready-to-ship date not in the past', 'Amber', 'The date goods are packed and ready is today or later.',
    'A past date means the booking can’t be collected as stated.',
    'Ready date 01-10-2026 when today is 26-10-2026.', 'Set the real ready date.'],
]

const EXTRAS = [
  ['Possible dangerous goods', '“Batteries”, “spray”, “perfume” — flagged amber to confirm, never blocking.'],
  ['Implausible numbers', '0 kg units, £0 prices, pallets over 1,500 kg, pack sizes larger than the order.'],
  ['Cleaner carrier choice', 'If your priority’s best carrier can’t take the weight, we say how many pallets would make it fit.'],
  ['Data entry slips', 'HS codes that lost a leading zero in Excel, duplicate booking IDs, products with no matching booking.'],
]

export default function ChecksPage({ go }) {
  const [open, setOpen] = useState('R-01')
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
          <p className="label">Pre-flight checks</p>
          <h1 className="mt-2 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-5xl">Ten checks before anything leaves the dock. <span className="text-slate-400">Six stop the consignment, <span className="text-gradient">four warn you</span>.</span></h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            The same rulebook runs on every consignment — whether you chat, fill in the form or upload a spreadsheet.
            Each check runs as soon as its data arrives, so problems show up while you’re still entering details.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1, ease }} className="glass p-4">
          <div className="flex h-3 overflow-hidden rounded-full">
            <motion.div className="bg-red-500" initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 0.9, ease }} />
            <motion.div className="bg-amber-400" initial={{ width: 0 }} animate={{ width: '40%' }} transition={{ duration: 0.9, delay: 0.25, ease }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><p className="font-mono text-2xl font-semibold text-red-600">6</p><p className="text-slate-600"><b>Red</b> — the consignment can’t ship until fixed</p></div>
            <div><p className="font-mono text-2xl font-semibold text-amber-600">4</p><p className="text-slate-600"><b>Amber</b> — risky, should be fixed or checked</p></div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ul className="space-y-2">
          {RULES.map(([id, title, sev], i) => (
            <motion.li key={id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.35, ease }}>
              <button onClick={() => setOpen(id)}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ${open === id ? '' : 'hover:bg-white/70'}`}>
                {open === id && <motion.span layoutId="rule-active" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl border border-slate-200/80 bg-white shadow-lift" />}
                <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl ${sev === 'Red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                  <RuleIcon id={id} className="h-5 w-5" />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${sev === 'Red' ? 'text-red-600' : 'text-amber-600'}`}>{sev === 'Red' ? 'Blocks shipping' : 'Warning'}</span>
                </span>
                <span className="relative font-mono text-xs text-slate-400">{id}</span>
              </button>
            </motion.li>
          ))}
        </ul>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <AnimatePresence mode="popLayout">
            {RULES.filter((r) => r[0] === open).map(([id, title, sev, what, why, example, fix]) => (
              <motion.article key={id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.35, ease }} className="glass overflow-hidden">
                <div className={`flex items-center gap-4 px-6 py-5 ${sev === 'Red' ? 'bg-gradient-to-r from-red-50 to-transparent' : 'bg-gradient-to-r from-amber-50 to-transparent'}`}>
                  <span className={`grid h-14 w-14 place-items-center rounded-2xl ${sev === 'Red' ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-950'}`}>
                    <RuleIcon id={id} className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="font-mono text-sm text-slate-500">{id}</p>
                    <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                  </div>
                </div>
                <dl className="space-y-4 px-6 py-5 text-sm">
                  <Row k="What we check" v={what} />
                  <Row k="Why it matters" v={why} />
                  <div className={`rounded-xl border-l-4 px-4 py-3 ${sev === 'Red' ? 'pulse-red border-red-500 bg-red-50/60' : 'pulse-amber border-amber-400 bg-amber-50/60'}`}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Example of a failure</dt>
                    <dd className="mt-1 text-slate-800"><Rich text={example} /></dd>
                  </div>
                  <Row k="How to fix it" v={fix} />
                </dl>
                <div className="border-t border-slate-200/70 px-6 py-4">
                  <button className="btn-primary" onClick={() => go('book')}>Check a consignment</button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <section className="mt-12">
        <p className="label">On top of the rulebook</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Sense checks that catch the rest</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXTRAS.map(([t, d], i) => (
            <motion.div key={t} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.4, ease }} whileHover={{ y: -3 }} className="glass p-4 transition-shadow duration-200 hover:shadow-lift">
              <p className="font-semibold">{t}</p>
              <p className="mt-1 text-sm text-slate-600"><Rich text={d} /></p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="mt-1 text-slate-700"><Rich text={v} /></dd>
    </div>
  )
}
