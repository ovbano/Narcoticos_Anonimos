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
  const map = celebration => {
    if (!celebration?.confirmed) return null;
    const lat = celebration.latitude, lon = celebration.longitude;
    const coords = lat !== null && lat !== undefined && lat !== '' && lon !== null && lon !== undefined && lon !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat))<=90 && Math.abs(Number(lon))<=180;
    const query = coords ? `${Number(lat)},${Number(lon)}` : String(celebration.location || '').trim();
    let link = '';
    try { const u = new URL(celebration.mapUrl); if(u.protocol==='https:' && (['maps.app.goo.gl','maps.google.com','www.google.com','google.com','goo.gl'].includes(u.hostname))) link=u.href; } catch {}
    if (coords || (!link && query)) link=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    return link ? {link,embed:coords ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=18&output=embed` : (!celebration.mapUrl && query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : '')} : null;
  };
  const api = {date,key,today,parse,valid,celebrationYear,occurrence,status,url,map};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.AnniversaryModel=api;
})(typeof window !== 'undefined' ? window : globalThis);

