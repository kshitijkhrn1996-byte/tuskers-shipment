import { useId } from 'react'

// Tuskers crest: gold line-art elephant (ears, dome, curled trunk, tusks) in a ringed deep-green seal.
export function TuskerMark({ className = 'w-9 h-9' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Tuskers logo">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b2b29" />
          <stop offset="1" stopColor="#03110f" />
        </linearGradient>
        <linearGradient id={`${id}au`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}bg)`} />
      <circle cx="32" cy="32" r="27.2" fill="none" stroke={`url(#${id}au)`} strokeWidth="1" />
      <g fill="none" stroke={`url(#${id}au)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 18.5c-8-4.5-15.5 1-14.5 10 .8 7 6.5 10.8 12.5 9" />
        <path d="M40 18.5c8-4.5 15.5 1 14.5 10-.8 7-6.5 10.8-12.5 9" />
        <path d="M22 37.5c-1.3-3-2-6.6-2-10.4C20 19.4 25.4 14 32 14s12 5.4 12 13.1c0 3.8-.7 7.4-2 10.4" />
        <path d="M28.3 35.5v7.5c0 5.2 3 8.5 6.6 8.5 3.1 0 4.8-2.3 4.4-4.6" />
        <path d="M35.7 35.5v6.6c0 1.4.9 2.3 2 2.3" />
        <path d="M26.6 36.8c-2 5-7 7.8-12.6 6.3" />
        <path d="M37.4 36.8c2 5 7 7.8 12.6 6.3" />
      </g>
      <circle cx="27" cy="25.5" r="1.4" fill="#fde68a" />
      <circle cx="37" cy="25.5" r="1.4" fill="#fde68a" />
    </svg>
  )
}

export default function Logo({ className = 'h-9', light = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <TuskerMark className="h-full w-auto drop-shadow-[0_4px_10px_rgba(3,17,15,0.25)]" />
      <span className="text-left leading-none">
        <span className={`block text-[1.2em] font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>Tuskers</span>
        <span className="mt-1 block text-[0.52em] font-bold tracking-[0.34em] text-amber-600">FREIGHT</span>
      </span>
    </span>
  )
}
