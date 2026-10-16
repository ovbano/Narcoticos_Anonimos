(function (root) {
  "use strict";
  const M = root.TreasuryModel || (typeof require === "function" ? require("./model.js") : null);
  const amount = (n) => Number(n || 0);
  function totals(members) {
    return members.reduce((sum, member) => {
      for (const key of ["previous_pending", "current_pending", "total_pending"])
        sum[key] += amount(member[key]);
      return sum;
    }, { previous_pending: 0, current_pending: 0, total_pending: 0 });
  }
  function filter(members, query = "", status = "all") {
    const normalize = (text) => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    return members.filter((m) => normalize(m.name).includes(normalize(query.trim())) &&
      (status === "all" || (status === "pending" ? amount(m.total_pending) > 0 : amount(m.total_pending) === 0)));
  }
  function paymentButton(member, month, pending, writable, detail = false) {
    return writable && amount(pending) > 0
      ? `<button type="button" class="secondary" ${detail ? "data-dues-payment" : "data-payment"}="${M.esc(member.id)}" data-payment-month="${M.esc(month.slice(0, 7))}" data-payment-amount="${amount(pending)}">Abonar ${M.esc(M.monthName(month))}</button>` : "";
  }
  function card(member, writable) {
    const pending = amount(member.total_pending), periods = member.periods || [];
    const oldest = periods.find((p) => amount(p.pending) > 0);
    return `<article class="due-card due-history-card">
      <div class="due-history-heading"><span class="badge ${pending ? "" : "good"}">${pending ? amount(member.paid) > 0 && amount(member.current_pending) > 0 ? "Parcial · saldo pendiente" : "Con saldo pendiente" : "Al día"}</span><h3>${M.esc(member.name)}</h3></div>
      <div class="due-history-total"><span>Total pendiente</span><strong>${M.money(pending)}</strong></div>
      <dl class="due-history-breakdown"><div><dt>Meses anteriores</dt><dd>${M.money(member.previous_pending)}</dd></div><div><dt>Mes consultado</dt><dd>${M.money(member.current_pending)}</dd></div></dl>
      <p class="muted">${amount(member.months_pending)} mes(es) con saldo${member.end_month ? ` · Participación finalizada en ${M.esc(M.monthName(member.end_month))}. Los pendientes se conservan.` : ""}.</p>
      ${oldest ? paymentButton(member, oldest.month, oldest.pending, writable) : ""}
      <details class="due-history-details"><summary>Ver meses y abonos</summary><div class="due-history-months">${periods.map((p) => `<section class="due-history-month"><h4>${M.esc(M.monthName(p.month))}</h4><dl><div><dt>Cuota</dt><dd>${M.money(p.expected)}</dd></div><div><dt>Recibido</dt><dd>${M.money(p.paid)}</dd></div><div><dt>Pendiente</dt><dd>${M.money(p.pending)}</dd></div></dl>${amount(p.credit) > 0 ? `<p class="notice">Excedente de este mes: ${M.money(p.credit)}. No se aplica automáticamente a otro mes; revisa el mes asignado al pago.</p>` : ""}${paymentButton(member, p.month, p.pending, writable, true)}</section>`).join("")}</div></details>
    </article>`;
  }
  const api = { totals, filter, card };
  if (typeof module !== "undefined") module.exports = api;
  else root.TreasuryDues = api;
})(typeof window !== "undefined" ? window : globalThis);
