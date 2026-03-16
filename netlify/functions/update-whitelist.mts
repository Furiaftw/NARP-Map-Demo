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
  if (!caller || !caller.approved || caller.role !== 'owner') {
    return new Response('Only the owner can manage the whitelist', { status: 403 })
  }

  const { action, targetEmail, role } = await req.json()

  switch (action) {
    case 'approve': {
      if (!whitelist[targetEmail]) {
        whitelist[targetEmail] = { role: role || 'user', approved: true, name: targetEmail, addedAt: new Date().toISOString() }
      } else {
        whitelist[targetEmail].approved = true
        if (role) whitelist[targetEmail].role = role
      }
      break
    }
    case 'revoke': {
      if (targetEmail === OWNER_EMAIL) {
        return Response.json({ error: 'Cannot revoke owner access' }, { status: 400 })
      }
      if (whitelist[targetEmail]) {
        whitelist[targetEmail].approved = false
      }
      break
    }
    case 'set-role': {
      if (targetEmail === OWNER_EMAIL) {
        return Response.json({ error: 'Cannot change owner role' }, { status: 400 })
      }
      if (whitelist[targetEmail]) {
        whitelist[targetEmail].role = role
      }
      break
    }
    case 'add': {
      whitelist[targetEmail] = {
        role: role || 'user',
        approved: true,
        name: targetEmail,
        addedAt: new Date().toISOString(),
      }
      break
    }
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  await store.set('whitelist', JSON.stringify(whitelist))
  return Response.json({ whitelist, success: true })
}

export const config: Config = {
  path: '/api/whitelist',
  method: 'POST',
}
