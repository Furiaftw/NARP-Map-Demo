import { getStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'
import type { Context, Config } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  const user = await getUser()
  if (!user) {
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
