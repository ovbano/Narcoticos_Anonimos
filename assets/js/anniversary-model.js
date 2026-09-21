/* Fechas civiles del grupo: sin depender de la zona horaria del visitante. */
(function (root) {
  'use strict';
  const date = (year, month, day) => new Date(year, month - 1, Math.min(day, new Date(year, month, 0, 12).getDate()), 12);
  const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = () => {
    const p = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const n = type => Number(p.find(v => v.type === type).value);
    return date(n('year'),n('month'),n('day'));
  };
  const parse = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const [y,m,d] = value.split('-').map(Number);
    if (y<1900 || y>2200 || m<1 || m>12 || d<1 || d>31) return null;
    const result = date(y,m,d);
    return key(result) === value ? result : null;
  };
  const valid = item => Number.isInteger(item.month) && item.month>=1 && item.month<=12 && Number.isInteger(item.day) && item.day>=1 && item.day<=date(2000,item.month,31).getDate();
  const celebrationYear = item => {
    const scheduled = parse(item.celebration?.date);
    if (!scheduled || !valid(item)) return null;
    const y = scheduled.getFullYear();
    return [y-1,y,y+1].sort((a,b) => Math.abs(date(a,item.month,item.day)-scheduled)-Math.abs(date(b,item.month,item.day)-scheduled))[0];
  };
  const occurrence = (item,year) => {
    if (!valid(item) || !Number.isInteger(year) || year<1900 || year>2200 || (item.startYear && year<item.startYear)) return null;
    const original = date(year,item.month,item.day);
    const celebration = celebrationYear(item) === year ? item.celebration : null;
    return {item,year,original,celebration,date:celebration ? parse(celebration.date) : original,milestone:item.startYear && year>item.startYear ? year-item.startYear : null};
  };
  const status = (event,now=today()) => key(event.date)<key(now) ? 'Celebrado' : key(event.date)===key(now) ? '¡Hoy celebramos!' : 'Próximo aniversario';
  const url = (item,year,base) => {
    const result = new URL('aniversario.html',base);
    result.searchParams.set('id',item.id); result.searchParams.set('year',year); return result.href;
  };
  const time = value => /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value || '') ? value.slice(0,5) : '';
  const mapsUrl = value => {
    try {
      const u = new URL(value);
      decodeURIComponent(u.pathname); // Reject malformed URL escapes before embedding.
      if (u.protocol !== 'https:' || u.username || u.password || u.port || u.href.length > 2048) return null;
      const google = ['google.com','www.google.com','maps.google.com','google.com.ec','www.google.com.ec','maps.google.com.ec'].includes(u.hostname);
      if ((google && (u.pathname === '/maps' || u.pathname.startsWith('/maps/') || u.hostname.startsWith('maps.'))) ||
          (u.hostname === 'maps.app.goo.gl' && /^\/[\w-]+\/?$/.test(u.pathname)) ||
          (u.hostname === 'goo.gl' && /^\/maps\/[\w-]+\/?$/.test(u.pathname))) return u;
    } catch {}
    return null;
  };
  const embedUrl = u => {
    if (!u || ['maps.app.goo.gl','goo.gl'].includes(u.hostname)) return '';
    // Embed links retain Google's own framing; generated links never force zoom.
    if (u.pathname === '/maps/embed' && u.searchParams.has('pb')) return u.href;
    const embed = new URL('https://www.google.com/maps');
    const cid = u.searchParams.get('cid');
    if (cid && /^\d+$/.test(cid)) embed.searchParams.set('cid',cid);
    else {
      const pin = decodeURIComponent(u.pathname).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      const query = pin && Math.abs(Number(pin[1]))<=90 && Math.abs(Number(pin[2]))<=180 ? `${pin[1]},${pin[2]}` :
        (u.searchParams.get('query') || u.searchParams.get('q') || u.searchParams.get('destination') ||
        (u.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/)?.[1] ? decodeURIComponent(u.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/)[1]).replace(/\+/g,' ') : ''));
      if (!query) return '';
      embed.searchParams.set('q',query);
    }
    embed.searchParams.set('output','embed');
    return embed.href;
  };
  const map = celebration => {
    if (!celebration?.confirmed) return null;
    const u = mapsUrl(celebration.mapUrl);
    // An explicit Maps link is authoritative, even when old coordinates remain.
    if (u) return {link:u.href,embed:embedUrl(u),resolve:['maps.app.goo.gl','goo.gl'].includes(u.hostname)};
    const lat = celebration.latitude, lon = celebration.longitude;
    const coords = lat !== null && lat !== undefined && lat !== '' && lon !== null && lon !== undefined && lon !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat))<=90 && Math.abs(Number(lon))<=180;
    const query = coords ? `${Number(lat)},${Number(lon)}` : String(celebration.location || '').trim();
    return query ? {link:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,embed:`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`} : null;
  };
  const api = {date,key,today,parse,valid,celebrationYear,occurrence,status,url,map,time,mapsUrl};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.AnniversaryModel=api;
})(typeof window !== 'undefined' ? window : globalThis);

