import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  const pinStore = getStore({ name: 'pins', consistency: 'strong' })
  let pins: any[] = []
  try {
    const raw = await pinStore.get('all-pins', { type: 'text' })
    if (raw) pins = JSON.parse(raw)
  } catch {}

  return Response.json({ pins })
}

export const config: Config = {
  path: '/api/pins',
  method: 'GET',
}
