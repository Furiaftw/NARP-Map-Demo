import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const OWNER_EMAIL = 'grisales4000@gmail.com'

function getUserFromToken(req: Request): { email: string; name: string } | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const token = auth.split(' ')[1]
    let payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    while (payload.length % 4) payload += '='
    const data = JSON.parse(atob(payload))
    return {
      email: data.email || '',
      name: data.user_metadata?.full_name || data.email || '',
    }
  } catch {
    return null
  }
}

export default async (req: Request, context: Context) => {
  const user = getUserFromToken(req)
  if (!user || !user.email) {
    return Response.json({ approved: false, role: null, email: '' })
  }

  const store = getStore({ name: 'user-management', consistency: 'strong' })
  let whitelist: Record<string, any> = {}
  try {
    const raw = await store.get('whitelist', { type: 'text' })
    if (raw) whitelist = JSON.parse(raw)
  } catch {}

  // Auto-add owner if not in whitelist
  if (user.email === OWNER_EMAIL && !whitelist[user.email]) {
    whitelist[user.email] = {
      role: 'owner',
      approved: true,
      name: user.name,
      lastLogin: new Date().toISOString(),
      addedAt: new Date().toISOString(),
    }
    await store.set('whitelist', JSON.stringify(whitelist))
  }

  const entry = whitelist[user.email]

  if (!entry) {
    // Register as pending
    whitelist[user.email] = {
      role: 'user',
      approved: false,
      name: user.name,
      lastLogin: new Date().toISOString(),
      addedAt: new Date().toISOString(),
    }
    await store.set('whitelist', JSON.stringify(whitelist))
    return Response.json({ approved: false, role: null, email: user.email })
  }

  // Update last login and name
  entry.lastLogin = new Date().toISOString()
  if (user.name) entry.name = user.name
  await store.set('whitelist', JSON.stringify(whitelist))

  if (!entry.approved) {
    return Response.json({ approved: false, role: null, email: user.email })
  }

  return Response.json({ approved: true, role: entry.role, email: user.email })
}

export const config: Config = {
  path: '/api/check-access',
  method: 'POST',
}
