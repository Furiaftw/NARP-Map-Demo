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

  const { action, drawings } = await req.json()
  const drawStore = getStore({ name: 'drawings', consistency: 'strong' })

  switch (action) {
    case 'save': {
      await drawStore.set('map-drawings', JSON.stringify(drawings))
      return Response.json({ success: true })
    }
    case 'clear': {
      await drawStore.set('map-drawings', JSON.stringify([]))
      return Response.json({ success: true })
    }
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 })
  }
}

export const config: Config = {
  path: '/api/drawings',
  method: 'POST',
}
