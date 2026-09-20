const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const row={id:'public-id',name:'Ana <img src=x onerror=alert(1)>',recovery_day:17,recovery_month:9,recovery_year:2020,public_visible:true,celebration_date:'2026-09-20',celebration_location:'Salón del grupo',celebration_latitude:0,celebration_longitude:0,celebration_message:'Te esperamos <script>alert(1)</script>',celebration_location_confirmed:true};
async function render({id='public-id',year='2026',rows=[row],extras=true,fail=false}={}) {
  const root={innerHTML:''},handlers={},docHandlers={},requests=[];
  const document={readyState:'loading',title:'',getElementById:id=>id==='anniversary-detail'?root:null,addEventListener:(name,fn)=>docHandlers[name]=fn};
  const window={addEventListener:(name,fn)=>handlers[name]=fn,dispatchEvent:e=>handlers[e.type]?.(e),setInterval:()=>{},amigosSupabase:{from(table){return{select(columns){requests.push({table,columns});return{eq(column,value){assert.equal(column,table==='anniversaries'?'public_visible':'active');assert.equal(value,true);return Promise.resolve(table==='service_contacts'?{data:[]} : fail?{error:{message:'offline'}}:columns.includes('celebration_message')&&!extras?{error:{code:'42703'}}:{data:rows.filter(r=>r.public_visible)});}};}};}}};
  const context=vm.createContext({window,document,location:new URL(`https://example.com/grupo/aniversario.html?id=${id}&year=${year}`),navigator:{},URL,URLSearchParams,Intl,Date,console:{error(){},warn(){}},Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},setTimeout});
  for(const file of ['anniversary-model.js','anniversary-experience.js','contactos-aniversarios.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js',file),'utf8'),context);
  await docHandlers.DOMContentLoaded(); return{html:root.innerHTML,requests};
}
test('enlace directo carga detalles, escapa contenido y muestra solo mapa confirmado',async()=>{
  const {html}=await render();
  assert.match(html,/Ana &lt;img/); assert.match(html,/&lt;script&gt;/); assert.doesNotMatch(html,/<script>/);
  assert.match(html,/<iframe/); assert.match(html,/q=0%2C0/); assert.match(html,/year=2026/); assert.match(html,/Te esperamos/);
});
test('lugar sin confirmar nunca incrusta mapa',async()=>{
  const {html}=await render({rows:[{...row,celebration_location_confirmed:false}]});
  assert.doesNotMatch(html,/<iframe/);assert.match(html,/El lugar está por confirmar/);
});
test('sin migración aún carga aniversario y mantiene mapa pendiente',async()=>{
  const base={...row};delete base.celebration_message;delete base.celebration_location_confirmed;
  const {html}=await render({rows:[base],extras:false});assert.match(html,/Ana/);assert.doesNotMatch(html,/<iframe/);
});
test('registros ocultos y enlaces incompletos no exponen información',async()=>{
  for(const options of [{id:'hidden',rows:[{...row,id:'hidden',public_visible:false}]},{year:'oops'},{id:'absent'}]){
    const {html}=await render(options);assert.match(html,/Invitación no disponible/);assert.doesNotMatch(html,/Ana|Te esperamos/);
  }
});
test('enlace de otro año no reutiliza mensaje ni lugar de celebración anterior',async()=>{
  const {html}=await render({year:'2027'});assert.match(html,/2027/);assert.doesNotMatch(html,/Te esperamos|<iframe/);
});
test('errores de conexión ofrecen reintento',async()=>{
  const {html}=await render({fail:true});assert.match(html,/Reintentar/);assert.doesNotMatch(html,/Cargando invitación/);
});
test('calendario permite buscar, seleccionar día y navegar de diciembre a enero',()=>{
  const elements=new Map();
  const element=()=>({innerHTML:'',textContent:'',hidden:false,dataset:{},removeAttribute(){},focus(){},addEventListener(type,fn){this[type]=fn;}});
  const previous=element(),next=element();previous.dataset.move='-1';next.dataset.move='1';
  const root={...element(),querySelector(selector){if(selector==='[data-move="-1"]')return previous;if(selector==='[data-move="1"]')return next;if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},querySelectorAll(){return[previous,next];}};
  const handlers={};const M=require('../assets/js/anniversary-model.js');
  const window={AnniversaryModel:{...M,today:()=>M.date(2026,12,15)},addEventListener:(name,fn)=>handlers[name]=fn};
  const document={getElementById:id=>id==='anniversary-calendar'?root:null,addEventListener(){}};
  const context=vm.createContext({window,document,Intl,Date,URL,URLSearchParams,location:new URL('https://example.com/index.html'),navigator:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/anniversary-experience.js'),'utf8'),context);
  handlers['anniversaries:loaded']({detail:[{id:'a',name:'Ángel',day:30,month:12,startYear:2020,celebration:{date:'2027-01-03'}}]});
  assert.match(elements.get('#ann-month-label').textContent,/diciembre de 2026/);
  assert.match(elements.get('#ann-agenda-list').innerHTML,/Ángel/);
  elements.get('#ann-search').oninput({target:{value:'angel'}});
  assert.match(elements.get('#ann-agenda-list').innerHTML,/Ángel/);
  elements.get('#ann-days').onclick({target:{closest:()=>({dataset:{day:'2026-12-29'}})}});
  assert.match(elements.get('#ann-agenda-list').innerHTML,/No hay fechas/);
  next.click();
  assert.match(elements.get('#ann-month-label').textContent,/enero de 2027/);
  assert.match(elements.get('#ann-agenda-list').innerHTML,/Celebración/);
  assert.match(elements.get('#ann-agenda-list').innerHTML,/year=2026/);
  elements.get('#ann-month-shortcuts').onclick({target:{closest:()=>({dataset:{month:'12'}})}});
  assert.match(elements.get('#ann-month-label').textContent,/diciembre de 2027/);
  assert.match(elements.get('#ann-month-shortcuts').innerHTML,/data-month="12" aria-pressed="true"/);
});
