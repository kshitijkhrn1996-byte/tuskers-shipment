import { useCallback, useEffect, useState } from 'react'
import RATE_CARD from './data/rates.json'

async function call(path, options = {}) {
  const res = await fetch(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
  return data
}

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  chat: (conversation_id, message) => call('/api/chat', json({ conversation_id, message })),
  saveDraft: (conversation_id, draft) => call('/api/draft', json({ conversation_id, draft })),
  confirm: (conversation_id, source) => call('/api/chat/confirm', json({ conversation_id, source })),
  invoice: (conversation_id) => call('/api/invoice', json({ conversation_id })),
  upload: (files) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return call('/api/upload', { method: 'POST', body: fd })
  },
  bookingDraft: (reference) => call(`/api/bookings/${encodeURIComponent(reference)}/draft`),
  confirmBooking: (reference) => call(`/api/bookings/${encodeURIComponent(reference)}/confirm`, { method: 'POST' }),
  carriers: () => call('/api/carriers'),
  compare: (body) => call('/api/carriers/compare', json(body)),
  help: (question, context) => call('/api/help', json({ question, context })),
}

export const gbp = (n) => '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const gbp0 = (n) => '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })

// Rate card with retries: the API can be cold-starting when the page first loads.

export function useCarriers() {
  const [state, setState] = useState({ carriers: RATE_CARD, loading: true, error: '' })
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const carriers = await api.carriers()
        setState({ carriers, loading: false, error: '' })
        return
      } catch (e) {
        // the rate card is fixed by the case, so fall back to the bundled copy rather than show nothing
        if (attempt === 3) setState({ carriers: RATE_CARD, loading: false, error: '' })
        else await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
      }
    }
  }, [])
  useEffect(() => { load() }, [load])
  return { ...state, retry: load }
}
