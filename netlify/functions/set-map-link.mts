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
