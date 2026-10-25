// Tuskers mark: angular elephant head on a dark badge, ears spread, long ivory tusks.
export function TuskerMark({ className = 'w-9 h-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Tuskers elephant logo">
      <defs>
        <linearGradient id="tk-badge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="tk-tusk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf5" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30.5" fill="url(#tk-badge)" />
      <circle cx="32" cy="32" r="28.6" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
      {/* ears */}
      <path d="M25 15 12 11.5 6.5 21.5 8.5 33 15.5 40 23.5 34z" fill="#0f766e" />
      <path d="M39 15 52 11.5 57.5 21.5 55.5 33 48.5 40 40.5 34z" fill="#0f766e" />
      <path d="M23.5 18 13.5 15.5 10 22.5 11.5 31.5 16.5 36.5 22 32z" fill="#115e59" />
      <path d="M40.5 18 50.5 15.5 54 22.5 52.5 31.5 47.5 36.5 42 32z" fill="#115e59" />
      {/* head */}
      <path d="M32 9 41.5 12.5 44.5 22 42 32.5 37 38 35.6 49 38.6 52.6 36.4 56.5 31.6 55.4 30.4 51 28.4 38 22 32.5 19.5 22 22.5 12.5z" fill="#14b8a6" />
      <path d="M32 9 41.5 12.5 37 21 32 23.5 27 21 22.5 12.5z" fill="#5eead4" />
      <path d="M27 21 32 23.5 37 21 36 30 32 32 28 30z" fill="#2dd4bf" />
      <path d="M28.4 38 32 32 35.6 38 35.6 49 30.4 51z" fill="#0d9488" />
      {/* eyes */}
      <path d="M23.8 24.4 28.6 25.6 27.6 27.2z" fill="#020617" />
      <path d="M40.2 24.4 35.4 25.6 36.4 27.2z" fill="#020617" />
      {/* tusks */}
      <path d="M27.8 34.4C26.2 44.8 18.4 51.8 9.6 41c5.6 3.6 13.8 2.8 21.4-3z" fill="url(#tk-tusk)" stroke="#d97706" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M36.2 34.4C37.8 44.8 45.6 51.8 54.4 41c-5.6 3.6-13.8 2.8-21.4-3z" fill="url(#tk-tusk)" stroke="#d97706" strokeWidth=".7" strokeLinejoin="round" />
    </svg>
  )
}

export default function Logo({ className = 'h-9', light = false }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <TuskerMark className="h-full w-auto" />
      <span className="leading-none text-left">
        <span className={`block font-extrabold tracking-tight text-[1.15em] ${light ? 'text-white' : 'text-ink'}`}>
          TUSKERS
        </span>
        <span className="block text-[0.55em] font-bold tracking-[0.34em] text-amber-500 mt-0.5">FREIGHT</span>
      </span>
    </span>
  )
}
