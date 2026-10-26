import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Rich, StatusIcon, Tooltip, TrafficLight, ease } from './ui.jsx'
import { hsBus } from '../api.js'
import { RuleIcon } from './art.jsx'
import { ReadinessRing } from './insights.jsx'

export const RULES = [
  ['R-01', 'HS code of at least 6 digits', 'Red'],
  ['R-02', 'Declared value matches items', 'Red'],
  ['R-03', 'Units per carton × cartons = quantity', 'Red'],
  ['R-04', 'Booking cartons = sum of item cartons', 'Red'],
  ['R-05', 'Weight per pallet within carrier limit', 'Red'],
  ['R-06', 'No lithium batteries, aerosols or flammable liquids', 'Red'],
  ['R-07', 'Gross weight ≥ net weight of items', 'Amber'],
  ['R-08', 'Warehouse delivery has an appointment', 'Amber'],
  ['R-09', 'Every item has a country of origin', 'Amber'],
  ['R-10', 'Ready to ship date not in the past', 'Amber'],
]
const ORDER = { Red: 0, Amber: 1, Info: 2 }

// Turn a finished report into the same issue shape the live checks use (uploads).
export function issuesFromReport(report) {
  if (!report) return []
  const fails = report.checks.filter((c) => c.status === 'fail')
    .map((c) => ({ key: c.rule_id, rule_id: c.rule_id, severity: c.severity, message: c.fault, fix: c.fix }))
  const notes = (report.advisories || []).map((a, i) => ({ key: `adv-${i}`, rule_id: null, severity: a.severity || 'Amber', message: a.message, fix: a.fix, kind: a.kind, query: a.query }))
  return [...fails, ...notes]
}

function checklist(report, issues) {
  return RULES.map(([id, title, sev]) => {
    if (report) {
      const c = report.checks.find((x) => x.rule_id === id)
      const status = c.status === 'pass' ? 'pass' : c.status === 'pending' ? 'pending' : c.severity === 'Red' ? 'red' : 'amber'
      return { id, title, status, detail: c.fault }
    }
    const hit = issues.find((i) => i.rule_id === id)
    return hit ? { id, title, status: sev === 'Red' ? 'red' : 'amber', detail: hit.message } : { id, title, status: 'waiting', detail: 'Needs more details before it can be checked' }
  })
}

export default function ValidationPanel({ report, issues, missing = [], bookingId }) {
  const list = [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
  const reds = list.filter((i) => i.severity === 'Red').length
  const ambers = list.filter((i) => i.severity === 'Amber').length
  const rows = checklist(report, issues)
  const passing = rows.filter((r) => r.status === 'pass').length
  const light = reds ? 'red' : ambers ? 'amber' : report ? 'green' : 'idle'
  const title = {
    red: report ? 'On hold' : 'Blocker found',
    amber: report ? 'Ready, with warnings' : 'Warnings so far',
    green: 'Cleared to ship',
    idle: 'Waiting for details',
  }[light]
  const tone = { red: 'text-red-600', amber: 'text-amber-600', green: 'text-emerald-600', idle: 'text-slate-500' }[light]

  return (
    <section className="glass">
      <div className="flex items-center gap-4 border-b border-slate-200/70 px-5 py-4">
        <TrafficLight state={light} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="label">Pre-flight</span>
            {bookingId && <span className="font-mono text-[11px] text-slate-500 rounded-md bg-slate-100/80 px-1.5 py-0.5">{bookingId}</span>}
          </div>
          <motion.h3 key={title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease }} className={`text-xl font-semibold tracking-tight ${tone}`}>
            {title}
          </motion.h3>
          <p className="text-sm text-slate-500">
            {report
              ? <>Carrier and rules evaluated · <span className="font-mono">{passing}/10</span> rules passing</>
              : <><span className="font-mono">{missing.length}</span> detail{missing.length === 1 ? '' : 's'} to go · rules run as soon as their data arrives</>}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <Counter n={reds} label="blockers" cls="text-red-600 bg-red-50 border-red-100" />
            <Counter n={ambers} label="warnings" cls="text-amber-700 bg-amber-50 border-amber-100" />
          </div>
          <ReadinessRing rows={rows} live={!report} />
        </div>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 px-5 py-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Tooltip content={r.status === 'pass' ? null : r.detail} className="w-full">
              <div className={`flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm transition-colors duration-200 hover:bg-slate-100/60 ${r.status === 'waiting' ? 'text-slate-400' : 'text-slate-700'}`}>
                <StatusIcon status={r.status} />
                <RuleIcon id={r.id} className={`mt-0.5 h-4 w-4 shrink-0 ${r.status === 'red' ? 'text-red-500' : r.status === 'amber' ? 'text-amber-500' : r.status === 'pass' ? 'text-teal-600' : 'text-slate-300'}`} />
                <span className="w-9 shrink-0 whitespace-nowrap font-mono text-[11px] text-slate-400">{r.id}</span>
                <span className={`leading-snug ${r.status === 'red' || r.status === 'amber' ? 'font-medium text-ink' : ''}`}>{r.title}</span>
              </div>
            </Tooltip>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-200/70 px-5 py-4">
        {list.length === 0 ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-500">
            {report ? 'No problems found — every rule passes.' : 'Nothing wrong so far. Problems appear here the moment they’re spotted.'}
          </motion.p>
        ) : (
          <LayoutGroup>
            <motion.ul layout className="space-y-2.5">
              <AnimatePresence initial={false}>
                {list.map((i, idx) => <IssueCard key={i.key} issue={i} index={idx} />)}
              </AnimatePresence>
            </motion.ul>
          </LayoutGroup>
        )}
      </div>
    </section>
  )
}

function Counter({ n, label, cls }) {
  return (
    <div className={`flex min-w-[6.5rem] items-center gap-2 rounded-lg border px-2.5 py-1 ${n ? cls : 'text-slate-400 bg-white/60 border-slate-200/70'}`}>
      <motion.span key={n} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, ease }}
        className="font-mono text-base font-semibold leading-none">{n}</motion.span>
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </div>
  )
}

const SEV = {
  Red: { card: 'border-red-200/80 pulse-red', bar: 'from-red-500 to-rose-400', tag: 'text-red-700', id: 'bg-red-50 text-red-700', label: 'Blocks shipping', icon: 'red' },
  Amber: { card: 'border-amber-200/80 pulse-amber', bar: 'from-amber-400 to-yellow-300', tag: 'text-amber-700', id: 'bg-amber-50 text-amber-800', label: 'Warning', icon: 'amber' },
  Info: { card: 'border-sky-200/80', bar: 'from-sky-400 to-cyan-300', tag: 'text-sky-700', id: 'bg-sky-50 text-sky-700', label: 'Note', icon: 'pending' },
}

export function IssueCard({ issue, index = 0, compact = false }) {
  const s = SEV[issue.severity]
  return (
    <motion.li layout
      initial={{ opacity: 0, x: 32, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease, delay: Math.min(index, 6) * 0.05 } }}
      exit={{ opacity: 0, x: 32, scale: 0.98, transition: { duration: 0.25, ease } }}
      className={`relative list-none overflow-hidden rounded-xl border bg-white/85 backdrop-blur ${compact ? 'pl-3.5 pr-3 py-2.5' : 'pl-4 pr-4 py-3'} ${s.card}`}>
      <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${s.bar}`} />
      <div className="flex items-center gap-2">
        <StatusIcon status={s.icon} />
        {issue.rule_id && <span className={`font-mono text-[11px] font-medium rounded-md px-1.5 py-0.5 ${s.id}`}>{issue.rule_id}</span>}
        <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${s.tag}`}>{issue.rule_id ? s.label : issue.kind === 'hs' ? 'HS database' : issue.kind === 'sku' ? 'Product records' : issue.severity === 'Red' ? 'Problem' : issue.severity === 'Amber' ? 'Check this' : 'Note'}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-800"><Rich text={issue.message} /></p>
      {issue.fix && (
        <p className="mt-1.5 flex gap-1.5 text-sm leading-relaxed text-slate-600">
          <svg viewBox="0 0 16 16" className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" /></svg>
          <span><span className="font-medium text-slate-700">Fix · </span><Rich text={issue.fix} /></span>
        </p>
      )}
      {issue.kind === 'hs' && (
        <button onClick={() => hsBus.open({ query: issue.query, item: issue.field ? Number(issue.field.split('.')[1]) : null })}
          className="btn-ghost mt-2.5 px-3 py-1 text-xs">
          Find the right code
        </button>
      )}
    </motion.li>
  )
}
