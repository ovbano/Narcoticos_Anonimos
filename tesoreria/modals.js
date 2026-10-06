/* Presentation-only enhancements; financial validation remains in app.js. */
(() => {
  'use strict';
  const changed = new WeakSet();
  const prompts = new WeakMap();
  const icons = {'entry-dialog':'wallet2','member-dialog':'person-plus','password-dialog':'shield-lock','activity-dialog':'people'};
  const icon = name => `<i class="bi bi-${name}" aria-hidden="true"></i>`;
  const dialogs = [...document.querySelectorAll('dialog')];
  function pending(d) {
    return [...d.querySelectorAll('button[type="submit"], #save-draft, #post-entry')].some(b => !b.hidden && b.disabled);
  }
  function requestClose(d, done, forceDirty = false) {
    if (pending(d)) return;
    if (!changed.has(d) && !forceDirty) { done(); return; }
    if (prompts.has(d)) return;
    const previous = document.activeElement;
    const panel = document.createElement('div');
    panel.className = 'discard-confirm'; panel.setAttribute('role','alertdialog');
    panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby',d.id+'-discard-title');
    panel.innerHTML = `<div><span class="discard-icon">${icon('exclamation-circle')}</span><h3 id="${d.id}-discard-title">¿Salir sin guardar?</h3><p>Los cambios de este formulario se perderán. Puedes seguir completándolo.</p><div class="discard-actions"><button type="button" class="primary" data-keep>Seguir editando</button><button type="button" class="secondary" data-leave>Descartar cambios</button></div></div>`;
    const form = d.querySelector('form'); form.inert = true; d.append(panel); prompts.set(d,{panel,form});
    function remove() { form.inert=false; panel.remove(); prompts.delete(d); }
    panel.querySelector('[data-keep]').onclick=()=>{remove();previous?.focus();};
    panel.querySelector('[data-leave]').onclick=()=>{remove();changed.delete(d);done();};
    panel.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();remove();previous?.focus();}
      if(e.key==='Tab'){const buttons=[...panel.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[1].focus();}else if(!e.shiftKey&&document.activeElement===buttons[1]){e.preventDefault();buttons[0].focus();}}
    });
    panel.querySelector('[data-keep]').focus();
  }
  for (const d of dialogs) {
    d.classList.add('treasury-modal');
    const form=d.querySelector('form');
    let heading=form.querySelector('.dialog-heading');
    const title=form.querySelector('h2');
    if (!title.id) title.id=d.id+'-title';
    d.setAttribute('aria-labelledby',title.id);
    if (!heading) { heading=document.createElement('div');heading.className='dialog-heading';title.before(heading);heading.append(title); }
    const badge=document.createElement('span');badge.className='modal-heading-icon';badge.innerHTML=icon(icons[d.id]);heading.prepend(badge);
    if (!heading.querySelector('[data-close]')) { const close=document.createElement('button');close.type='button';close.className='close';close.dataset.close=d.id;close.setAttribute('aria-label','Cerrar');close.innerHTML=icon('x-lg');heading.append(close); }
    let actions=form.querySelector('.dialog-actions');
    if(!actions){actions=d.id==='activity-dialog'?form.querySelector('.button-row'):document.createElement('div');actions.classList.add('dialog-actions');if(d.id==='password-dialog'){form.append(actions);actions.append(form.querySelector('button[type="submit"]'));}}
    const body=document.createElement('div');body.className='modal-body';
    [...form.children].filter(el=>el!==heading&&el!==actions).forEach(el=>body.append(el));form.append(heading,body,actions);
    d.addEventListener('input',()=>changed.add(d));d.addEventListener('change',()=>changed.add(d));
    d.addEventListener('close',()=>{changed.delete(d);const p=prompts.get(d);if(p){p.form.inert=false;p.panel.remove();prompts.delete(d);}if(d.id==='password-dialog'){form.reset();const hint=form.querySelector('.password-feedback');if(hint){hint.textContent='';hint.classList.remove('matches');}form.querySelectorAll('[data-password-toggle]').forEach(b=>{const input=document.getElementById(b.dataset.passwordToggle);input.type='password';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Mostrar contraseña');b.innerHTML=icon('eye');});}});
    new MutationObserver(()=>{if(d.open){changed.delete(d);updateSummary();}}).observe(d,{attributes:true,attributeFilter:['open']});
    if(d.id!=='entry-dialog')d.addEventListener('cancel',e=>{e.preventDefault();e.stopImmediatePropagation();requestClose(d,()=>d.close());},true);
  }
  // The movement modal keeps its own saving/dirty guards in app.js.
  document.addEventListener('click',e=>{const b=e.target.closest('[data-close],#activity-close');if(!b)return;const d=b.closest('dialog');if(!d||d.id==='entry-dialog')return;e.preventDefault();e.stopImmediatePropagation();requestClose(d,()=>d.close());},true);
  const entry=document.querySelector('#entry-dialog');
  const summary=document.createElement('div');summary.className='movement-preview';summary.setAttribute('aria-live','polite');summary.setAttribute('aria-atomic','true');entry.querySelector('.modal-body').prepend(summary);
  function updateSummary(){const f=entry.querySelector('form').elements;const n=Number(f.amount.value.replace(',','.'));const amount=f.amount.value&&Number.isFinite(n)&&n>=0?new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(n):'Ingresa el monto';const incoming=f.kind.value==='income';summary.dataset.kind=incoming?'income':'expense';summary.innerHTML=`<span class="preview-icon">${icon(incoming?'arrow-down-left':'arrow-up-right')}</span><div><span>${incoming?'Ingreso':'Gasto'} · ${f.fund.value==='rent'?'Fondo del local':'Fondo general'}</span><strong></strong></div>`;summary.querySelector('strong').textContent=amount;}
  entry.addEventListener('input',updateSummary);entry.addEventListener('change',()=>queueMicrotask(updateSummary));
  const passwordForm=document.querySelector('#password-form');
  passwordForm.querySelectorAll('input[type="password"]').forEach((input,i)=>{input.id ||= 'secure-password-'+i;const wrap=document.createElement('span');wrap.className='password-control';input.before(wrap);wrap.append(input);const b=document.createElement('button');b.type='button';b.dataset.passwordToggle=input.id;b.setAttribute('aria-label','Mostrar contraseña');b.setAttribute('aria-pressed','false');b.innerHTML=icon('eye');wrap.append(b);b.onclick=()=>{const visible=input.type==='password';input.type=visible?'text':'password';b.setAttribute('aria-pressed',String(visible));b.setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');b.innerHTML=icon(visible?'eye-slash':'eye');};});
  const feedback=document.createElement('p');feedback.className='password-feedback';feedback.setAttribute('aria-live','polite');passwordForm.querySelector('.modal-body').append(feedback);
  passwordForm.addEventListener('input',()=>{const a=passwordForm.elements.new_password.value,b=passwordForm.elements.confirm_password.value;feedback.textContent=!a&&!b?'':a.length<12?'Usa al menos 12 caracteres.':!b?'Repite la contraseña para confirmarla.':a===b?'Las contraseñas coinciden.':'Las contraseñas todavía no coinciden.';feedback.classList.toggle('matches',a.length>=12&&a===b);});
  window.TreasuryModals={requestClose};
})();
