const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/js/community-model.js');
test('Hoy usa la fecha de Ecuador incluso cuando UTC ya cambió de día',()=>{assert.equal(M.groupDay(new Date('2026-10-19T02:00:00Z')),0);assert.equal(M.groupDay(new Date('2026-10-19T05:00:00Z')),1);});
test('Búsqueda ignora tildes y combina el día con nombre o referencia',()=>{const r={group_name:'Amigos Verdaderos',city:'Santo Domingo',address:'Luz de América',weekdays:[2,4,6]};assert(M.matches(r,'america','all'));assert(M.matches(r,'AMIGOS','2'));assert(!M.matches(r,'amigos','1'));assert(!M.matches(r,'Quito','all'));});
test('Enlaces inseguros no se usan',()=>{for(const value of ['javascript:alert(1)','data:text/html,test','http://example.com',''])assert.equal(M.safeUrl(value),'');assert.equal(M.safeUrl('https://example.com/'),'https://example.com/');});
test('Enlace compartido restaura mensaje y estilo con ancla correcta',()=>{const url=new URL(M.shareUrl('https://example.com/?esperanza=viejo#inicio','hoy','ivory'));assert.equal(url.searchParams.get('esperanza'),'hoy');assert.equal(url.searchParams.get('estilo'),'ivory');assert.equal(url.hash,'#esperanza');});
test('Mensajes originales tienen identificadores únicos y acciones existentes',()=>{assert.equal(new Set(M.messages.map(m=>m.id)).size,M.messages.length);assert.equal(M.messages.length,6);assert.equal(M.questions.length,4);for(const q of M.questions)assert(['#contacto','#como-funciona','#directorio'].includes(q.href));});
