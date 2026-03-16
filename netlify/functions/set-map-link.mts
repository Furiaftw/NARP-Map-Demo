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
  if (!email) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check if user is approved staff or owner
  const userStore = getStore({ name: 'user-management', consistency: 'strong' })
  let whitelist: Record<string, any> = {}
  try {
    const raw = await userStore.get('whitelist', { type: 'text' })
    if (raw) whitelist = JSON.parse(raw)
  } catch {}

  const userData = whitelist[email]
  // Allow owner even if whitelist is empty (first-time setup)
  const isOwner = email === OWNER_EMAIL
  if (!isOwner && (!userData || !userData.approved || userData.role === 'user')) {
    return new Response('Only staff and owner can update map link', { status: 403 })
  }

  const { url } = await req.json()
  if (typeof url !== 'string') {
    return new Response('Invalid URL', { status: 400 })
  }

  const store = getStore({ name: 'map-config', consistency: 'strong' })
  await store.set('current-map-url', url)

  return Response.json({ url, success: true })
}

export const config: Config = {
  path: '/api/map-link',
  method: 'POST',
}
