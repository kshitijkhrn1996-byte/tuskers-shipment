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
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return call('/api/upload', { method: 'POST', body: fd })
  },
  bookingDraft: (reference) => call(`/api/bookings/${encodeURIComponent(reference)}/draft`),
  confirmBooking: (reference) => call(`/api/bookings/${encodeURIComponent(reference)}/confirm`, { method: 'POST' }),
  carriers: () => call('/api/carriers'),
  help: (question, context) => call('/api/help', json({ question, context })),
}

export const gbp = (n) => '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const gbp0 = (n) => '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
