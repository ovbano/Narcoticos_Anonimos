(() => {
  'use strict';
  const db=window.amigosSupabase,$=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let rows=[],ticket=0;
  const tell=(text,error=false)=>{const el=$('#directory-admin-status');el.textContent=text;el.className=error?'directory-admin-status is-error':'directory-admin-status';};
  const reset=()=>{$('#directory-admin-form').reset();$('#directory-entry-id').value='';$('#directory-edit-title').textContent='Añadir un grupo';$('#directory-entry-published').checked=false;$('#directory-entry-days').querySelectorAll('input').forEach(e=>e.checked=false);};
  function render(){
    $('#directory-admin-list').innerHTML=rows.length?rows.map(r=>`<article class="directory-admin-row"><div><span class="directory-publication ${r.published?'is-published':''}">${r.published?'Publicado':'Borrador / oculto'}</span><h3>${esc(r.group_name)}</h3><p>${esc(r.city)} · ${esc(r.meeting_time.slice(0,5))} · ${r.weekdays.map(d=>['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d]).join(', ')}</p></div><button type="button" class="btn-secondary" data-edit-meeting="${esc(r.id)}"><i class="bi bi-pencil-square" aria-hidden="true"></i> Editar</button></article>`).join(''):'<p class="empty-state">Todavía no hay grupos registrados.</p>';
    document.querySelectorAll('[data-edit-meeting]').forEach(b=>b.onclick=()=>{
      const r=rows.find(x=>x.id===b.dataset.editMeeting);if(!r)return;reset();$('#directory-entry-id').value=r.id;
      for(const key of ['group_name','city','address','meeting_time','notes','map_url','contact_phone','source_url'])$('#directory-admin-form').elements[key].value=r[key]||'';
      $('#directory-entry-published').checked=r.published;$('#directory-entry-exact').checked=r.exact_location;document.querySelectorAll('#directory-entry-days input').forEach(e=>e.checked=r.weekdays.includes(Number(e.value)));$('#directory-edit-title').textContent='Editar '+r.group_name;$('#directory-entry-name').focus();$('#directory-admin-form').scrollIntoView({behavior:'smooth',block:'start'});
    });
  }
  async function load(){const current=++ticket;tell('Consultando el directorio…');try{const {data,error}=await db.from('public_meetings').select('*').order('group_name').abortSignal(AbortSignal.timeout(12000));if(current!==ticket)return;if(error)throw error;rows=data||[];render();tell(`${rows.length} registros. Solo los publicados aparecen en la página.`);}catch(e){if(current===ticket)tell(e.message||'No se pudo consultar el directorio.',true);}}
  function safeUrl(value){if(!value)return '';const u=new URL(value);if(u.protocol!=='https:')throw Error('Los enlaces deben comenzar con https://');return u.href;}
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('[data-tab="directory"]')?.addEventListener('click',load);
    $('#directory-admin-refresh').onclick=load;$('#directory-admin-reset').onclick=()=>{reset();tell('Formulario listo para un nuevo grupo.');};
    $('#directory-admin-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]'),current=ticket;button.disabled=true;tell('Guardando…');try{
      const value=name=>form.elements[name].value.trim();
      const weekdays=[...document.querySelectorAll('#directory-entry-days input:checked')].map(e=>Number(e.value));if(!weekdays.length)throw Error('Selecciona al menos un día de reunión.');
      const published=$('#directory-entry-published').checked,source=safeUrl(value('source_url'));if(published&&!source)throw Error('Añade una fuente de verificación antes de publicar. Puede ser la página oficial del grupo o un enlace a su información pública.');
      const payload={group_name:value('group_name'),city:value('city'),address:value('address'),weekdays,meeting_time:value('meeting_time'),notes:value('notes'),map_url:safeUrl(value('map_url')),contact_phone:value('contact_phone'),source_url:source,exact_location:$('#directory-entry-exact').checked,published,verified_at:published?new Date().toISOString():null,updated_at:new Date().toISOString()};
      const id=$('#directory-entry-id').value;const query=id?db.from('public_meetings').update(payload).eq('id',id):db.from('public_meetings').insert(payload);const {data,error}=await query.select('id').single();if(error)throw error;if(!data)throw Error('No se guardaron los datos.');if(current!==ticket)return;reset();await load();tell('Grupo guardado. '+(published?'Ya aparece en el directorio público.':'Permanece oculto al público.'));
    }catch(error){if(current===ticket)tell(error.message||'No se pudo guardar.',true);}finally{button.disabled=false;}};
    // El cierre de sesión del panel invalida consultas pendientes y limpia sus datos.
    const clear=()=>{ticket++;rows=[];reset();$('#directory-admin-list').replaceChildren();tell('');};
    document.addEventListener('site:session-cleared',clear);
  },{once:true});
})();
