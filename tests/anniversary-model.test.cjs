const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/js/anniversary-model.js');
const item={id:'example',name:'Compañero',month:12,day:30,startYear:2020,celebration:{date:'2027-01-03'}};
test('celebración de enero pertenece al aniversario cercano de diciembre',()=>{
  const e=M.occurrence(item,2026);
  assert.equal(M.key(e.date),'2027-01-03'); assert.equal(e.milestone,6);
  assert.equal(M.key(M.occurrence(item,2027).date),'2027-12-30');
  assert.equal(M.status(e,M.date(2027,1,3)),'¡Hoy celebramos!');
  assert.equal(M.status(e,M.date(2027,1,4)),'Celebrado');
});
test('febrero bisiesto, fechas inválidas y años futuros',()=>{
  const leap={...item,month:2,day:29,celebration:null};
  assert.equal(M.key(M.occurrence(leap,2028).date),'2028-02-29');
  assert.equal(M.key(M.occurrence(leap,2027).date),'2027-02-28');
  assert.equal(M.parse('2027-02-29'),null); assert.equal(M.parse('2027-13-01'),null);
  assert.equal(M.valid({...item,month:2,day:30}),false);
  assert.equal(M.occurrence(item,2019),null);
  assert.equal(M.occurrence(item,NaN),null);
});
test('ubicación requiere confirmación y coordenadas válidas',()=>{
  assert.equal(M.map({latitude:0,longitude:0}),null);
  assert.match(M.map({confirmed:true,latitude:0,longitude:0}).embed,/q=0%2C0/);
  assert.equal(M.map({confirmed:true,latitude:null,longitude:null}),null);
  assert.equal(M.map({confirmed:true,latitude:200,longitude:0}),null);
  assert.equal(M.map({confirmed:true,mapUrl:'javascript:alert(1)'}),null);
  assert.equal(M.map({confirmed:true,mapUrl:'https://evil.example/map'}),null);
  assert.equal(M.map({confirmed:true,mapUrl:'https://maps.app.goo.gl/example'}).embed,'');
});
test('enlace conserva identificador y año incluso en subdirectorios',()=>{
  const u=new URL(M.url(item,2026,'https://example.com/grupo/index.html'));
  assert.equal(u.pathname,'/grupo/aniversario.html');
  assert.equal(u.searchParams.get('id'),'example'); assert.equal(u.searchParams.get('year'),'2026');
});
