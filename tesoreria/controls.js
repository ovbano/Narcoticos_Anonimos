/* Progressive controls: original fields remain the source of truth. */
(() => {
  'use strict';
  if (!('showPopover' in HTMLElement.prototype)) return;
  let active = null, serial = 0;
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const pad = n => String(n).padStart(2,'0');
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function button(text, action, cls='') {
    const b=document.createElement('button'); b.type='button'; b.textContent=text; b.className=cls;
    b.addEventListener('click',action); return b;
  }
  function commit(input,value) {
    if(input.disabled || input.readOnly) return;
    input.value=value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    close(true);
  }
  function close(focus=false) {
    if(!active)return;
    const {panel,anchor}=active; active=null;
    panel.hidePopover(); panel.remove(); anchor.setAttribute('aria-expanded','false');
    if(focus)anchor.focus({preventScroll:true});
  }
  function open(anchor,label) {
    close();
    const panel=document.createElement('div'); panel.className='treasury-popover'; panel.popover='auto';
    panel.id='treasury-control-'+(++serial); panel.setAttribute('role','dialog');panel.setAttribute('aria-label',label);
    (anchor.closest('dialog') || document.body).append(panel);
    anchor.setAttribute('aria-expanded','true');anchor.setAttribute('aria-controls',panel.id);
    active={anchor,panel};
    panel.addEventListener('toggle',e=>{if(e.newState==='closed' && active?.panel===panel){active=null;anchor.setAttribute('aria-expanded','false');panel.remove();}});
    panel.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}
      if(e.key==='Tab'){e.preventDefault();const items=[...panel.querySelectorAll('button:not(:disabled),input')];const at=items.indexOf(document.activeElement);items[(at+(e.shiftKey?-1:1)+items.length)%items.length]?.focus();}
    });
    return panel;
  }
  function position(panel,anchor) {
    const r=anchor.getBoundingClientRect();
    const width=Math.min(Math.max(r.width,310),window.innerWidth-24);
    panel.style.width=width+'px';
    panel.style.left=Math.max(12,Math.min(r.left,window.innerWidth-width-12))+'px';
    const height=panel.getBoundingClientRect().height;
    panel.style.top=Math.max(12,Math.min(r.bottom+8,window.innerHeight-height-12))+'px';
  }
  function show(panel,anchor) {
    panel.showPopover();
    position(panel,anchor);
    panel.querySelector('[aria-selected="true"],button:not(:disabled),input')?.focus({preventScroll:true});
  }
  document.querySelectorAll('select').forEach(select=>{
    select.classList.add('enhanced-select');select.setAttribute('aria-haspopup','dialog');
    function chooser(){
      if(select.disabled)return;
      const panel=open(select,select.labels?.[0]?.childNodes[0]?.textContent.trim() || 'Elegir opción');
      const title=document.createElement('div');title.className='control-caption';title.textContent='Selecciona una opción';panel.append(title);
      const list=document.createElement('div');list.className='control-options';list.setAttribute('role','listbox');list.setAttribute('aria-label','Opciones');
      const options=[...select.options];
      function render(query=''){
        list.replaceChildren();
        const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        options.filter(o=>!o.hidden&&normalize(o.textContent).includes(normalize(query))).forEach(o=>{
          const b=button(o.textContent,()=>commit(select,o.value));b.disabled=o.disabled||o.parentElement.disabled;
          b.setAttribute('role','option');b.setAttribute('aria-selected',String(o.selected));list.append(b);
        });
        if(!list.children.length){const p=document.createElement('p');p.textContent='No hay coincidencias.';list.append(p);}
      }
      if(options.length>6){const search=document.createElement('input');search.type='search';search.placeholder='Buscar opción…';search.setAttribute('aria-label','Buscar opción');search.addEventListener('input',()=>render(search.value));panel.append(search);}
      panel.append(list);render();
      panel.addEventListener('keydown',e=>{
        if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key)||e.target.matches('input'))return;
        e.preventDefault();const all=[...list.querySelectorAll('button:not(:disabled)')],i=all.indexOf(document.activeElement);
        all[e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowUp'?-1:1)+all.length)%all.length]?.focus();
      });show(panel,select);
    }
    // Opening during pointerdown lets the same gesture dismiss the popover on release.
    // Suppress the native picker, then open only after the completed click.
    select.addEventListener('pointerdown',e=>{if(e.button===0&&!select.disabled)e.preventDefault();});
    select.addEventListener('click',e=>{e.preventDefault();if(active?.anchor!==select)chooser();});
    select.addEventListener('keydown',e=>{if(['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();chooser();}});
  });
  document.querySelectorAll('input[type="date"],input[type="month"]').forEach(input=>{
    const wrap=document.createElement('span');wrap.className='calendar-field';input.before(wrap);wrap.append(input);
    const trigger=button('',calendar,'calendar-trigger');trigger.innerHTML='<i class="bi bi-calendar3" aria-hidden="true"></i>';
    trigger.setAttribute('aria-label',input.type==='month'?'Elegir mes':'Elegir fecha');trigger.setAttribute('aria-haspopup','dialog');wrap.append(trigger);
    const sync=()=>{trigger.disabled=input.disabled||input.readOnly;};sync();new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled','readonly']});
    function calendar(){
      if(input.disabled||input.readOnly)return;
      const monthly=input.type==='month',initial=input.value||today();let [year,month]=initial.split('-').map(Number);month--;
      const panel=open(trigger,monthly?'Seleccionar período':'Seleccionar fecha');
      const allowed=value=>(!input.min||value>=input.min)&&(!input.max||value<=input.max);
      function headerFocus(delta){panel.querySelectorAll(".calendar-heading button")[delta<0?0:1]?.focus();}
      function render(){
        panel.replaceChildren();const header=document.createElement('div');header.className='calendar-heading';
        const shift=delta=>{if(monthly)year+=delta;else{month+=delta;if(month<0){month=11;year--;}if(month>11){month=0;year++;}}year=Math.max(1,Math.min(year,9999));render();headerFocus(delta);};
        const prev=button('‹',()=>shift(-1)),next=button('›',()=>shift(1));prev.setAttribute('aria-label',monthly?'Año anterior':'Mes anterior');next.setAttribute('aria-label',monthly?'Año siguiente':'Mes siguiente');
        const heading=document.createElement('strong');heading.textContent=monthly?String(year):`${months[month]} ${year}`;heading.setAttribute('aria-live','polite');header.append(prev,heading,next);panel.append(header);
        const grid=document.createElement('div');grid.className=monthly?'calendar-months':'calendar-days';
        if(!monthly){['L','M','X','J','V','S','D'].forEach(day=>{const s=document.createElement('span');s.textContent=day;s.className='calendar-weekday';grid.append(s);});let offset=(new Date(year,month,1).getDay()+6)%7;while(offset--)grid.append(document.createElement('span'));}
        const count=monthly?12:new Date(year,month+1,0).getDate();
        for(let n=0;n<count;n++){
          const value=`${String(year).padStart(4,'0')}-${pad(monthly?n+1:month+1)}${monthly?'':'-'+pad(n+1)}`;
          const b=button(monthly?months[n].slice(0,3):String(n+1),()=>commit(input,value));b.disabled=!allowed(value);
          b.setAttribute('aria-label',monthly?`${months[n]} ${year}`:`${n+1} de ${months[month]} de ${year}`);
          if(value===input.value){b.classList.add('is-selected');b.setAttribute('aria-current','true');}
          if(value===today().slice(0,monthly?7:10))b.classList.add('is-today');grid.append(b);
        }
        panel.append(grid);const footer=document.createElement('div');footer.className='calendar-footer';
        const current=today().slice(0,monthly?7:10),now=button(monthly?'Mes actual':'Hoy',()=>commit(input,current));now.disabled=!allowed(current);footer.append(now);
        if(!input.required)footer.append(button('Borrar',()=>commit(input,'')));
        footer.append(button('Cerrar',()=>close(true)));panel.append(footer);
      }
      panel.addEventListener('keydown',e=>{
        const grid=e.target.closest('.calendar-days,.calendar-months');
        if(!grid || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
        e.preventDefault();
        const buttons=[...grid.querySelectorAll('button')],at=buttons.indexOf(e.target),columns=monthly?3:7;
        let target=e.key==='Home'?0:e.key==='End'?buttons.length-1:at+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[e.key]);
        const step=target<at?-1:1;
        while(target>=0&&target<buttons.length&&buttons[target].disabled)target+=step;
        buttons[target]?.focus();
      });
      render();show(panel,trigger);
    }
  });
  let repositionFrame=0;
  function reposition(){
    if(!active || repositionFrame)return;
    repositionFrame=requestAnimationFrame(()=>{
      repositionFrame=0;
      if(active)position(active.panel,active.anchor);
    });
  }
  window.addEventListener('resize',reposition);
  document.addEventListener('close',e=>{if(e.target.matches('dialog'))close();},true);
  // Focus, the mobile keyboard and scrolling a modal must not dismiss a choice.
  document.addEventListener('scroll',e=>{if(active&&!active.panel.contains(e.target))reposition();},true);
  window.visualViewport?.addEventListener('resize',reposition);
})();
