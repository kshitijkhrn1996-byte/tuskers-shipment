async function call(path, options = {}) {
  const res = await fetch(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
  return data
}

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  chat: (conversation_id, message) => call('/api/chat', json({ conversation_id, message })),
  confirmChat: (conversation_id) => call('/api/chat/confirm', json({ conversation_id })),
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return call('/api/upload', { method: 'POST', body: fd })
  },
  confirmBooking: (reference) => call(`/api/bookings/${encodeURIComponent(reference)}/confirm`, { method: 'POST' }),
  carriers: () => call('/api/carriers'),
  help: (question, context) => call('/api/help', json({ question, context })),
}

export const gbp = (n) => '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 })
