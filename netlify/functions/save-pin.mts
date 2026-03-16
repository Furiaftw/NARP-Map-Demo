import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

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

  // Check if user is staff or owner
  const userStore = getStore({ name: 'user-management', consistency: 'strong' })
  let whitelist: Record<string, any> = {}
  try {
    const raw = await userStore.get('whitelist', { type: 'text' })
    if (raw) whitelist = JSON.parse(raw)
  } catch {}

  const userData = whitelist[email]
  if (!userData || !userData.approved || userData.role === 'user') {
    return new Response('Only staff and owner can manage pins', { status: 403 })
  }

  const { action, pin, pinId } = await req.json()
  const pinStore = getStore({ name: 'pins', consistency: 'strong' })
  let pins: any[] = []
  try {
    const raw = await pinStore.get('all-pins', { type: 'text' })
    if (raw) pins = JSON.parse(raw)
  } catch {}

  switch (action) {
    case 'create': {
      pins.push(pin)
      break
    }
    case 'update': {
      const idx = pins.findIndex((p: any) => p.id === pin.id)
      if (idx !== -1) pins[idx] = pin
      break
    }
    case 'delete': {
      pins = pins.filter((p: any) => p.id !== pinId)
      break
    }
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  await pinStore.set('all-pins', JSON.stringify(pins))
  return Response.json({ success: true })
}

export const config: Config = {
  path: '/api/pins',
  method: 'POST',
}
