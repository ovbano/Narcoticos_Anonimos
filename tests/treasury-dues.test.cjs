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
  assert.match(html,/Pendientes acumulados/);assert.match(html,/Detalle de los meses pendientes/);assert.match(html,/18[,.]00/);assert.ok(html.includes('&lt;script&gt;'));
});
