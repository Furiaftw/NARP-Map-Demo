import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const OWNER_EMAIL = 'grisales4000@gmail.com'

function getUserEmailFromToken(req: Request): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const token = auth.split(' ')[1]
    let payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    while (payload.length % 4) payload += '='
    const data = JSON.parse(atob(payload))
    return data.email || null
  } catch {
    return null
  }
}

export default async (req: Request, context: Context) => {
  const email = getUserEmailFromToken(req)
  if (!email) return new Response('Unauthorized', { status: 401 })

  const store = getStore({ name: 'user-management', consistency: 'strong' })
  let whitelist: Record<string, any> = {}
  try {
    const raw = await store.get('whitelist', { type: 'text' })
    if (raw) whitelist = JSON.parse(raw)
  } catch {}

  const caller = whitelist[email]
  if (!caller || caller.role !== 'owner') {
    return new Response('Forbidden', { status: 403 })
  }

  return Response.json({ whitelist })
}

export const config: Config = {
  path: '/api/whitelist',
  method: 'GET',
}
