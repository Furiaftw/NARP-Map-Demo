import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const OWNER_EMAIL = 'grisales4000@gmail.com'

export default async (req: Request, context: Context) => {
  const user = await getUser()
  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
    return new Response('Forbidden', { status: 403 })
  }

  const { action, email } = await req.json()
  if (!email || typeof email !== 'string') {
    return Response.json({ error: 'Email required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  if (normalizedEmail === OWNER_EMAIL) {
    return Response.json({ error: 'Cannot modify owner access' }, { status: 400 })
  }

  const store = getStore({ name: 'whitelist', consistency: 'strong' })
  let whitelist: string[] = []
  try {
    const raw = await store.get('approved-emails', { type: 'text' })
    if (raw) whitelist = JSON.parse(raw)
  } catch {}

  if (action === 'add') {
    if (!whitelist.includes(normalizedEmail)) {
      whitelist.push(normalizedEmail)
    }
  } else if (action === 'remove') {
    whitelist = whitelist.filter(e => e !== normalizedEmail)
  } else {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  await store.set('approved-emails', JSON.stringify(whitelist))
  return Response.json({ whitelist, success: true })
}

export const config: Config = {
  path: '/api/whitelist',
  method: 'POST',
}
