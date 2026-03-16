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

  const pinStore = getStore({ name: 'pins', consistency: 'strong' })
  let pins: any[] = []
  try {
    const raw = await pinStore.get('all-pins', { type: 'text' })
    if (raw) pins = JSON.parse(raw)
  } catch {}

  // No user — return only public pins
  if (!email) {
    return Response.json({ pins: pins.filter((p: any) => !p.isSecret) })
  }

  // Check user role
  const userStore = getStore({ name: 'user-management', consistency: 'strong' })
  let whitelist: Record<string, any> = {}
  try {
    const raw = await userStore.get('whitelist', { type: 'text' })
    if (raw) whitelist = JSON.parse(raw)
  } catch {}

  const userData = whitelist[email]
  if (!userData || !userData.approved) {
    return Response.json({ pins: pins.filter((p: any) => !p.isSecret) })
  }

  // Owner sees everything
  if (email === OWNER_EMAIL || userData.role === 'owner') {
    return Response.json({ pins })
  }

  // Get secret access data
  let secretAccess: Record<string, string[]> = {}
  try {
    const raw = await userStore.get('secret-access', { type: 'text' })
    if (raw) secretAccess = JSON.parse(raw)
  } catch {}

  // Staff/User: show public pins + secret pins they have access to
  const visiblePins = pins.filter((p: any) => {
    if (!p.isSecret) return true
    const accessList = secretAccess[String(p.id)] || []
    return accessList.includes(email)
  })

  return Response.json({ pins: visiblePins })
}

export const config: Config = {
  path: '/api/pins',
  method: 'GET',
}
