// Calls SafeBite's Cloudflare Worker (worker/), which holds the USDA and Groq
// keys so they never reach the browser. Its address comes from .env.local.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

// False when VITE_API_URL isn't set; USDA lookups and AI features are then skipped or hidden.
export const workerConfigured = Boolean(API_URL)

// Sends a request to the worker and returns its JSON reply. Throws with the
// worker's own error message (e.g. "Too many requests…") when it fails.
export async function callWorker<T>(path: string, body?: object): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not set in .env.local')
  const res = await fetch(API_URL + path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}
