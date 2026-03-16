import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const OWNER_EMAIL = 'grisales4000@gmail.com'

async function isWhitelisted(): Promise<boolean> {
  const user = await getUser()
  if (!user) return false
  const email = user.email?.toLowerCase() || ''
  if (email === OWNER_EMAIL) return true
  const store = getStore({ name: 'whitelist', consistency: 'strong' })
  try {
    const raw = await store.get('approved-emails', { type: 'text' })
    if (raw) {
      const whitelist: string[] = JSON.parse(raw)
      return whitelist.includes(email)
    }
  } catch {}
  return false
}

export default async (req: Request, context: Context) => {
  if (!(await isWhitelisted())) {
    return new Response('Unauthorized', { status: 401 })
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
