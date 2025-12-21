// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function apiFetch(path, opts) {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

  const res = await fetch(url, opts)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API Error ${res.status}`)
  }

  return res.json()
}
