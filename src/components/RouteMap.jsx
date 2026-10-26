import { useId, useMemo } from 'react'
import { geoConicConformal, geoPath } from 'd3-geo'
import europe from '../data/europe.json'

export const ORIGINS = {
  London: [-0.1278, 51.5074], Manchester: [-2.2426, 53.4808],
  Birmingham: [-1.8904, 52.4862], Leeds: [-1.5491, 53.8008],
}
export const DESTINATIONS = {
  Berlin: [13.405, 52.52, 'Germany'], Frankfurt: [8.6821, 50.1109, 'Germany'], Hamburg: [9.9937, 53.5511, 'Germany'],
  Paris: [2.3522, 48.8566, 'France'], Lyon: [4.8357, 45.764, 'France'],
  Amsterdam: [4.9041, 52.3676, 'Netherlands'], Rotterdam: [4.4777, 51.9244, 'Netherlands'],
}
// Label side per city so neighbours (Leeds/Manchester, Amsterdam/Rotterdam) don't collide.
const LABEL_LEFT = new Set(['Manchester', 'Rotterdam', 'Paris'])
const COUNTRY_LABELS = [
  ['UNITED KINGDOM', -3.6, 55.2], ['GERMANY', 11.2, 51.1], ['FRANCE', 2.0, 46.9], ['NETHERLANDS', 6.2, 53.05],
]

const W = 800
const H = 640

export default function RouteMap({ origin, dest, onOrigin, onDest, compact = false }) {
  const uid = useId().replace(/:/g, '')
  const { path, project } = useMemo(() => {
    const projection = geoConicConformal().rotate([-4, 0]).parallels([44, 56])
      .fitExtent([[20, 20], [W - 20, H - 20]], { type: 'MultiPoint', coordinates: [[-5.8, 43.6], [14.6, 43.6], [-5.8, 56.6], [14.6, 56.6]] })
      .clipExtent([[0, 0], [W, H]])
    return { path: geoPath(projection), project: projection }
  }, [])

  const destCountry = dest ? DESTINATIONS[dest][2] : null
  let arc = null
  let x1, y1, x2, y2
  if (origin && dest) {
    ;[x1, y1] = project(ORIGINS[origin])
    ;[x2, y2] = project(DESTINATIONS[dest])
    // Quadratic curve bowed upwards: control point on the upward-facing normal.
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const len = Math.hypot(x2 - x1, y2 - y1)
    let [nx, ny] = [(y2 - y1) / len, (x1 - x2) / len]
    if (ny > 0) [nx, ny] = [-nx, -ny]
    arc = `M${x1},${y1} Q${mx + nx * len * 0.2},${my + ny * len * 0.2} ${x2},${y2}`
  }

  const fillFor = (f) => {
    if (!f.properties.served) return '#f1f5f9'
    if (f.properties.name === 'United Kingdom') return '#ccfbf1'
    if (f.properties.name === destCountry) return '#fde68a'
    return '#fef9e7'
  }
  const k = compact ? 2.6 : 1  // compact maps render ~3x smaller; scale marks up to stay legible

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
      aria-label={origin && dest ? `Map of the route from ${origin} to ${dest}` : 'Map of the UK to Germany, France and the Netherlands'}>
      <defs>
        {arc && (
          <linearGradient id={`${uid}rg`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        )}
        <filter id={`${uid}soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.15" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="#eaf3f8" />
      {europe.features.map((f) => (
        <path key={f.properties.id} d={path(f)} fill={fillFor(f)}
          stroke={f.properties.served ? '#94a3b8' : '#cbd5e1'} strokeWidth={(f.properties.served ? 0.9 : 0.6) * (compact ? 1.6 : 1)}
          style={{ transition: 'fill 300ms' }} />
      ))}
      {!compact && COUNTRY_LABELS.map(([name, lng, lat]) => {
        const [x, y] = project([lng, lat])
        return (
          <text key={name} x={x} y={y} textAnchor="middle" fontSize="11" letterSpacing="2.5" fontWeight="600"
            fill={destCountry && name.toLowerCase() === destCountry.toLowerCase() ? '#92400e' : '#64748b'} opacity="0.8">{name}</text>
        )
      })}

      {arc && (
        <>
          <path d={arc} fill="none" stroke="#0f172a" strokeOpacity="0.08" strokeWidth={7 * k} strokeLinecap="round" />
          <path key={arc} d={arc} fill="none" stroke={`url(#${uid}rg)`} strokeWidth={3 * k} strokeLinecap="round"
            strokeDasharray={`${8 * k} ${7 * k}`} className="route-dash" />
          <circle r={5.5 * k} fill="#fff" stroke="#0f766e" strokeWidth={2.5 * k} filter={`url(#${uid}soft)`}>
            <animateMotion key={arc} dur="3.2s" repeatCount="indefinite" path={arc} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
          </circle>
        </>
      )}

      {Object.entries(ORIGINS).map(([name, c]) => (
        <City key={name} name={name} xy={project(c)} active={name === origin} kind="origin" k={k} compact={compact}
          onClick={onOrigin ? () => onOrigin(name) : undefined} />
      ))}
      {Object.entries(DESTINATIONS).map(([name, c]) => (
        <City key={name} name={name} xy={project(c)} active={name === dest} kind="dest" k={k} compact={compact}
          onClick={onDest ? () => onDest(name) : undefined} />
      ))}
    </svg>
  )
}

function City({ name, xy: [x, y], active, kind, onClick, k = 1, compact }) {
  const color = kind === 'origin' ? '#0f766e' : '#d97706'
  const left = LABEL_LEFT.has(name)
  if (compact && !active) return <circle cx={x} cy={y} r={3 * k} fill="#fff" stroke={color} strokeWidth={1.5 * k} opacity="0.7" />
  return (
    <g onClick={onClick} className={onClick ? 'cursor-pointer' : ''} role={onClick ? 'button' : undefined} aria-label={onClick ? `Choose ${name}` : undefined}>
      <circle cx={x} cy={y} r={14 * k} fill="transparent" />
      {active && <circle cx={x} cy={y} r={11 * k} fill={color} opacity="0.15" className="city-pulse" />}
      <circle cx={x} cy={y} r={(active ? 6 : 4) * k} fill={active ? color : '#fff'} stroke={color} strokeWidth={2 * k} />
      <text x={x + (left ? -10 : 10) * k} y={y + 4 * k} textAnchor={left ? 'end' : 'start'}
        fontSize={(active ? 14 : 12) * k} fontWeight={active ? 700 : 500} fill={active ? '#0f172a' : '#475569'}
        stroke="#ffffff" strokeWidth={3 * k} paintOrder="stroke">{name}</text>
    </g>
  )
}
