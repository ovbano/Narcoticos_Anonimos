const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/js/anniversary-model.js');
test('hora opcional, medianoche y segundos de Postgres',()=>{
  assert.equal(M.time('19:30:00'),'19:30');
  assert.equal(M.time('00:00'),'00:00');
  for(const value of [null,'','24:00','12:99','abc']) assert.equal(M.time(value),'');
});
test('mapa sin coordenadas, sin zoom forzado y con enlace prioritario',()=>{
  const link='https://www.google.com/maps/search/?api=1&query=Quito';
  const map=M.map({confirmed:true,mapUrl:link,latitude:0,longitude:0});
  assert.equal(map.link,link);
  assert.equal(new URL(map.embed).searchParams.get('q'),'Quito');
  assert.equal(new URL(map.embed).searchParams.has('z'),false);
  assert.equal(new URL(M.map({confirmed:true,latitude:0,longitude:0}).embed).searchParams.has('z'),false);
  assert.equal(M.map({confirmed:false,mapUrl:link}),null);
});
test('pin del lugar, enlace integrado y coordenadas nulas',()=>{
  const map=M.map({confirmed:true,mapUrl:'https://www.google.com/maps/place/Grupo/@0,0,18z/data=!3d-0.4027177!4d-79.2976599'});
  assert.equal(new URL(map.embed).searchParams.get('q'),'-0.4027177,-79.2976599');
  const embed='https://www.google.com/maps/embed?pb=example';
  assert.equal(M.map({confirmed:true,mapUrl:embed}).embed,embed);
  assert.equal(M.map({confirmed:true,latitude:null,longitude:null}),null);
  for(const url of ['javascript:alert(1)','https://google.com.evil/maps','https://www.google.com/url?q=x','https://user@maps.app.goo.gl/abc','https://www.google.com/maps/place/%ZZ']) assert.equal(M.mapsUrl(url),null);
});
test('resolver sigue enlaces cortos y detiene destinos ajenos a Maps',async()=>{
  const {resolveMap}=await import('../api/resolve-map.mjs');
  const short='https://maps.app.goo.gl/example';
  const target='https://www.google.com/maps?q=-0.4,-79.2';
  assert.equal(await resolveMap(short,async()=>new Response(null,{status:302,headers:{location:target}})),target);
  let calls=0;
  await assert.rejects(resolveMap(short,async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}})}));
  assert.equal(calls,1);
  await assert.rejects(resolveMap(short,async()=>new Response(null,{status:200})));
  await assert.rejects(resolveMap(short,async()=>new Response(null,{status:302,headers:{location:short}})));
});
