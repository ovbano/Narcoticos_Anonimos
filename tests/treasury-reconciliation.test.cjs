const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../tesoreria/dues.js');
test('Un mes conciliado conserva cuota y explica los importes sin aparentar un ingreso nuevo',()=>{
 const member={id:'sample',name:'Compañero de prueba',expected:1200,paid:1200,current_pending:0,previous_pending:0,total_pending:0,months_pending:0,periods:[{month:'2026-09-01',expected:1200,paid:1000,pending:0,credit:0,recognized_paid:1000,waived:200,reconciliation_note:'Saldo histórico conciliado <script>no ejecutar</script>'}]};
 const html=D.card(member,true);assert.match(html,/Al día/);assert.match(html,/sin movimiento de caja/);assert.match(html,/regularizada/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/data-dues-payment/);
});
test('Sin conciliación no aparece una nota que sugiera una regularización',()=>{
 const member={id:'sample',name:'Otro compañero',current_pending:1200,previous_pending:0,total_pending:1200,months_pending:1,periods:[{month:'2026-10-01',expected:1200,paid:0,pending:1200,credit:0}]};
 const html=D.card(member,true);assert.doesNotMatch(html,/Conciliación histórica/);assert.match(html,/data-dues-payment/);
});
