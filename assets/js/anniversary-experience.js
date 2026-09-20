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
    root.innerHTML=`<div class="ann-calendar-banner"><div><span class="ann-kicker">UN DÍA A LA VEZ</span><h3>Historias que celebramos juntos.</h3><p>Encuentra una fecha. Acompaña una historia.</p></div><i class="bi bi-calendar2-heart" aria-hidden="true"></i></div><nav class="ann-month-shortcuts" id="ann-month-shortcuts" aria-label="Elegir mes"></nav><div class="ann-toolbar"><div class="ann-month-nav"><button type="button" class="ann-button" data-move="-1" aria-label="Mes anterior">←</button><h3 id="ann-month-label"></h3><button type="button" class="ann-button" data-move="1" aria-label="Mes siguiente">→</button></div><button type="button" class="ann-button" id="ann-today">Este mes</button><label class="ann-search"><i class="bi bi-search" aria-hidden="true"></i><input type="search" id="ann-search" aria-label="Buscar compañero en el mes seleccionado" placeholder="Buscar en este mes…"></label></div><div class="ann-explorer-layout"><section class="ann-month-sheet" aria-labelledby="ann-month-label"><div class="ann-week" aria-hidden="true">${['L','M','X','J','V','S','D'].map(x=>`<span>${x}</span>`).join('')}</div><div class="ann-days" id="ann-days"></div><p class="ann-legend"><span>● Aniversario</span><span>● Celebración</span><span>○ Hoy</span></p></section><section class="ann-agenda"><div class="ann-agenda-heading"><h4 id="ann-agenda-title">Para acompañarnos</h4><button class="ann-button" type="button" id="ann-clear" hidden>Ver todo el mes</button></div><p id="ann-count" role="status"></p><div id="ann-agenda-list"></div></section></div>`;
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
    const rows=eventRows(), y=cursor.getFullYear(),m=cursor.getMonth()+1,now=M.key(M.today());
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
    root.querySelector('#ann-agenda-title').textContent=selected?fmt(M.parse(selected)):'Para acompañarnos';
    root.querySelector('#ann-count').textContent=`${filtered.length} ${filtered.length===1?'fecha':'fechas'}${query?' para «'+query+'»':''}`;
    root.querySelector('#ann-agenda-list').innerHTML=filtered.length?filtered.map(e=>`<a class="ann-agenda-card" href="${esc(link(e))}"><span class="ann-agenda-date">${e.day.getDate()}<small>${esc(e.kind)}</small></span><span><strong>${esc(e.item.name)}</strong><small>${e.milestone?`${e.milestone} ${e.milestone===1?'año':'años'} de recuperación`:'Un día a la vez'}</small><em>${esc(M.status(e))}</em></span><span aria-hidden="true">↗</span></a>`).join(''):'<div class="ann-no-events"><i class="bi bi-calendar2-heart" aria-hidden="true"></i><strong>No hay fechas para esta selección.</strong><p>Prueba otro día, cambia el mes o borra la búsqueda.</p></div>';
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
    root.innerHTML=`<section class="ann-invitation-hero">
      <div class="ann-hero-orbits" aria-hidden="true"></div>
      <div class="ann-invitation-brand"><img src="assets/img/logo-amigos-verdaderos.png" alt="Grupo Amigos Verdaderos" width="88" height="88"><span>GRUPO AMIGOS VERDADEROS<small>Narcóticos Anónimos</small></span></div>
      <span class="ann-invitation-status">${esc(status)}</span>
      <span class="ann-hero-overline">${past?'CELEBRAMOS SU CAMINO':'ESTÁS INVITADO A COMPARTIR'}</span>
      <h1>${esc(item.name)}</h1>
      <div class="ann-years-seal"><span class="ann-seal-number">${event.milestone || 'HOY'}</span><span>${event.milestone?(event.milestone===1?'AÑO':'AÑOS'):'UN DÍA'}<small>DE RECUPERACIÓN</small></span></div>
      <p class="ann-hero-sentiment">Una historia de esperanza.<br>Una celebración que nos une.</p>
      <a class="ann-hero-link" href="#ann-invitation-info">Ver la invitación <span aria-hidden="true">↓</span></a>
      <div class="ann-date-ribbon"><span>${esc(weekday)}</span><strong>${event.date.getDate()}</strong><span>${esc(month)}<small>${event.date.getFullYear()}</small></span></div>
    </section>
    <div class="ann-values" aria-label="Principios del grupo"><span>UNIDAD</span><i aria-hidden="true">✦</i><span>SERVICIO</span><i aria-hidden="true">✦</i><span>RECUPERACIÓN</span></div>
      <div class="ann-detail-grid" id="ann-invitation-info"><section class="ann-detail-panel"><span class="ann-kicker">UNA FECHA PARA COMPARTIR</span><h2>${esc(fmt(event.date))}</h2><dl class="ann-facts"><div><dt>Fecha original del aniversario</dt><dd>${esc(fmt(event.original))}</dd></div><div><dt>Celebración</dt><dd>${celebration?'Fecha programada por el grupo':'Sin fecha adicional programada'}</dd></div><div><dt>Lugar</dt><dd>${celebration?.confirmed?esc(celebration.location || 'Ubicación confirmada en el mapa'):'Por confirmar'}</dd></div></dl><p class="ann-small">Fechas según Ecuador. Consulta al grupo para confirmar la hora.</p><div class="ann-actions"><button class="ann-button ann-primary" type="button" data-share-url="${esc(link(event))}" data-share-name="${esc(item.name)}"><i class="bi bi-share"></i> Compartir invitación</button><a class="ann-button" href="https://wa.me/?text=${encodeURIComponent(`Aniversario de ${item.name} · ${fmt(event.date)}\n${link(event)}`)}" target="_blank" rel="noopener">WhatsApp</a></div></section>
      <section class="ann-detail-panel ann-message"><i class="bi bi-chat-heart" aria-hidden="true"></i><span class="ann-kicker">${celebration?.message?'MENSAJE DE INVITACIÓN':'PARA ACOMPAÑARNOS'}</span><h2>Tu presencia<br>también cuenta.</h2><p class="ann-message-text">${esc(celebration?.message || 'Acompañar una historia de recuperación es recordar que no estamos solos. Compartamos este día con respeto, gratitud y esperanza.')}</p><small>Grupo Amigos Verdaderos</small></section></div>
      <section class="ann-detail-panel ann-map-panel"><div><span class="ann-kicker">PUNTO DE ENCUENTRO</span><h2>${maps?'Nos encontramos aquí':'El lugar está por confirmar'}</h2><p>${maps?esc(celebration.location || 'Consulta la ubicación de la celebración.'):'Cuando el grupo confirme el lugar, la ubicación aparecerá en esta misma invitación.'}</p>${maps?`<a class="ann-button ann-primary" href="${esc(maps.link)}" target="_blank" rel="noopener">Abrir en Google Maps ↗</a>`:''}</div>${maps?.embed?`<iframe title="Mapa del lugar de celebración de ${esc(item.name)}" src="${esc(maps.embed)}" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>`:`<div class="ann-map-placeholder" aria-hidden="true"><i class="bi bi-geo-alt"></i></div>`}</section><p class="ann-small ann-detail-footnote">La invitación muestra la información pública vigente. Si el grupo modifica la celebración, consulta de nuevo este enlace.</p>`;
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

