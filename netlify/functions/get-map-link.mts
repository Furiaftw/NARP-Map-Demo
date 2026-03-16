import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  const store = getStore('map-config')
  const mapUrl = await store.get('current-map-url', { type: 'text' })

  return Response.json({ url: mapUrl || '' })
}

export const config: Config = {
  path: '/api/map-link',
  method: 'GET',
}
