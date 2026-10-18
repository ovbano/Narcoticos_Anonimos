(() => {
  'use strict';
  const M=window.CommunityModel;if(!M)return;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selected=M.messages[0],theme='navy',meetings=[],loaded=false,returnFocus=null;
  const status=text=>{$('#community-status').textContent=text;};
  const paintMessage=()=>{
    for(const target of ['#hope-preview','#hope-dialog-card']){
      const el=$(target);el.dataset.theme=theme;
      el.querySelector('[data-hope-title]').textContent=selected.title;
      el.querySelector('[data-hope-text]').textContent=selected.text;
      el.querySelector('[data-hope-word]').textContent=selected.word;
    }
    document.querySelectorAll('[data-message]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.message===selected.id)));
    document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===theme)));
  };
  const chooseQuestion=id=>{
    const q=M.questions.find(x=>x.id===id)||M.questions[0];
    document.querySelectorAll('[data-question]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.question===q.id)));
    $('#question-answer').innerHTML=`<span class="community-kicker">UN ESPACIO PARA TI</span><h3>${esc(q.lead)}</h3><p>${esc(q.text)}</p><a class="community-button" href="${q.href}">${esc(q.label)} <i class="bi bi-arrow-up-right" aria-hidden="true"></i></a>`;
  };
  const link=()=>M.shareUrl(location.href,selected.id,theme);
  async function copyLink(){try{await navigator.clipboard.writeText(link());status('Enlace copiado. Puedes pegarlo donde quieras compartirlo.');}catch{$('#hope-share-url').hidden=false;$('#hope-share-url').value=link();$('#hope-share-url').focus();$('#hope-share-url').select();status('Selecciona y copia el enlace que aparece debajo.');}}
  async function share(){try{if(navigator.share){await navigator.share({title:'Una tarjeta de esperanza · Amigos Verdaderos',text:selected.title,url:link()});status('');}else await copyLink();}catch(e){if(e.name!=='AbortError')await copyLink();}}
  function lines(ctx,text,width){const result=[];let line='';for(const word of text.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){result.push(line);line=word;}else line=next;}if(line)result.push(line);return result;}
  async function makeImage(){
    const item=selected,palette=theme;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Imagen no disponible');
    const light=palette==='ivory',ink=light?'#102650':'#fffaf0',gold=light?'#866526':'#e7c887';
    const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,light?'#fffdf7':palette==='night'?'#121e30':'#061d4b');bg.addColorStop(1,light?'#eee5d3':palette==='night'?'#080e18':'#173a78');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
    ctx.strokeStyle=gold;ctx.lineWidth=2;ctx.strokeRect(40,40,1000,1270);ctx.globalAlpha=.4;ctx.strokeRect(54,54,972,1242);ctx.globalAlpha=1;
    const img=new Image();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('El logo tardó en cargar. Intenta de nuevo.')),10000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('No se pudo cargar el logo.'));};img.src='assets/img/logo-amigos-verdaderos.png';});
    const ratio=Math.min(154/img.width,154/img.height);ctx.drawImage(img,540-img.width*ratio/2,100,img.width*ratio,img.height*ratio);
    ctx.textAlign='center';ctx.fillStyle=gold;ctx.font='600 21px sans-serif';ctx.fillText('GRUPO AMIGOS VERDADEROS',540,300);ctx.font='18px sans-serif';ctx.fillText('NARCÓTICOS ANÓNIMOS',540,335);
    ctx.fillStyle=gold;ctx.font='20px sans-serif';ctx.fillText(item.word,540,435);
    ctx.fillStyle=ink;ctx.font='64px Georgia, serif';let y=520;for(const line of lines(ctx,item.title,820)){ctx.fillText(line,540,y);y+=80;}
    ctx.strokeStyle=gold;ctx.beginPath();ctx.moveTo(430,y+22);ctx.lineTo(650,y+22);ctx.stroke();
    ctx.fillStyle=ink;ctx.font='30px sans-serif';y+=105;for(const line of lines(ctx,item.text,780)){ctx.fillText(line,540,y);y+=46;}
    ctx.fillStyle=gold;ctx.font='italic 29px Georgia, serif';ctx.fillText('Un día a la vez, juntos.',540,1135);
    ctx.font='18px sans-serif';ctx.fillText('Mensaje original de nuestro sitio',540,1190);ctx.fillText(location.hostname,540,1230);
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }
  async function download(button){const imageId=selected.id;button.disabled=true;status('Preparando tu tarjeta…');try{const blob=await makeImage();if(!blob)throw Error('No se pudo crear la tarjeta.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`esperanza-${imageId}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Tarjeta preparada. Si tu navegador la abre, mantén pulsada la imagen para guardarla.');}catch(e){status(e.message||'No se pudo descargar. Intenta nuevamente.');}finally{button.disabled=false;}}
  function renderMeetings(){
    const q=$('#meeting-query').value,day=$('#meeting-day').value;
    const rows=meetings.filter(x=>M.matches(x,q,day));
    $('#meeting-count').textContent=`${rows.length} ${rows.length===1?'grupo encontrado':'grupos encontrados'}`;
    $('#meeting-results').innerHTML=rows.length?rows.map(row=>`<article class="directory-card"><div class="directory-card-top"><span class="community-kicker">${esc(row.city)}</span><i class="bi bi-geo-alt" aria-hidden="true"></i></div><h3>${esc(row.group_name)}</h3><p>${esc(row.address)}</p><div class="directory-days">${row.weekdays.map(d=>`<span>${esc(M.days[d])}</span>`).join('')}</div><div class="directory-time"><i class="bi bi-clock" aria-hidden="true"></i><strong>${esc(row.meeting_time.slice(0,5))}</strong><span>Hora de Ecuador</span></div>${row.notes?`<p class="directory-note">${esc(row.notes)}</p>`:''}<div class="directory-actions"><button type="button" class="community-button community-button-outline" data-map="${esc(row.id)}">Ver ubicación <i class="bi bi-arrow-up-right" aria-hidden="true"></i></button>${row.contact_phone?`<a class="directory-contact" href="https://wa.me/${esc(row.contact_phone.replace(/\D/g,''))}" target="_blank" rel="noopener">Consultar <i class="bi bi-whatsapp" aria-hidden="true"></i></a>`:''}</div><small class="directory-verified">Datos revisados: ${esc(new Intl.DateTimeFormat('es-EC',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Guayaquil'}).format(new Date(row.verified_at)))}</small></article>`).join(''):'<div class="community-empty"><i class="bi bi-search" aria-hidden="true"></i><h3>No hay coincidencias con estos filtros.</h3><p>Prueba otro día o borra el nombre que buscaste.</p><button class="community-button community-button-outline" type="button" id="meeting-clear">Ver todos los grupos</button></div>';
    $('#meeting-clear')?.addEventListener('click',()=>{$('#meeting-query').value='';$('#meeting-day').value='all';renderMeetings();});
    document.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>showMap(b.dataset.map)));
    document.querySelectorAll('[data-day-filter]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.dayFilter==='today'?String(M.groupDay()):'all')===day)));
  }
  function showMap(id){const row=meetings.find(x=>x.id===id);if(!row)return;const link=M.safeUrl(row.map_url)||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.address+', '+row.city)}`;$('#directory-map').hidden=false;$('#directory-map-title').textContent=row.group_name;$('#directory-map-copy').textContent=row.exact_location?'Ubicación confirmada por el grupo.':'Ubicación referencial. Confirma la dirección con el grupo antes de ir.';$('#directory-map-link').href=link;$('#directory-map-frame').src=`https://www.google.com/maps?q=${encodeURIComponent(row.address+', '+row.city)}&output=embed`;$('#directory-map-title').focus();$('#directory-map').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});}
  async function loadMeetings(){if(loaded)return;$('#meeting-load').textContent='Consultando los grupos del directorio…';$('#meeting-load').hidden=false;$('#meeting-retry').hidden=true;try{if(!window.amigosSupabase)throw Error('Sin conexión');const {data,error}=await window.amigosSupabase.from('public_meetings').select('id,group_name,city,address,weekdays,meeting_time,notes,map_url,contact_phone,exact_location,verified_at').eq('published',true).order('group_name').abortSignal(AbortSignal.timeout(12000));if(error)throw error;meetings=data||[];loaded=true;$('#meeting-load').hidden=true;renderMeetings();}catch{$('#meeting-load').textContent='No pudimos consultar el directorio. Puedes ver los horarios de Amigos Verdaderos en la sección Reuniones.';$('#meeting-retry').hidden=false;}}
  function init(){
    $('#question-options').innerHTML=M.questions.map(q=>`<button type="button" data-question="${q.id}" aria-pressed="false" aria-controls="question-answer"><i class="bi ${q.icon}" aria-hidden="true"></i><span>${q.title}</span><i class="bi bi-arrow-up-right" aria-hidden="true"></i></button>`).join('');
    document.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>chooseQuestion(b.dataset.question)));chooseQuestion('ayuda');
    $('#hope-message-list').innerHTML=M.messages.map((m,i)=>`<button type="button" data-message="${m.id}" aria-pressed="false"><span>0${i+1}</span><strong>${m.title}</strong><i class="bi bi-arrow-right" aria-hidden="true"></i></button>`).join('');
    document.querySelectorAll('[data-message]').forEach(b=>b.addEventListener('click',()=>{selected=M.messages.find(m=>m.id===b.dataset.message);paintMessage();}));
    document.querySelectorAll('[data-palette]').forEach(b=>b.addEventListener('click',()=>{theme=b.dataset.palette;paintMessage();}));
    const params=new URLSearchParams(location.search);selected=M.messages.find(m=>m.id===params.get('esperanza'))||M.messages[0];theme=['navy','ivory','night'].includes(params.get('estilo'))?params.get('estilo'):'navy';paintMessage();
    $('#hope-download').addEventListener('click',e=>download(e.currentTarget));$('#hope-share').addEventListener('click',share);$('#hope-copy').addEventListener('click',copyLink);
    const dialog=$('#hope-dialog');$('#hope-expand').addEventListener('click',()=>{returnFocus=document.activeElement;dialog.showModal();});$('#hope-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus?.focus());
    $('#meeting-day').innerHTML='<option value="all">Todos los días</option>'+M.days.map((d,i)=>`<option value="${i}">${d}</option>`).join('');$('#meeting-query').addEventListener('input',renderMeetings);$('#meeting-day').addEventListener('change',renderMeetings);document.querySelectorAll('[data-day-filter]').forEach(b=>b.addEventListener('click',()=>{$('#meeting-day').value=b.dataset.dayFilter==='today'?String(M.groupDay()):'all';renderMeetings();}));$('#meeting-retry').addEventListener('click',loadMeetings);$('#directory-map-close').addEventListener('click',()=>{$('#directory-map').hidden=true;$('#directory-map-frame').src='about:blank';document.querySelector('[data-map]')?.focus();});
    if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){loadMeetings();observer.disconnect();}},{rootMargin:'300px'});observer.observe($('#directorio'));}else loadMeetings();
  }
  document.addEventListener('DOMContentLoaded',init,{once:true});
})();
