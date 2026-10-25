const STYLE = {
  Red: { box: 'border-red-500 bg-red-50', chip: 'bg-red-600 text-white', label: 'RED · blocks shipping' },
  Amber: { box: 'border-amber-400 bg-amber-50', chip: 'bg-amber-400 text-amber-950', label: 'AMBER · warning' },
  Info: { box: 'border-sky-300 bg-sky-50', chip: 'bg-sky-100 text-sky-800', label: 'NOTE' },
}

export function IssueCard({ issue }) {
  const s = STYLE[issue.severity]
  return (
    <div className={`rounded-lg border-l-4 px-3 py-2 text-sm ${s.box}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`chip ${s.chip}`}>{s.label}</span>
        {issue.rule_id && <span className="text-xs font-semibold text-slate-500">{issue.rule_id}</span>}
      </div>
      <p className="mt-1 text-slate-800">{issue.message}</p>
      {issue.fix && <p className="text-slate-600"><b>Fix:</b> {issue.fix}</p>}
    </div>
  )
}

export default function IssuesPanel({ issues, missing, complete }) {
  const order = { Red: 0, Amber: 1, Info: 2 }
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity])
  const reds = issues.filter((i) => i.severity === 'Red').length
  const ambers = issues.filter((i) => i.severity === 'Amber').length
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live checks</h3>
        <div className="flex gap-1.5">
          <span className={`chip ${reds ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{reds} red</span>
          <span className={`chip ${ambers ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{ambers} amber</span>
          {!complete && <span className="chip bg-slate-100 text-slate-600">{missing.length} detail(s) to go</span>}
        </div>
      </div>
      {sorted.length === 0
        ? <p className="text-sm text-slate-500 mt-2">{complete ? 'No problems found.' : 'Nothing wrong so far — problems are flagged here the moment they appear.'}</p>
        : <div className="space-y-2 mt-3">{sorted.map((i) => <IssueCard key={i.key} issue={i} />)}</div>}
    </div>
  )
}
