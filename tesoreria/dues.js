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
      (status === "all" || (status === "unconfigured" ? m.tracking === "unconfigured" : m.tracking !== "unconfigured" && (status === "pending" ? amount(m.total_pending) > 0 : amount(m.total_pending) === 0))));
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
      <details class="due-history-details"><summary>Ver meses y abonos</summary><div class="due-history-months">${periods.map((p) => `<section class="due-history-month"><h4>${M.esc(M.monthName(p.month))}</h4><dl><div><dt>Cuota</dt><dd>${M.money(p.expected)}</dd></div><div><dt>Recibido</dt><dd>${M.money(p.paid)}</dd></div><div><dt>Pendiente</dt><dd>${M.money(p.pending)}</dd></div></dl>${amount(p.credit) > 0 ? `<p class="notice">Excedente de este mes: ${M.money(p.credit)}. No se aplica automáticamente a otro mes; revisa el mes asignado al pago.</p>` : ""}${p.reconciliation_note ? `<p class="notice"><strong>Conciliación histórica sin movimiento de caja.</strong> Aporte reconocido: ${M.money(p.recognized_paid)} · Diferencia regularizada: ${M.money(p.waived)}. ${M.esc(p.reconciliation_note)}</p>` : ""}${paymentButton(member, p.month, p.pending, writable, true)}</section>`).join("")}</div></details>
    </article>`;
  }
  function roster(history, members, companions, throughMonth) {
    const byId = new Map(history.map((row) => [row.id, row])), used = new Set();
    function configured(member, companion) {
      used.add(member.id);
      const row = byId.get(member.id);
      return { ...(row || { ...member, expected: 0, paid: 0, previous_pending: 0, current_pending: 0, total_pending: 0, months_pending: 0, periods: [] }),
        name: companion?.name || member.name, source_id: companion?.id || member.source_anniversary_id,
        tracking: row ? "configured" : "not_due" };
    }
    const result = companions.map((companion) => {
      const member = members.find((member) => member.source_anniversary_id === companion.id);
      return member ? configured(member, companion) : { id: "source:" + companion.id, source_id: companion.id, name: companion.name,
        tracking: "unconfigured", previous_pending: null, current_pending: null, total_pending: null, periods: [] };
    });
    for (const member of members) if (!used.has(member.id)) result.push(configured(member));
    for (const row of history) if (!used.has(row.id)) { result.push({...row, tracking: "configured"}); used.add(row.id); }
    return result.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  function status(member) {
    if (member.tracking === "unconfigured") return "Inicio por configurar";
    if (member.tracking === "not_due") return "Sin cuotas en este período";
    return amount(member.total_pending) > 0 ? "Con deuda" : "Al día";
  }
  function table(members, writable) {
    if (!members.length) return '<div class="empty">No hay compañeros para esta búsqueda.</div>';
    return `<table class="individual-dues-table"><caption>Deuda individual de todos los compañeros registrados</caption><thead><tr><th>Compañero</th><th>Meses anteriores</th><th>Mes consultado</th><th>Deuda total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${members.map((member) => {
      const missing = member.tracking === "unconfigured", pending = amount(member.total_pending), oldest = (member.periods || []).find((period) => amount(period.pending) > 0);
      const value = (key) => missing ? "—" : M.money(member[key]);
      return `<tr data-dues-person="${M.esc(member.id)}" class="${pending ? "has-debt" : missing ? "needs-configuration" : "is-settled"}">
        <th scope="row"><strong>${M.esc(member.name)}</strong>${member.end_month ? `<small>Participación finalizada · ${M.esc(M.monthName(member.end_month))}</small>` : ""}</th>
        <td data-label="Meses anteriores">${value("previous_pending")}</td><td data-label="Mes consultado">${value("current_pending")}</td>
        <td data-label="Deuda total" class="individual-debt"><strong>${missing ? "Por calcular" : M.money(member.total_pending)}</strong></td>
        <td data-label="Estado"><span class="badge">${M.esc(status(member))}</span></td>
        <td class="individual-actions">${missing ? `<p>Confirma desde qué mes corresponde la cuota de $12.</p>${writable ? `<button type="button" class="secondary" data-dues-configure="${M.esc(member.source_id)}">Configurar inicio</button>` : ""}` : `<button type="button" class="text-button" data-dues-detail="${M.esc(member.id)}">Ver meses y abonos</button>${oldest ? paymentButton(member, oldest.month, oldest.pending, writable) : ""}`}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
  }
  function detail(member, writable) {
    const periods = member.periods || [];
    if (!periods.length) return '<p class="notice">No hay cuotas generadas para este compañero en el período consultado. Revisa su fecha de inicio de participación.</p>';
    return `<p class="notice">Deuda individual acumulada: <strong>${M.money(member.total_pending)}</strong>. Los abonos se aplican al mes asignado.</p>` + periods.map((period) => `<section class="due-history-month"><h3>${M.esc(M.monthName(period.month))}</h3><dl><div><dt>Cuota</dt><dd>${M.money(period.expected)}</dd></div><div><dt>Recibido</dt><dd>${M.money(period.paid)}</dd></div><div><dt>Deuda pendiente</dt><dd>${M.money(period.pending)}</dd></div></dl>${amount(period.credit) > 0 ? `<p>Excedente de este mes: ${M.money(period.credit)}. No cancela automáticamente otros meses.</p>` : ""}${paymentButton(member, period.month, period.pending, writable, true)}</section>`).join("");
  }
  const api = { totals, filter, card, roster, table, detail, status };
  if (typeof module !== "undefined") module.exports = api;
  else root.TreasuryDues = api;
})(typeof window !== "undefined" ? window : globalThis);

