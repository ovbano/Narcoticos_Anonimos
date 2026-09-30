/* Historical receivables are separate from cash. All mutations use atomic RPCs. */
(() => {
  "use strict";
  const M = window.TreasuryModel,
    esc = M.esc,
    $ = (s) => document.querySelector(s);
  let rows = [],
    ctx,
    generation = 0,
    selected = null,
    paymentId = null;
  const money = (n) => M.money(Number(n || 0));
  const fields = () => $("#activity-form").elements;
  async function rpc(name, args) {
    const { data, error } = await ctx.db.rpc(name, args);
    if (error) throw error;
    return data;
  }
  function render() {
    const q = $("#activity-search").value.trim().toLocaleLowerCase("es"),
      mode = $("#activity-filter").value;
    const totals = rows.reduce(
      (t, r) => ({
        pending: t.pending + Number(r.pending_cents),
        paid: t.paid + Number(r.paid_cents),
      }),
      { pending: 0, paid: 0 },
    );
    $("#activity-totals").innerHTML =
      `<div><span>Pendiente de cobrar</span><strong>${money(totals.pending)}</strong><small>No forma parte del dinero disponible</small></div><div><span>Pagos registrados en el sistema</span><strong>${money(totals.paid)}</strong><small>Ya incluidos en el fondo general; no los vuelvas a ingresar</small></div>`;
    $("#activity-new").hidden = !ctx.writable;
    const visible = rows.filter(
      (r) =>
        (mode === "all" ||
          (mode === "pending" ? r.pending_cents > 0 : r.pending_cents === 0)) &&
        `${r.name} ${r.activity}`.toLocaleLowerCase("es").includes(q),
    );
    $("#activity-list").innerHTML =
      visible
        .map(
          (r) =>
            `<article class="activity-card"><div class="activity-card-heading"><div><h3>${esc(r.name)}</h3><p>${esc(r.activity)}</p></div><span class="activity-badge ${r.pending_cents === 0 ? "settled" : ""}">${r.pending_cents > 0 ? "Pendiente" : "Al día"}</span></div><p class="activity-date">${r.activity_date ? esc(r.activity_date) : "Fecha de actividad no disponible"}${!r.companion_id ? " · Sin vincular al registro" : ""}</p><dl><div><dt>Valor original</dt><dd>${money(r.original_cents)}</dd></div><div><dt>Abonos anteriores al sistema</dt><dd>${money(r.historical_paid_cents)}</dd></div><div><dt>Pagos nuevos</dt><dd>${money(r.paid_cents)}</dd></div><div class="activity-balance"><dt>Por cobrar</dt><dd>${money(r.pending_cents)}</dd></div></dl>${r.note ? `<details><summary>Nota del registro</summary><p>${esc(r.note)}</p></details>` : ""}<div class="button-row">${ctx.writable && r.pending_cents > 0 ? `<button type="button" class="primary" data-activity-pay="${esc(r.id)}">Registrar pago</button>` : ""}${ctx.writable ? `<button type="button" class="secondary" data-activity-edit="${esc(r.id)}">Corregir datos</button>` : ""}</div>${r.payments.length ? `<details><summary>Ver pagos (${r.payments.length})</summary><ul class="activity-payments">${r.payments.map((e) => `<li><button type="button" class="text-button" data-activity-entry="${esc(e.id)}">${esc(e.entry_date)} · ${money(e.amount_cents)}${e.status === "void" ? " · Anulado" : ""}<small>Ver movimiento y comprobante</small></button></li>`).join("")}</ul></details>` : ""}</article>`,
        )
        .join("") ||
      '<p class="empty">No hay registros para esta búsqueda.</p>';
  }
  function open(account, paying = false) {
    selected = account;
    paymentId = crypto.randomUUID();
    const f = fields();
    $("#activity-form").reset();
    $("#activity-message").textContent = "";
    $("#activity-dialog").dataset.mode = paying ? "pay" : "save";
    $("#activity-title").textContent = paying
      ? "Registrar un pago"
      : account
        ? "Corregir pendiente"
        : "Nuevo pendiente de actividad";
    $("#activity-account-fields").hidden = paying;
    $("#activity-payment-fields").hidden = !paying;
    for (const el of $("#activity-account-fields").querySelectorAll(
      "input,textarea",
    ))
      el.disabled = paying;
    for (const el of $("#activity-payment-fields").querySelectorAll(
      "input,textarea",
    ))
      el.disabled = !paying;
    $("#activity-reason-field").hidden = paying || !account;
    f.reason.required = !paying && !!account;
    f.reason.disabled = paying || !account;
    $("#activity-companion-options").innerHTML = ctx.companions
      .map((c) => `<option value="${esc(c.name)}"></option>`)
      .join("");
    f.companion.value =
      ctx.companions.find((c) => c.id === account?.companion_id)?.name ||
      account?.name ||
      "";
    f.activity.value = account?.activity || "";
    f.original.value = account ? (account.original_cents / 100).toFixed(2) : "";
    f.historical.value = ((account?.historical_paid_cents || 0) / 100).toFixed(
      2,
    );
    f.activity_date.value = account?.activity_date || "";
    f.activity_date.max = M.today();
    f.note.value = account?.note || "";
    f.entry_date.value = M.today();
    f.entry_date.max = M.today();
    f.amount.value = account ? (account.pending_cents / 100).toFixed(2) : "";
    f.amount.max = account ? (account.pending_cents / 100).toFixed(2) : "";
    $("#activity-pay-context").textContent = paying
      ? `${account.name} · Pendiente: ${money(account.pending_cents)}`
      : "";
    $("#activity-submit").textContent = paying
      ? "Confirmar pago"
      : "Guardar datos informativos";
    $("#activity-dialog").showModal();
  }
  function cents(value) {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
      throw Error("Usa un monto válido con hasta dos decimales.");
    const n = Math.round(Number(value.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(n)) throw Error("Monto inválido.");
    return n;
  }
  $("#activity-search").addEventListener("input", () => ctx && render());
  $("#activity-filter").addEventListener("change", () => ctx && render());
  $("#activity-new").addEventListener("click", () => open(null));
  $("#activity-close").addEventListener("click", () =>
    $("#activity-dialog").close(),
  );
  $("#activity-list").addEventListener("click", (e) => {
    const pay = e.target.closest("[data-activity-pay]"),
      edit = e.target.closest("[data-activity-edit]"),
      entry = e.target.closest("[data-activity-entry]");
    if (pay || edit)
      open(
        rows.find(
          (r) =>
            r.id === (pay?.dataset.activityPay || edit.dataset.activityEdit),
        ),
        !!pay,
      );
    if (entry) {
      const record = rows
        .flatMap((r) => r.payments)
        .find((p) => p.id === entry.dataset.activityEntry);
      ctx.openEntry(record);
    }
  });
  $("#activity-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("#activity-submit");
    if (b.disabled) return;
    b.disabled = true;
    $("#activity-close").disabled = true;
    try {
      const f = fields(),
        pay = $("#activity-dialog").dataset.mode === "pay";
      let data;
      if (pay)
        data = {
          id: selected.id,
          entry_id: paymentId,
          entry_date: f.entry_date.value,
          amount_cents: cents(f.amount.value),
          note: f.payment_note.value,
        };
      else {
        const matches = ctx.companions.filter(
          (c) => c.name === f.companion.value.trim(),
        );
        const keepUnlinked =
          selected &&
          !selected.companion_id &&
          f.companion.value.trim() === selected.name;
        if (matches.length !== 1 && !keepUnlinked)
          throw Error("Selecciona un nombre exacto del registro del grupo.");
        data = {
          id: selected?.id || paymentId,
          version: selected?.version || 0,
          companion_id: matches[0]?.id || null,
          activity: f.activity.value,
          original_cents: cents(f.original.value),
          historical_paid_cents: cents(f.historical.value),
          activity_date: f.activity_date.value,
          note: f.note.value,
          reason: f.reason.value,
        };
      }
      await rpc("treasury_activity_command", {
        p_action: pay ? "pay" : "save",
        p_data: data,
      });
      $("#activity-dialog").close();
      ctx.toast(
        pay
          ? "Pago registrado en el fondo general. No lo vuelvas a ingresar en Movimientos."
          : "Pendiente guardado. El dinero disponible no ha cambiado.",
      );
      await ctx.refresh();
    } catch (err) {
      $("#activity-message").textContent =
        err.message || "No se pudo guardar. Intenta nuevamente.";
    } finally {
      b.disabled = false;
      $("#activity-close").disabled = false;
    }
  });
  $("#activity-dialog").addEventListener("cancel", (e) => {
    if ($("#activity-submit").disabled) e.preventDefault();
  });
  window.TreasuryActivities = {
    async load(options) {
      ctx = options;
      const token = ++generation;
      try {
        const data = await rpc("treasury_activities");
        if (token !== generation) return;
        rows = data || [];
        render();
      } catch (e) {
        if (token !== generation) return;
        $("#activity-list").textContent =
          "No se pudieron cargar los pendientes. " +
          (e.message || "Vuelve a intentar.");
      }
    },
    reset() {
      generation++;
      rows = [];
      ctx = null;
      $("#activity-list").replaceChildren();
      $("#activity-totals").replaceChildren();
    },
  };
})();
