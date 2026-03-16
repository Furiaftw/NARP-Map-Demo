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

  const userData = whitelist[email]
  if (!userData || !userData.approved) {
    return new Response('Forbidden', { status: 403 })
  }

  const isOwner = email === OWNER_EMAIL || userData.role === 'owner'
  const isStaff = userData.role === 'staff'

  if (!isOwner && !isStaff) {
    return new Response('Only owner and staff can manage secret access', { status: 403 })
  }

  const { action, pinId, targetEmail } = await req.json()

  let secretAccess: Record<string, string[]> = {}
  try {
    const raw = await store.get('secret-access', { type: 'text' })
    if (raw) secretAccess = JSON.parse(raw)
  } catch {}

  const pinKey = String(pinId)

  switch (action) {
    case 'grant': {
      // Staff can only grant access to pins they themselves have access to
      if (isStaff && !isOwner) {
        const myAccess = secretAccess[pinKey] || []
        if (!myAccess.includes(email)) {
          return Response.json({ error: 'You do not have access to this secret pin' }, { status: 403 })
        }
      }
      if (!secretAccess[pinKey]) secretAccess[pinKey] = []
      if (!secretAccess[pinKey].includes(targetEmail)) {
        secretAccess[pinKey].push(targetEmail)
      }
      break
    }
    case 'revoke': {
      if (!isOwner) {
        return Response.json({ error: 'Only the owner can revoke secret access' }, { status: 403 })
      }
      if (secretAccess[pinKey]) {
        secretAccess[pinKey] = secretAccess[pinKey].filter((e: string) => e !== targetEmail)
      }
      break
    }
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  await store.set('secret-access', JSON.stringify(secretAccess))
  return Response.json({ secretAccess, success: true })
}

export const config: Config = {
  path: '/api/secret-access',
  method: 'POST',
}
