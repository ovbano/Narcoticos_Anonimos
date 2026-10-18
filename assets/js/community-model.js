/* Contenido original del sitio; no son citas de literatura de NA. */
(function (root) {
  'use strict';
  const messages = [
    {id:'un-paso',title:'Un paso puede abrir un camino.',text:'No necesitas tener todas las respuestas para acercarte. Puedes empezar por escuchar y conocer a otras personas en recuperación.',word:'COMIENZO'},
    {id:'acompanados',title:'La esperanza también se comparte.',text:'A veces, una conversación nos ayuda a mirar el día de otra manera. Acercarnos y escucharnos puede ser un primer paso.',word:'CONEXIÓN'},
    {id:'hoy',title:'Hoy hay espacio para empezar.',text:'El pasado forma parte de nuestra historia. Este día nos ofrece una oportunidad para pedir ayuda y dar un paso diferente.',word:'HOY'},
    {id:'pedir-ayuda',title:'Pedir ayuda puede ser el comienzo.',text:'No hace falta esperar a encontrar las palabras perfectas. Decir «quiero hablar con alguien» ya puede abrir una conversación.',word:'ESPERANZA'},
    {id:'tu-ritmo',title:'Cada paso merece su tiempo.',text:'Puedes acercarte, escuchar y hacer preguntas. Conocer un grupo no exige tener resuelto lo que estás viviendo.',word:'UN DÍA'},
    {id:'escuchar',title:'Escuchar también nos acerca.',text:'Compartir un espacio con respeto puede recordarnos que hay otras experiencias, otros caminos y personas dispuestas a acompañar.',word:'ENCUENTRO'}
  ];
  const questions = [
    {id:'ayuda',icon:'bi-chat-heart',title:'Me cuesta pedir ayuda',lead:'Puedes comenzar con una conversación.',text:'No necesitas explicar toda tu historia. Si quieres conocer el grupo, puedes preguntar por nuestros horarios o escribir a uno de nuestros contactos.',label:'Hablar con el grupo',href:'#contacto'},
    {id:'alguien',icon:'bi-people',title:'Me preocupa alguien',lead:'Informarte también es una forma de acompañar.',text:'Puedes consultar al grupo qué reuniones permiten la asistencia de familiares y amigos. La decisión de buscar recuperación corresponde a cada persona.',label:'Consultar con el grupo',href:'#contacto'},
    {id:'conocer',icon:'bi-compass',title:'Quiero conocer NA',lead:'Conoce cómo son nuestras reuniones.',text:'En el sitio encontrarás información sobre el programa, las reuniones y las preguntas más frecuentes. Puedes leerla a tu ritmo y consultar lo que necesites.',label:'Cómo funciona',href:'#como-funciona'},
    {id:'reunion',icon:'bi-calendar-week',title:'Busco una reunión',lead:'Encuentra un lugar para acercarte.',text:'Consulta los días, horarios y referencias del directorio. Si tienes dudas sobre la dirección o la modalidad, confirma con el grupo antes de ir.',label:'Explorar reuniones',href:'#directorio'}
  ];
  const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  function groupDay(date=new Date()) {return Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Guayaquil',weekday:'short'}).format(date).replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/g,x=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(x)));}
  function matches(row,query,day) {const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); return normalize([row.group_name,row.city,row.address].join(' ')).includes(normalize(query)) && (day==='all'||(row.weekdays||[]).includes(Number(day)));}
  function safeUrl(value) {try{const u=new URL(value);return u.protocol==='https:' ? u.href : '';}catch{return '';}}
  function shareUrl(base,id,theme='navy') {const u=new URL(base);u.searchParams.set('esperanza',id);u.searchParams.set('estilo',theme);u.hash='esperanza';return u.href;}
  const api={messages,questions,days,groupDay,matches,safeUrl,shareUrl};
  root.CommunityModel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
