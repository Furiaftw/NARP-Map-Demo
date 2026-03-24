import { getStore } from '@netlify/blobs'
import type { Context, Config } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  const drawStore = getStore({ name: 'drawings', consistency: 'strong' })
  let drawings: any[] = []
  try {
    const raw = await drawStore.get('map-drawings', { type: 'text' })
    if (raw) drawings = JSON.parse(raw)
  } catch {}

  return Response.json({ drawings })
}

export const config: Config = {
  path: '/api/drawings',
  method: 'GET',
}
