(() => {
  'use strict';
  const M = window.AnniversaryModel;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = d => new Intl.DateTimeFormat('es-EC',{day:'numeric',month:'long',year:'numeric'}).format(d);
  const monthName = d => new Intl.DateTimeFormat('es-EC',{month:'long',year:'numeric'}).format(d);
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
  let items = [], cursor=M.today(), selected=null, query='';
  const link = event => M.url(event.item,event.year,location.href);
  const eventRows = () => {
    const rows=[];
    for (const item of items) for (let y=cursor.getFullYear()-1;y<=cursor.getFullYear()+1;y++) {
      const e=M.occurrence(item,y); if(!e) continue;
      rows.push({...e,kind:'Aniversario',day:e.original});
      if(e.celebration && M.key(e.date)!==M.key(e.original)) rows.push({...e,kind:'Celebración',day:e.date});
      else if(e.celebration) rows[rows.length-1].kind='Aniversario y celebración';
    }
    return rows.filter(e=>e.day.getFullYear()===cursor.getFullYear() && e.day.getMonth()===cursor.getMonth() && normalize(e.item.name).includes(normalize(query))).sort((a,b)=>a.day-b.day || a.item.name.localeCompare(b.item.name,'es'));
  };
  function setupCalendar() {
    const root=document.getElementById('anniversary-calendar');
    if(!root || root.dataset.ready) return;
    root.dataset.ready='true'; root.className='ann-explorer'; root.removeAttribute('aria-live');
    root.innerHTML=`<div class="ann-calendar-cover"><div class="ann-calendar-brand"><img src="assets/img/logo-amigos-verdaderos.png" alt="Grupo Amigos Verdaderos" width="58" height="58"><span>NARCÓTICOS ANÓNIMOS<small>Grupo Amigos Verdaderos</small></span></div><div class="ann-calendar-intro"><h3>Cada fecha,<br><em>una nueva vida.</em></h3><p>Un espacio para recordar, acompañar<br>y celebrar nuestra recuperación.</p></div><div class="ann-calendar-metrics"><span><strong id="ann-month-total">0</strong><small>FECHAS ESTE MES</small></span><span><strong id="ann-calendar-year"></strong><small>UN DÍA A LA VEZ</small></span></div></div>
      <div class="ann-calendar-workspace"><div class="ann-toolbar"><div class="ann-month-nav"><button type="button" class="ann-button ann-square" data-move="-1" aria-label="Mes anterior">←</button><h3 id="ann-month-label"></h3><button type="button" class="ann-button ann-square" data-move="1" aria-label="Mes siguiente">→</button></div><button type="button" class="ann-button" id="ann-today">Volver a hoy</button><label class="ann-search"><i class="bi bi-search" aria-hidden="true"></i><input type="search" id="ann-search" aria-label="Buscar compañero en el mes seleccionado" placeholder="Buscar compañero…"></label></div>
      <nav class="ann-month-shortcuts" id="ann-month-shortcuts" aria-label="Elegir mes"></nav>
      <div class="ann-explorer-layout"><section class="ann-month-sheet" aria-labelledby="ann-month-label"><div class="ann-week" aria-hidden="true">${['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'].map(x=>`<span>${x}</span>`).join('')}</div><div class="ann-days" id="ann-days"></div><p class="ann-legend"><span><b>●</b> Aniversario</span><span><b>●</b> Celebración</span><span>○ Hoy</span></p></section><section class="ann-agenda"><div class="ann-agenda-heading"><div><span class="ann-kicker">NOS ACOMPAÑAMOS</span><h4 id="ann-agenda-title">La agenda del mes</h4></div><button class="ann-button" type="button" id="ann-clear" hidden>Ver mes</button></div><p id="ann-count" role="status"></p><div id="ann-agenda-list"></div></section></div></div>`;
    root.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>{
      cursor=new Date(cursor.getFullYear(),cursor.getMonth()+Number(button.dataset.move),1,12);selected=null;renderCalendar();button.focus();
    }));
    root.querySelector('#ann-month-shortcuts').onclick=e=>{const button=e.target.closest('[data-month]');if(!button)return;cursor=M.date(cursor.getFullYear(),Number(button.dataset.month),1);selected=null;renderCalendar();root.querySelector(`[data-month="${button.dataset.month}"]`)?.focus();};
    root.querySelector('#ann-today').onclick=()=>{cursor=M.today();selected=null;renderCalendar();};
    root.querySelector('#ann-clear').onclick=()=>{selected=null;renderCalendar();root.querySelector('#ann-today').focus();};
    root.querySelector('#ann-search').oninput=e=>{query=e.target.value;selected=null;renderCalendar();};
    root.querySelector('#ann-days').onclick=e=>{
      const button=e.target.closest('[data-day]'); if(!button)return;
      selected=selected===button.dataset.day ? null : button.dataset.day;renderCalendar();
      root.querySelector(`[data-day="${button.dataset.day}"]`)?.focus();
    };
  }
  function renderCalendar() {
    setupCalendar();const root=document.getElementById('anniversary-calendar');if(!root)return;
    const savedQuery=query; query=''; const total=eventRows().length; query=savedQuery;
    const rows=eventRows(), y=cursor.getFullYear(),m=cursor.getMonth()+1,now=M.key(M.today());
    root.querySelector('#ann-month-total').textContent=String(total).padStart(2,'0');
    root.querySelector('#ann-calendar-year').textContent=y;
    root.querySelector('#ann-month-shortcuts').innerHTML=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((label,index)=>`<button type="button" data-month="${index+1}" aria-pressed="${index+1===m}" aria-label="${esc(monthName(M.date(y,index+1,1)))}">${label}</button>`).join('');
    root.querySelector('#ann-month-label').textContent=monthName(cursor);
    root.querySelector('[data-move="-1"]').disabled=y<=1900&&m===1;
    root.querySelector('[data-move="1"]').disabled=y>=2200&&m===12;
    const offset=(M.date(y,m,1).getDay()+6)%7;
    let days='<span aria-hidden="true"></span>'.repeat(offset);
    for(let d=1;d<=M.date(y,m,31).getDate();d++) {
      const day=M.key(M.date(y,m,d)), events=rows.filter(e=>M.key(e.day)===day);
      const original=events.some(e=>e.kind.includes('Aniversario')), celebration=events.some(e=>e.kind.toLowerCase().includes('celebración'));
      days+=`<button type="button" class="ann-day${events.length?' has-events':''}${day===now?' is-today':''}${selected===day?' is-selected':''}" data-day="${day}" aria-pressed="${selected===day}" ${day===now?'aria-current="date"':''} aria-label="${esc(fmt(M.date(y,m,d)))}: ${events.length} ${events.length===1?'evento':'eventos'}"><span>${d}</span><span class="ann-dots" aria-hidden="true">${original?'<b>●</b>':''}${celebration?'<b class="gold">●</b>':''}</span></button>`;
    }
    root.querySelector('#ann-days').innerHTML=days;
    const filtered=selected?rows.filter(e=>M.key(e.day)===selected):rows;
    root.querySelector('#ann-clear').hidden=!selected;
    root.querySelector('#ann-agenda-title').textContent=selected?fmt(M.parse(selected)):'La agenda del mes';
    root.querySelector('#ann-count').textContent=`${filtered.length} ${filtered.length===1?'fecha':'fechas'}${query?' para «'+query+'»':''}`;
    root.querySelector('#ann-agenda-list').innerHTML=filtered.length?filtered.map(e=>`<a class="ann-agenda-card ${M.key(e.date)<now?'is-past':M.key(e.date)===now?'is-current':''}" href="${esc(link(e))}"><span class="ann-agenda-date">${e.day.getDate()}<small>${esc(e.kind)}</small></span><span><strong>${esc(e.item.name)}</strong><small>${e.milestone?`${e.milestone} ${e.milestone===1?'año':'años'} de recuperación`:'Un día a la vez'}</small><em>${esc(M.status(e))}</em></span><span class="ann-agenda-arrow" aria-hidden="true">↗</span></a>`).join(''):'<div class="ann-no-events"><i class="bi bi-calendar2-heart" aria-hidden="true"></i><strong>No hay fechas para esta selección.</strong><p>Prueba otro día, cambia el mes o borra la búsqueda.</p></div>';
  }
  function renderDetail() {
    const root=document.getElementById('anniversary-detail');if(!root)return;
    const params=new URLSearchParams(location.search), id=params.get('id'), raw=params.get('year');
    const year=raw && /^\d{4}$/.test(raw)?Number(raw):NaN;
    const item=items.find(i=>String(i.id)===id), event=item?M.occurrence(item,year):null;
    if(!event){root.innerHTML='<section class="ann-detail-panel"><h1>Invitación no disponible</h1><p>El enlace puede estar incompleto o el aniversario ya no es público.</p><a class="ann-button ann-primary" href="index.html#aniversarios">Ver aniversarios</a></section>';return;}
    document.title=`Aniversario de ${item.name} · ${year} | Amigos Verdaderos`;
    const maps=M.map(event.celebration), status=M.status(event), celebration=event.celebration;
    const past = M.key(event.date) < M.key(M.today());
    const weekday = new Intl.DateTimeFormat('es-EC',{weekday:'long'}).format(event.date);
    const month = new Intl.DateTimeFormat('es-EC',{month:'long'}).format(event.date);
    const shareAction = `<button class="ann-button ann-primary" type="button" data-share-url="${esc(link(event))}" data-share-name="${esc(item.name)}"><i class="bi bi-share" aria-hidden="true"></i> Compartir invitación <span aria-hidden="true">↗</span></button>`;
    root.innerHTML=`<article class="ann-invitation">
      <header class="ann-invitation-brand"><img src="assets/img/logo-amigos-verdaderos.png" alt="Grupo Amigos Verdaderos" width="72" height="72"><div><span>NARCÓTICOS ANÓNIMOS</span><strong>Grupo Amigos Verdaderos</strong></div><span class="ann-edition">ANIVERSARIO<br>${year}</span></header>
      <section class="ann-invitation-hero"><div class="ann-hero-copy"><span class="ann-kicker">${past?'UNA HISTORIA QUE CELEBRAMOS':'TENEMOS UNA RAZÓN PARA REUNIRNOS'}</span><h1>Celebramos<br><em>la recuperación.</em></h1><div class="ann-invite-person"><span>ACOMPAÑAMOS A</span><h2>${esc(item.name)}</h2></div><p>Cada día es un nuevo comienzo.<br>Compartirlo lo hace aún más especial.</p><a class="ann-hero-link" href="#ann-invitation-info">Descubre la invitación <span aria-hidden="true">↓</span></a></div>
      <div class="ann-hero-art"><div class="ann-orbit ann-orbit-one" aria-hidden="true"></div><div class="ann-orbit ann-orbit-two" aria-hidden="true"></div><span class="ann-art-star ann-art-star-one" aria-hidden="true">✦</span><span class="ann-art-star ann-art-star-two" aria-hidden="true">✦</span><div class="ann-medallion"><span class="ann-medallion-top">SOLO POR HOY</span><strong>${event.milestone || 'HOY'}</strong><span class="ann-medallion-unit">${event.milestone?(event.milestone===1?'AÑO':'AÑOS'):'UN DÍA'}</span><span class="ann-medallion-bottom">DE RECUPERACIÓN</span></div><span class="ann-art-caption">UNIDAD · SERVICIO · RECUPERACIÓN</span></div></section>
      <div class="ann-event-strip"><div class="ann-event-date"><span class="ann-date-number">${event.date.getDate()}</span><span><strong>${esc(month)}</strong><small>${esc(weekday)} · ${event.date.getFullYear()}</small></span></div><span class="ann-invitation-status ${past?'is-past':''}"><i class="bi ${past?'bi-check-circle':'bi-calendar-heart'}" aria-hidden="true"></i>${esc(status)}</span><a href="#ann-invitation-info" class="ann-event-anchor">Los detalles <span aria-hidden="true">↗</span></a></div>
      <div class="ann-detail-grid" id="ann-invitation-info"><section class="ann-detail-panel ann-message"><span class="ann-section-number">01 / NOS ACOMPAÑAMOS</span><h2>Tu presencia<br><em>es parte de la historia.</em></h2><p class="ann-message-text">${esc(celebration?.message || 'Acompañar una historia de recuperación es recordar que no estamos solos. Te invitamos a compartir este día con gratitud, respeto y esperanza.')}</p><div class="ann-message-signature"><span aria-hidden="true">✦</span><span>${celebration?.message?'Mensaje de invitación':'Con cariño,'}<strong>Grupo Amigos Verdaderos</strong></span></div></section>
      <section class="ann-detail-panel ann-information"><span class="ann-section-number">02 / LA CELEBRACIÓN</span><h2>Nos vemos para<br>compartir.</h2><dl class="ann-facts"><div><dt><i class="bi bi-calendar2-heart" aria-hidden="true"></i> Fecha de celebración</dt><dd>${esc(fmt(event.date))}<small>${celebration?'Fecha programada por el grupo':'Fecha del aniversario; celebración por coordinar'}</small></dd></div><div><dt><i class="bi bi-geo-alt" aria-hidden="true"></i> Lugar</dt><dd>${celebration?.confirmed?esc(celebration.location || 'Ubicación confirmada en el mapa'):'Por confirmar'}</dd></div><div><dt><i class="bi bi-clock" aria-hidden="true"></i> Hora</dt><dd>Consulta al grupo</dd></div></dl><p class="ann-original-date">Aniversario original: ${esc(fmt(event.original))}.<br>Fechas según Ecuador.</p></section></div>
      <section class="ann-map-panel"><div class="ann-map-copy"><span class="ann-section-number">03 / EL PUNTO DE ENCUENTRO</span><h2>${maps?'Aquí nos<br><em>encontramos.</em>':'Un lugar<br><em>para reunirnos.</em>'}</h2><p>${maps?esc(celebration.location || 'Ubicación confirmada de la celebración.'):'El lugar está por confirmar. Cuando el grupo lo confirme, lo encontrarás en esta invitación.'}</p>${maps?`<a class="ann-button" href="${esc(maps.link)}" target="_blank" rel="noopener">Cómo llegar <span aria-hidden="true">↗</span></a>`:'<span class="ann-pending-label"><i class="bi bi-clock" aria-hidden="true"></i> Ubicación pendiente</span>'}</div>${maps?.embed?`<iframe title="Mapa del lugar de celebración de ${esc(item.name)}" src="${esc(maps.embed)}" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>`:`<div class="ann-map-placeholder"><div class="ann-map-pin" aria-hidden="true"><i class="bi bi-geo-alt"></i></div><span>${maps?'Abre el enlace para ver la ubicación':'Pronto, un punto de encuentro'}</span><small>${maps?'Google Maps':'El mapa aparecerá al confirmar el lugar'}</small></div>`}</section>
      <footer class="ann-invitation-footer"><div><span class="ann-kicker">LA RECUPERACIÓN SE COMPARTE</span><h2>Haz llegar esta invitación.</h2><p>Una fecha. Una historia. Un grupo que acompaña.</p></div><div class="ann-actions">${shareAction}<a class="ann-button ann-whatsapp" href="https://wa.me/?text=${encodeURIComponent(`Aniversario de ${item.name} · ${fmt(event.date)}\n${link(event)}`)}" target="_blank" rel="noopener"><i class="bi bi-whatsapp" aria-hidden="true"></i> Enviar por WhatsApp</a></div></footer>
      <div class="ann-closing"><span>UNIDAD</span><span aria-hidden="true">✦</span><span>SERVICIO</span><span aria-hidden="true">✦</span><span>RECUPERACIÓN</span></div></article><p class="ann-small ann-detail-footnote">Información pública vigente. Si el grupo modifica la celebración, consulta de nuevo este enlace.</p>`;
  }
  function shareFallback(url) {
    let dialog=document.getElementById('ann-share-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='ann-share-dialog';dialog.className='ann-share-dialog';dialog.setAttribute('aria-labelledby','ann-share-title');dialog.innerHTML='<h2 id="ann-share-title">Enlace de la invitación</h2><p>Selecciona y copia este enlace para compartirlo.</p><label for="ann-share-input">Enlace</label><input id="ann-share-input" readonly><form method="dialog"><button class="ann-button ann-primary">Cerrar</button></form>';document.body.append(dialog);}
    dialog.querySelector('input').value=url;dialog.showModal();dialog.querySelector('input').select();
  }
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-share-url]');if(!button)return;
    const url=button.dataset.shareUrl,title=`Aniversario de ${button.dataset.shareName}`;
    if(navigator.share){try{await navigator.share({title,text:title,url});return;}catch(error){if(error.name==='AbortError')return;}}
    try{await navigator.clipboard.writeText(url);let note=document.getElementById('ann-share-status');if(!note){note=document.createElement('div');note.id='ann-share-status';note.className='ann-toast';note.setAttribute('role','status');document.body.append(note);}note.textContent='Enlace copiado';setTimeout(()=>note.textContent='',3500);}catch{shareFallback(url);}
  });
  window.addEventListener('anniversaries:loaded',e=>{items=e.detail;renderCalendar();renderDetail();});
  window.addEventListener('anniversaries:error',()=>{
    for(const id of ['anniversary-calendar','anniversary-detail']){const root=document.getElementById(id);if(root)root.innerHTML='<div class="ann-detail-panel" role="alert"><h2>No pudimos cargar los aniversarios</h2><p>Revisa tu conexión e intenta nuevamente.</p><button type="button" class="ann-button ann-primary" onclick="location.reload()">Reintentar</button></div>';}
  });
})();


