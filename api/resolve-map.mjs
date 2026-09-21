import model from '../assets/js/anniversary-model.js';

// Only follow Google's Maps short-link redirects. Never fetch arbitrary hosts.
export async function resolveMap(value, request = fetch) {
  let url = model.mapsUrl(value);
  if (!url) throw new Error('invalid');
  const signal = AbortSignal.timeout(7000);
  for (let step = 0; step < 5; step++) {
    const map = model.map({confirmed:true, mapUrl:url.href});
    if (map.embed) return url.href;
    if (!map.resolve) throw new Error('unsupported');
    const response = await request(url.href, {redirect:'manual', signal});
    const destination = response.headers.get('location');
    await response.body?.cancel();
    if (response.status < 300 || response.status >= 400 || !destination) throw new Error('unresolved');
    url = model.mapsUrl(new URL(destination,url).href);
    if (!url) throw new Error('invalid redirect');
  }
  throw new Error('too many redirects');
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Método no permitido'});
  }
  const input = req.query?.url;
  if (typeof input !== 'string' || !model.mapsUrl(input)) return res.status(400).json({error:'Enlace de Maps inválido'});
  try {
    const url = await resolveMap(input);
    res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400');
    return res.status(200).json({url});
  } catch {
    return res.status(422).json({error:'No se pudo cargar la vista del mapa. Usa el enlace Cómo llegar.'});
  }
}
