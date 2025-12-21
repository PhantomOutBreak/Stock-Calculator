// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE || 'https://stock-calculator-yaf0.onrender.com'

export async function apiFetch(path, opts) {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

  try {
    const res = await fetch(url, opts)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const bodyPreview = text.slice(0, 200)
      console.error(`[apiFetch] ${res.status} ${res.statusText} -> ${url}\nResponse preview:`, bodyPreview)
      let parsed = {}
      try { parsed = JSON.parse(text) } catch {}
      throw new Error(parsed.error || `API Error ${res.status} (${url})`)
    }
    return await res.json()
  } catch (err) {
    console.error('[apiFetch] Failed request to', url, err && err.message ? err.message : err)
    throw err
  }
}
