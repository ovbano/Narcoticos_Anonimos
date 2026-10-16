const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const D = require('../tesoreria/dues.js'), M=require('../tesoreria/model.js');
const account={id:'member-1',name:'José <script>alert(1)</script>',previous_pending:1200,current_pending:600,total_pending:1800,months_pending:2,periods:[{month:'2026-09-01',expected:1200,paid:0,pending:1200,credit:0},{month:'2026-10-01',expected:1200,paid:600,pending:600,credit:0}]};
test('accumulated totals keep previous and current months separate',()=>assert.deepEqual(D.totals([account]),{previous_pending:1200,current_pending:600,total_pending:1800}));
test('name filtering ignores accents and distinguishes paid/unpaid accounts',()=>{assert.equal(D.filter([account],'jose','pending').length,1);assert.equal(D.filter([account],'jose','settled').length,0);});
test('HTML escapes names and passes the original month and pending cents to payment buttons',()=>{const html=D.card(account,true);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('data-payment-month="2026-09"'));assert.ok(html.includes('data-payment-amount="1200"'));assert.ok(!D.card(account,false).includes('data-payment='));});
test('closed financial reports retain their original balances and include the new arrears annex',()=>{
  const window={TreasuryModel:M};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tesoreria/report.js'),'utf8'),{window,setTimeout,clearTimeout,TextEncoder,Uint8Array,Map,Set});
  const summary={month:'2026-10-01',funds:[{fund:'general',opening:10000,income:0,expense:0,closing:10000}],entries:[],dues:[]};
  const report={...summary,closure:{summary,closed_name:'QA',note:'QA'},dues_history:{configured:true,through_month:'2026-10-01',members:[account]}};
  const html=window.TreasuryReport.html(report,true);
  assert.match(html,/Deuda anterior/);assert.match(html,/Detalle de los meses pendientes/);assert.match(html,/18[,.]00/);assert.ok(html.includes('&lt;script&gt;'));
});

test('the roster includes registered companions who never paid without manufacturing debt',()=>{
 const history=[{...account, id:'m1',name:'Old name',tracking:'configured'}];
 const members=[{id:'m1',source_anniversary_id:'c1',name:'José',start_month:'2026-09-01'},{id:'m2',source_anniversary_id:'c2',name:'Juan',start_month:'2026-11-01'}];
 const companions=[{id:'c1',name:'José'},{id:'c2',name:'Juan'},{id:'c3',name:'María'},{id:'c4',name:'Otra persona'}];
 const rows=D.roster(history,members,companions,'2026-10-01');
 assert.equal(rows.length,4);assert.equal(rows.find(p=>p.source_id==='c3').total_pending,null);
 assert.equal(rows.find(p=>p.source_id==='c2').tracking,'not_due');
 assert.equal(D.filter(rows,'','unconfigured').length,2);
 assert.equal(D.filter(rows,'','settled').length,1,'unconfigured companions must not be labelled settled');
 const html=D.table(rows,true);assert.match(html,/María/);assert.match(html,/Otra persona/);assert.match(html,/Por calcular/);assert.match(html,/Configurar inicio/);assert.match(html,/1.800|18,00|18.00/);
});
test('unlinked legacy treasury members are retained without duplicate linked companions',()=>{
 const rows=D.roster([{...account,id:'m1'}],[{id:'m1',source_anniversary_id:'c1',name:'Jose'},{id:'legacy',name:'Legacy',start_month:'2026-11-01'}],[{id:'c1',name:'Jose'}],'2026-10-01');
 assert.equal(rows.length,2);assert.ok(rows.some(row=>row.id==='legacy'));
});
test('the private report includes companions with no payment record as unconfigured',()=>{
 const window={TreasuryModel:M};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tesoreria/report.js'),'utf8'),{window,setTimeout,clearTimeout,TextEncoder,Uint8Array,Map,Set});
 const summary={month:'2026-10-01',funds:[{fund:'general',opening:0,income:0,expense:0,closing:0}],entries:[],dues:[]};
 const rows=D.roster([],[],[{id:'missing',name:'Sin pagos previos'}],'2026-10-01');
 const report={...summary,closure:{summary,closed_name:'QA',note:'QA'},dues_history:{configured:true,through_month:'2026-10-01',members:[]},dues_roster:rows};
 const html=window.TreasuryReport.html(report,true);
 assert.match(html,/Sin pagos previos/);assert.match(html,/Por configurar/);
});
test('22 registered companions appear even when only 16 have contribution accounts',()=>{
 const companions=Array.from({length:22},(_,index)=>({id:'c'+index,name:'Compañero '+index}));
 const members=companions.slice(0,16).map((companion,index)=>({id:'m'+index,source_anniversary_id:companion.id,name:companion.name,start_month:'2026-09-01'}));
 const ledger=members.map(member=>({...member,previous_pending:1200,current_pending:1200,total_pending:2400,paid:0,periods:[]}));
 const roster=D.roster(ledger,members,companions,'2026-10-01');
 assert.equal(roster.length,22);assert.equal(new Set(roster.map(person=>person.source_id)).size,22);assert.equal(roster.filter(person=>person.tracking==='unconfigured').length,6);
 assert.equal(roster.find(person=>person.id==='m0').total_pending,2400,'a member who never paid still has individual debt');
});


test('report omits the notes page, keeps full concepts and retains receipt references',()=>{
 const window={TreasuryModel:M};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tesoreria/report.js'),'utf8'),{window,setTimeout,clearTimeout,TextEncoder,Uint8Array,Map,Set});
 const concept='Concepto completo '.repeat(15)+'FINAL';
 const report={month:'2026-10-01',funds:[],dues:[],entries:[{id:'1',kind:'income',status:'posted',entry_date:'2026-10-01',fund:'rent',amount_cents:600,description:concept,due_month:'2026-09-01',no_receipt_reason:'Sin factura'},{id:'2',kind:'expense',status:'posted',entry_date:'2026-10-02',fund:'general',amount_cents:100,receipt_path:'test.jpg'}]};
 const html=window.TreasuryReport.html(report,false);
 assert.ok(!html.includes('Notas de los movimientos'));assert.ok(!html.includes('[nota]'));assert.ok(html.includes(concept));assert.match(html,/Comprobantes registrados/);
});
