(() => {
  "use strict";
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    M = window.TreasuryModel,
    db = window.amigosSupabase;
  let user,
    profile,
    settings,
    report,
    members = [],
    drafts = [],
    audit = [],
    auditOffset = 0,
    activeEntry = null,
    activeMember = null,
    selectedFile = null,
    uploadedPath = null,
    previewURL = null,
    saving = false,
    dirty = false,
    refreshToken = 0;
  const writable = () =>
    profile && ["admin", "treasurer"].includes(profile.role);
  const form = $("#entry-form"),
    field = (n) => form.elements[n];
  const toast = (text, error = false) => {
    const t = $("#toast");
    t.textContent = text;
    t.classList.toggle("error", error);
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), error ? 12000 : 6500);
  };
  const fail = (e) =>
    toast(
      e?.message || "No se pudo completar la operación. Intenta de nuevo.",
      true,
    );
  async function result(p) {
    const { data, error } = await p;
    if (error) throw error;
    return data;
  }
  async function cmd(action, data) {
    return result(
      db.rpc("treasury_command", { p_action: action, p_data: data }),
    );
  }
  async function busy(button, action) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await action();
    } catch (e) {
      fail(e);
    } finally {
      button.disabled = false;
    }
  }
  function tab(name) {
    $$("[data-view]").forEach((v) => (v.hidden = v.id !== "view-" + name));
    $$(".tabs button").forEach((b) =>
      b.setAttribute("aria-current", b.dataset.tab === name ? "page" : "false"),
    );
  }
  function cleanScreen() {
    refreshToken++;
    user = profile = settings = report = null;
    members = [];
    drafts = [];
    audit = [];
    $$("dialog[open]").forEach((d) => d.close());
    $("#workspace").hidden = true;
    $("#auth-panel").hidden = false;
    for (const id of [
      "recent-list",
      "movement-list",
      "draft-list",
      "dues-list",
      "member-list",
      "audit-list",
      "fund-cards",
      "alerts",
      "print-area",
    ])
      $("#" + id).replaceChildren();
    form.reset();
    selectedFile = uploadedPath = activeEntry = null;
    dirty = false;
    if (previewURL) URL.revokeObjectURL(previewURL);
  }
  async function auth() {
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) {
      cleanScreen();
      return;
    }
    user = data.user;
    profile = await result(
      db
        .from("profiles")
        .select("id,display_name,role,active")
        .eq("id", user.id)
        .maybeSingle(),
    );
    if (
      !profile?.active ||
      !["admin", "treasurer", "auditor"].includes(profile.role)
    ) {
      cleanScreen();
      $("#auth-message").textContent =
        "Tu cuenta no tiene acceso a Tesorería. Solicita al administrador el permiso correspondiente.";
      return;
    }
    $("#auth-panel").hidden = true;
    $("#workspace").hidden = false;
    $("#welcome").textContent =
      (profile.display_name || user.email) +
      " · " +
      {
        admin: "Administración",
        treasurer: "Servicio de Tesorería",
        auditor: "Consulta y revisión",
      }[profile.role];
    $("#admin-link").hidden = profile.role !== "admin";
    $$("[data-new],#quick-photo,#draft-new,#member-new").forEach(
      (b) => (b.hidden = !writable()),
    );
    await refresh();
  }
  async function all(table, configure = (q) => q) {
    let rows = [];
    for (let start = 0; ; start += 500) {
      const page = await result(
        configure(db.from(table).select("*")).range(start, start + 499),
      );
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  async function refresh() {
    if (!profile) return;
    const token = ++refreshToken;
    $("#period-status").textContent = "Actualizando…";
    const [s, mem, dr] = await Promise.all([
      result(db.from("treasury_settings").select("*").maybeSingle()),
      all("treasury_members", (q) => q.order("name").order("id")),
      all("treasury_entries", (q) =>
        q.eq("status", "draft").order("created_at").order("id"),
      ),
    ]);
    if (token !== refreshToken) return;
    settings = s;
    members = mem;
    drafts = dr;
    $("#setup").hidden = !!settings || profile.role !== "admin";
    if (!settings) {
      report = null;
      $("#close-form").hidden = true;
      $("#reopen").hidden = true;
      $("#period-status").textContent = "Configuración pendiente";
      $("#alerts").innerHTML =
        '<div class="notice">El administrador debe registrar el saldo inicial verificado para comenzar.</div>';
      $$(
        "[data-new],#quick-photo,#draft-new,#member-new,#download-pdf,#print-report",
      ).forEach((b) => (b.disabled = true));
      return;
    }
    $("#month").min = settings.start_month.slice(0, 7);
    if ($("#month").value < settings.start_month.slice(0, 7))
      $("#month").value = settings.start_month.slice(0, 7);
    const r = await result(
      db.rpc("treasury_report", { p_month: $("#month").value + "-01" }),
    );
    if (token !== refreshToken) return;
    report = r;
    $$(
      "[data-new],#quick-photo,#draft-new,#member-new,#download-pdf,#print-report",
    ).forEach((b) => (b.disabled = false));
    render();
    await loadAudit(true);
  }
  function entryHTML(e) {
    const status =
      e.status === "draft"
        ? "Borrador"
        : e.status === "void"
          ? "Anulado"
          : "Confirmado";
    return `<article class="entry ${e.status}"><span class="action-icon ${e.kind}">${e.kind === "income" ? "↙" : "↗"}</span><div class="entry-body"><h3>${M.esc(e.description || "Comprobante por completar")}</h3><small>${M.date(e.entry_date)} · ${M.esc(M.categories[e.category])}</small><small>${e.fund === "rent" ? "Local" : "General"} · ${status}${e.receipt_path ? " · Con comprobante" : ""}${e.member_name ? " · " + M.esc(e.member_name) : ""}</small></div><div class="entry-value"><strong class="${e.kind}">${e.amount_cents ? M.money(e.amount_cents) : "Por definir"}</strong><button class="text-button" data-entry="${M.esc(e.id)}">${e.status === "draft" && writable() ? "Completar" : "Ver detalle"} →</button></div></article>`;
  }
  function renderEntries() {
    if (!report) return;
    const query = $("#search").value.toLocaleLowerCase(),
      kind = $("#filter-kind").value;
    const entries = report.entries.filter(
      (e) =>
        (!kind || e.kind === kind) &&
        [e.description, e.member_name, M.categories[e.category]]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
    );
    $("#movement-list").innerHTML =
      entries.slice().reverse().map(entryHTML).join("") ||
      '<div class="empty">No hay movimientos para esta selección.</div>';
  }
  function render() {
    const t = M.totals(report),
      closed = !!report.closure;
    for (const k of ["opening", "income", "expense"])
      $("#" + k).textContent = M.money(t[k]);
    $("#balance").textContent = M.money(t.closing);
    $("#period-status").textContent = closed ? "Mes cerrado" : "Mes abierto";
    $("#fund-cards").innerHTML = report.funds
      .map(
        (f) =>
          `<article class="fund-card"><h3>${f.fund === "rent" ? "RESERVADO PARA EL LOCAL" : "FONDO GENERAL"}</h3><strong>${M.money(f.closing)}</strong><p>${f.fund === "rent" ? "Aportes y pagos del local." : "Séptimas y actividades del grupo."}</p></article>`,
      )
      .join("");
    const noProof = report.entries.filter(
      (e) => e.status === "posted" && e.kind === "expense" && !e.receipt_path,
    ).length;
    $("#alerts").innerHTML =
      (t.closing < 0 || report.funds.some((f) => f.closing < 0)
        ? '<div class="notice">Hay un fondo con saldo negativo. Revisa los movimientos y el origen del dinero antes del cierre.</div>'
        : "") +
      (noProof
        ? `<div class="notice">${noProof} gasto(s) sin comprobante adjunto. Consulta sus explicaciones en el detalle.</div>`
        : "");
    $("#recent-list").innerHTML =
      report.entries
        .filter((e) => e.status === "posted")
        .slice(-5)
        .reverse()
        .map(entryHTML)
        .join("") ||
      '<div class="empty">Aquí aparecerán los movimientos confirmados de este mes.</div>';
    $("#draft-count").textContent = drafts.length;
    $("#draft-list").innerHTML =
      drafts.map(entryHTML).join("") ||
      '<div class="empty">Todo al día. No tienes borradores pendientes.</div>';
    renderEntries();
    const pending = report.dues.reduce(
      (n, d) => n + Math.max(0, d.expected - d.paid),
      0,
    );
    $("#dues-summary").textContent =
      "Pendiente del mes: " +
      M.money(pending) +
      ". Este valor no se suma al saldo disponible.";
    $("#dues-list").innerHTML =
      report.dues
        .map(
          (d) =>
            `<article class="due-card"><span class="badge">${M.dueStatus(d)}</span><h3>${M.esc(d.name)}</h3><p>${M.money(d.paid)} recibidos / ${M.money(d.expected)} de referencia</p><div class="progress"><i style="width:${Math.min(100, d.expected ? (d.paid / d.expected) * 100 : 100)}%"></i></div>${writable() && !closed ? `<button class="secondary wide" data-payment="${M.esc(d.id)}">Registrar abono</button>` : ""}</article>`,
        )
        .join("") ||
      '<div class="empty">Agrega a los compañeros que aportan para el local.</div>';
    $("#member-list").innerHTML = members
      .map(
        (m) =>
          `<div class="audit-row"><strong>${M.esc(m.name)}</strong> · ${M.money(m.monthly_cents)}<br>Desde ${M.esc(M.monthName(m.start_month))}${m.end_month ? " · Hasta " + M.esc(M.monthName(m.end_month)) : ""}${writable() ? ` <button class="text-button" data-member="${M.esc(m.id)}">Ver / dar de baja</button>` : ""}</div>`,
      )
      .join("");
    $("#close-form").hidden = closed || !writable();
    $("#reopen").hidden = !closed || profile.role !== "admin";
    $("#closure-info").innerHTML = closed
      ? `<div class="notice ${report.closure.difference_cents === 0 ? "good" : ""}">Saldo calculado: ${M.money(t.closing)}<br>Dinero contado: ${M.money(report.closure.counted_cents)}<br><strong>Diferencia: ${M.money(report.closure.difference_cents)}</strong></div><p>Cerrado por ${M.esc(report.closure.closed_name)}</p><p>${M.esc(report.closure.note || "Sin observaciones.")}</p>`
      : "<p>Saldo calculado: <strong>" +
        M.money(t.closing) +
        "</strong>. El cierre se habilita cuando termine el mes y se hayan resuelto sus borradores.</p>";
  }
  function categories() {
    const income = field("kind").value === "income",
      previous = field("category").value;
    field("category").innerHTML = Object.entries(M.categories)
      .filter(([k]) => M.incomeCategories.includes(k) === income)
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join("");
    if ([...field("category").options].some((o) => o.value === previous))
      field("category").value = previous;
    else field("category").value = income ? "seventh" : "supplies";
    categoryChanged();
  }
  function categoryChanged() {
    const cat = field("category").value,
      isRent = cat === "rent_contribution";
    $$(".rent-field").forEach((l) => (l.hidden = !isRent));
    if (["rent", "rent_contribution"].includes(cat))
      field("fund").value = "rent";
    else if (cat === "seventh") field("fund").value = "general";
    field("fund").disabled = ["rent", "rent_contribution", "seventh"].includes(
      cat,
    );
  }
  function openEntry(kind = "expense", entry = null, payment = null) {
    if (!settings) {
      toast("Primero configura el saldo inicial.", true);
      return;
    }
    activeEntry = entry
      ? { ...entry }
      : { id: crypto.randomUUID(), version: 0 };
    form.reset();
    dirty = false;
    selectedFile = null;
    uploadedPath = entry?.receipt_path || null;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
    $("#receipt-preview").hidden = true;
    $("#camera").value = $("#attachment").value = "";
    $("#entry-message").textContent = "";
    field("kind").value = entry?.kind || kind;
    field("entry_date").value = entry?.entry_date || M.today();
    field("entry_date").min = settings.start_month;
    field("entry_date").max = M.today();
    categories();
    field("member_id").innerHTML =
      '<option value="">Seleccionar</option>' +
      members
        .map((m) => `<option value="${M.esc(m.id)}">${M.esc(m.name)}</option>`)
        .join("");
    field("due_month").value =
      entry?.due_month?.slice(0, 7) || $("#month").value;
    field("amount").value =
      entry?.amount_cents != null ? (entry.amount_cents / 100).toFixed(2) : "";
    field("description").value = entry?.description || "";
    field("no_receipt_reason").value = entry?.no_receipt_reason || "";
    if (entry) {
      field("category").value = entry.category;
      field("fund").value = entry.fund;
      field("member_id").value = entry.member_id || "";
    }
    if (payment) {
      field("category").value = "rent_contribution";
      field("member_id").value = payment;
      field("description").value = "Aporte para el local";
    }
    categoryChanged();
    const editable = writable() && (!entry || entry.status === "draft");
    for (const el of form.querySelectorAll("input,select,textarea"))
      el.disabled = !editable;
    categoryChanged();
    if (!editable) field("fund").disabled = true;
    $("#save-draft").hidden = $("#post-entry").hidden = !editable;
    $("#entry-title").textContent =
      entry?.status === "void"
        ? "Movimiento anulado"
        : entry?.status === "posted"
          ? "Movimiento confirmado"
          : entry
            ? "Completar borrador"
            : "Nuevo movimiento";
    $("#receipt-label").textContent = uploadedPath
      ? "Comprobante guardado. Se conserva el original."
      : "Toma una foto o adjunta un archivo. Máximo 10 MB.";
    $("#view-receipt").hidden = !uploadedPath;
    $("#camera").disabled = $("#attachment").disabled =
      !editable || !!uploadedPath;
    $("#entry-form .record-actions")?.remove();
    if (entry && writable()) {
      const box = document.createElement("div");
      box.className = "record-actions";
      if (entry.status === "posted")
        box.innerHTML =
          '<button type="button" class="text-button" id="void-entry">Anular con motivo</button>';
      if (entry.status === "draft")
        box.innerHTML =
          '<button type="button" class="text-button" id="discard-entry">Descartar borrador</button>';
      form.append(box);
    }
    if (entry?.void_reason)
      $("#entry-message").textContent =
        "Motivo de anulación: " + entry.void_reason;
    $("#entry-dialog").showModal();
  }
  function fileSelected(file) {
    if (!file) return;
    if (
      file.size > 10485760 ||
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    ) {
      toast("Usa JPG, PNG, WEBP o PDF de hasta 10 MB.", true);
      return;
    }
    selectedFile = file;
    dirty = true;
    $("#receipt-label").textContent = file.name + " · Pendiente de guardar";
    if (previewURL) URL.revokeObjectURL(previewURL);
    if (file.type.startsWith("image/")) {
      previewURL = URL.createObjectURL(file);
      $("#receipt-preview").src = previewURL;
      $("#receipt-preview").hidden = false;
    } else $("#receipt-preview").hidden = true;
  }
  async function saveEntry(post) {
    if (saving) return;
    try {
      if (!form.reportValidity()) return;
      const amount = M.cents(field("amount").value, !post);
      if ((post && amount === null) || (amount !== null && amount <= 0))
        throw Error("Indica un monto mayor que cero.");
      if (post && field("description").value.trim().length < 3)
        throw Error("Describe el movimiento antes de confirmarlo.");
      if (
        post &&
        field("category").value === "rent_contribution" &&
        (!field("member_id").value || !field("due_month").value)
      )
        throw Error("Selecciona el compañero y el mes del aporte.");
      if (
        post &&
        field("kind").value === "expense" &&
        !uploadedPath &&
        !selectedFile &&
        field("no_receipt_reason").value.trim().length < 5
      )
        throw Error("Adjunta un comprobante o explica su ausencia.");
      saving = true;
      $("#save-draft").disabled = $("#post-entry").disabled = true;
      $("#entry-message").textContent = "Guardando… No cierres esta pantalla.";
      if (selectedFile && !uploadedPath) {
        const ext = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "application/pdf": "pdf",
        }[selectedFile.type];
        const path = activeEntry.id + "/" + crypto.randomUUID() + "." + ext;
        await result(
          db.storage
            .from("treasury-receipts")
            .upload(path, selectedFile, {
              contentType: selectedFile.type,
              upsert: false,
            }),
        );
        uploadedPath = path;
      }
      const payload = {
        id: activeEntry.id,
        version: activeEntry.version,
        status: post ? "posted" : "draft",
        entry_date: field("entry_date").value,
        kind: field("kind").value,
        category: field("category").value,
        fund: field("fund").value,
        amount_cents: amount,
        description: field("description").value.trim(),
        member_id:
          field("category").value === "rent_contribution"
            ? field("member_id").value || null
            : null,
        due_month:
          field("category").value === "rent_contribution" &&
          field("due_month").value
            ? field("due_month").value + "-01"
            : null,
        receipt_path: uploadedPath,
        no_receipt_reason: field("no_receipt_reason").value.trim(),
      };
      const data = await cmd("save", payload);
      activeEntry = data.record;
      dirty = false;
      $("#entry-dialog").close();
      toast(
        post
          ? "Movimiento confirmado."
          : "Borrador guardado. Puedes completarlo después.",
      );
      await refresh();
    } catch (e) {
      $("#entry-message").textContent =
        (e.message || "No se pudo guardar.") +
        " Tus datos siguen en esta pantalla; revisa y vuelve a intentar.";
    } finally {
      saving = false;
      $("#save-draft").disabled = $("#post-entry").disabled = false;
    }
  }
  async function receipt() {
    if (!uploadedPath) return;
    const blob = await result(
      db.storage.from("treasury-receipts").download(uploadedPath),
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      "Comprobante_" + activeEntry.id + "." + uploadedPath.split(".").pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function openMember(id) {
    activeMember = members.find((m) => m.id === id) || null;
    const f = $("#member-form");
    f.reset();
    f.elements.name.value = activeMember?.name || "";
    f.elements.start_month.value =
      activeMember?.start_month.slice(0, 7) || $("#month").value;
    f.elements.end_month.value = activeMember?.end_month?.slice(0, 7) || "";
    f.elements.monthly.value = (
      (activeMember?.monthly_cents ?? 1200) / 100
    ).toFixed(2);
    $("#member-dialog").showModal();
  }
  function auditSummary(data) {
    if (!data) return "Sin registro";
    const fields = [
      ["entry_date", "Fecha", M.date],
      ["month", "Mes", M.monthName],
      ["start_month", "Inicio", M.monthName],
      ["end_month", "Último mes", M.monthName],
      ["kind", "Tipo", (v) => (v === "income" ? "Ingreso" : "Egreso")],
      ["fund", "Fondo", (v) => (v === "rent" ? "Local" : "General")],
      [
        "status",
        "Estado",
        (v) =>
          ({ draft: "Borrador", posted: "Confirmado", void: "Anulado" })[v] ||
          v,
      ],
      ["category", "Categoría", (v) => M.categories[v] || v],
      ["amount_cents", "Monto", M.money],
      ["opening_general", "Saldo inicial general", M.money],
      ["opening_rent", "Saldo inicial local", M.money],
      ["monthly_cents", "Aporte mensual", M.money],
      ["counted_cents", "Dinero contado", M.money],
      ["difference_cents", "Diferencia", M.money],
      ["name", "Compañero", String],
      ["member_name", "Compañero", String],
      ["due_month", "Mes del aporte", M.monthName],
      ["description", "Concepto", String],
      ["receipt_path", "Comprobante", () => "Adjunto privado"],
      ["no_receipt_reason", "Sin comprobante", String],
      ["void_reason", "Motivo de anulación", String],
      ["reason", "Motivo", String],
      ["note", "Observaciones", String],
      ["closed_name", "Responsable del cierre", String],
    ];
    return (
      fields
        .filter(
          ([key]) =>
            data[key] !== null && data[key] !== undefined && data[key] !== "",
        )
        .map(([key, label, format]) => label + ": " + format(data[key]))
        .join("\n") || "Operación registrada"
    );
  }
  async function loadAudit(reset = false) {
    const owner = user?.id;
    if (reset) {
      auditOffset = 0;
      audit = [];
    }
    const rows = await result(
      db
        .from("treasury_audit")
        .select("*")
        .order("id", { ascending: false })
        .range(auditOffset, auditOffset + 29),
    );
    if (!user || user.id !== owner) return;
    audit.push(...rows);
    auditOffset += rows.length;
    $("#audit-more").hidden = rows.length < 30;
    const names = {
      setup: "Saldo inicial registrado",
      save: "Registro guardado / confirmado",
      void: "Movimiento anulado",
      discard: "Borrador descartado",
      member: "Compañero actualizado",
      close: "Mes cerrado",
      reopen: "Mes reabierto",
    };
    $("#audit-list").innerHTML =
      audit
        .map(
          (a) =>
            `<details class="audit-row"><summary>${M.esc(names[a.action] || a.action)} · ${M.esc(a.actor_name)}<br><small>${M.esc(new Date(a.happened_at).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }))}</small></summary><pre>${M.esc("ANTES\n" + auditSummary(a.before_data) + "\n\nDESPUÉS\n" + auditSummary(a.after_data))}</pre></details>`,
        )
        .join("") || "<p>Todavía no hay cambios registrados.</p>";
  }
  async function reportFresh() {
    if (!report) throw Error("Primero configura los fondos.");
    report = await result(
      db.rpc("treasury_report", { p_month: $("#month").value + "-01" }),
    );
    return report;
  }
  function printHTML(html) {
    $("#print-area").innerHTML = html;
    window.print();
  }
  function wire() {
    $("#month").value = M.today().slice(0, 7);
    $("#setup-form").elements.start_month.value = M.today().slice(0, 7);
    $("#login-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        await result(
          db.auth.signInWithPassword({
            email: $("#email").value.trim(),
            password: $("#password").value,
          }),
        );
        $("#password").value = "";
        await auth();
      });
    };
    $("#recover").onclick = () =>
      busy($("#recover"), async () => {
        if (!$("#email").reportValidity() || !$("#email").value)
          throw Error("Escribe tu correo primero.");
        await result(
          db.auth.resetPasswordForEmail($("#email").value.trim(), {
            redirectTo: location.origin + "/admin/",
          }),
        );
        $("#auth-message").textContent =
          "Si el correo corresponde a una cuenta, recibirás instrucciones para cambiar tu contraseña.";
      });
    $("#logout").onclick = () =>
      busy($("#logout"), async () => {
        if (dirty && !confirm("Hay un registro sin guardar. ¿Deseas salir?"))
          return;
        await result(db.auth.signOut());
        cleanScreen();
      });
    $("#password-open").onclick = () => $("#password-dialog").showModal();
    $("#password-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        const f = e.target;
        if (f.elements.new_password.value !== f.elements.confirm_password.value)
          throw Error("Las contraseñas no coinciden.");
        await result(
          db.auth.updateUser({ password: f.elements.new_password.value }),
        );
        f.reset();
        $("#password-dialog").close();
        history.replaceState(null, "", location.pathname);
        toast("Contraseña actualizada.");
      });
    };
    $("#month").onchange = () => {
      if ($("#month").value) refresh().catch(fail);
    };
    $("#refresh").onclick = () => busy($("#refresh"), refresh);
    $("#search").oninput = renderEntries;
    $("#filter-kind").onchange = renderEntries;
    document.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.tab) tab(b.dataset.tab);
      if (b.dataset.new) openEntry(b.dataset.new);
      if (b.dataset.close) {
        if (saving) return;
        if (
          b.dataset.close === "entry-dialog" &&
          dirty &&
          !confirm("El registro no se ha guardado. ¿Cerrar?")
        )
          return;
        dirty = false;
        $("#" + b.dataset.close).close();
      }
      if (b.dataset.entry) {
        const entry =
          drafts.find((x) => x.id === b.dataset.entry) ||
          report.entries.find((x) => x.id === b.dataset.entry);
        openEntry(entry.kind, entry);
      }
      if (b.dataset.payment) openEntry("income", null, b.dataset.payment);
      if (b.dataset.member) openMember(b.dataset.member);
      if (b.id === "void-entry" || b.id === "discard-entry")
        busy(b, async () => {
          const discard = b.id === "discard-entry";
          let reason = "";
          if (discard) {
            if (
              !confirm(
                "¿Descartar este borrador? El historial conservará la operación.",
              )
            )
              return;
          } else {
            reason = prompt("Motivo de la anulación (al menos 5 caracteres):");
            if (reason === null) return;
            if (reason.trim().length < 5)
              throw Error("Explica el motivo con al menos 5 caracteres.");
          }
          await cmd(discard ? "discard" : "void", {
            id: activeEntry.id,
            version: activeEntry.version,
            reason,
          });
          dirty = false;
          $("#entry-dialog").close();
          toast(
            discard
              ? "Borrador descartado."
              : "Movimiento anulado. Registra la corrección si corresponde.",
          );
          await refresh();
        });
    });
    $("#quick-photo").onclick = () => {
      openEntry("expense");
      $("#entry-title").textContent = "Foto y borrador";
      $("#camera").click();
    };
    $("#draft-new").onclick = () => openEntry();
    $("#camera").onchange = (e) => fileSelected(e.target.files[0]);
    $("#attachment").onchange = (e) => fileSelected(e.target.files[0]);
    $("#view-receipt").onclick = () => receipt().catch(fail);
    field("kind").onchange = categories;
    field("category").onchange = categoryChanged;
    form.addEventListener("input", () => (dirty = true));
    form.onsubmit = (e) => {
      e.preventDefault();
      saveEntry(true);
    };
    $("#save-draft").onclick = () => saveEntry(false);
    $("#entry-dialog").addEventListener("cancel", (e) => {
      if (saving || (dirty && !confirm("¿Cerrar sin guardar?")))
        e.preventDefault();
      else dirty = false;
    });
    window.addEventListener("beforeunload", (e) => {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    $("#member-new").onclick = () => openMember();
    $("#member-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        const f = e.target;
        await cmd("member", {
          id: activeMember?.id,
          name: f.elements.name.value.trim(),
          start_month: f.elements.start_month.value + "-01",
          end_month: f.elements.end_month.value
            ? f.elements.end_month.value + "-01"
            : null,
          monthly_cents: M.cents(f.elements.monthly.value),
        });
        $("#member-dialog").close();
        toast("Compañero guardado.");
        await refresh();
      });
    };
    $("#setup-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        const f = e.target;
        if (
          !confirm(
            "¿Confirmas que estos saldos corresponden al dinero verificado al inicio del primer mes?",
          )
        )
          return;
        await cmd("setup", {
          start_month: f.elements.start_month.value + "-01",
          opening_general: M.cents(f.elements.opening_general.value),
          opening_rent: M.cents(f.elements.opening_rent.value),
          note: f.elements.note.value.trim(),
        });
        toast("Saldo inicial registrado.");
        await refresh();
      });
    };
    $("#close-form").onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter, async () => {
        const r = await reportFresh(),
          count = M.cents(e.target.elements.counted.value),
          diff = count - M.totals(r).closing;
        if (
          !confirm(
            "Saldo calculado: " +
              M.money(M.totals(r).closing) +
              "\nDinero contado: " +
              M.money(count) +
              "\nDiferencia: " +
              M.money(diff) +
              "\n¿Confirmar el cierre?",
          )
        )
          return;
        await cmd("close", {
          month: r.month,
          counted_cents: count,
          note: e.target.elements.note.value.trim(),
        });
        toast("Mes cerrado.");
        await refresh();
      });
    };
    $("#reopen").onclick = () =>
      busy($("#reopen"), async () => {
        const reason = prompt("Motivo para reabrir este mes:");
        if (reason === null) return;
        await cmd("reopen", { month: report.month, reason });
        toast("Mes reabierto. La operación quedó registrada.");
        await refresh();
      });
    $("#download-pdf").onclick = () =>
      busy($("#download-pdf"), async () => {
        await window.TreasuryReport.download(
          await reportFresh(),
          $("#include-dues").checked,
          profile.display_name || "Servidor",
        );
      });
    $("#print-report").onclick = () =>
      busy($("#print-report"), async () => {
        printHTML(
          window.TreasuryReport.html(
            await reportFresh(),
            $("#include-dues").checked,
            profile.display_name || "Servidor",
          ),
        );
      });
    $("#print-guide").onclick = () =>
      printHTML(
        '<div class="print-header"><img src="../assets/img/logo-amigos-verdaderos.png" alt="Logo"><b>AMIGOS VERDADEROS · GUÍA DE TESORERÍA</b></div>' +
          $("#guide-content").innerHTML,
      );
    $("#audit-more").onclick = () => busy($("#audit-more"), () => loadAudit());
    window.addEventListener("afterprint", () =>
      $("#print-area").replaceChildren(),
    );
    const network = () => ($("#network").hidden = navigator.onLine);
    network();
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
  }
  if (!db) {
    $("#auth-message").textContent =
      "No se pudo cargar el acceso. Revisa tu conexión y recarga.";
    return;
  }
  wire();
  const setup =
    new URLSearchParams(location.search).has("setup") ||
    /type=(invite|recovery)/.test(location.hash);
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") cleanScreen();
    if (event === "PASSWORD_RECOVERY")
      setTimeout(() => $("#password-dialog").showModal(), 0);
  });
  auth()
    .then(() => {
      if (setup && user) $("#password-dialog").showModal();
    })
    .catch(fail);
})();
