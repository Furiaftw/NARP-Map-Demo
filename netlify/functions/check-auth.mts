import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

const OWNER_EMAIL = 'grisales4000@gmail.com'

export default async (req: Request, context: Context) => {
  const user = await getUser()
  if (!user) {
    return Response.json({ authenticated: false }, { status: 401 })
  }

  const email = user.email?.toLowerCase() || ''
  const isOwner = email === OWNER_EMAIL

  if (isOwner) {
    return Response.json({ authenticated: true, email, role: 'owner', whitelisted: true })
  }

  const store = getStore({ name: 'whitelist', consistency: 'strong' })
  let whitelist: string[] = []
  try {
    const raw = await store.get('approved-emails', { type: 'text' })
    if (raw) whitelist = JSON.parse(raw)
  } catch {}

  const whitelisted = whitelist.includes(email)

  return Response.json({ authenticated: true, email, role: 'staff', whitelisted })
}

export const config: Config = {
  path: '/api/check-auth',
  method: 'GET',
}
