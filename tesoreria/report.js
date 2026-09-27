(function (root) {
  "use strict";
  const M = root.TreasuryModel,
    esc = M.esc;
  function reportData(report) {
    return report.closure?.summary
      ? { ...report.closure.summary, closure: report.closure }
      : report;
  }
  function html(input, includeDues, person) {
    const r = reportData(input),
      t = M.totals(r),
      entries = r.entries.filter((e) => e.status === "posted");
    return `<div class="print-header"><img src="../assets/img/logo-amigos-verdaderos.png" alt="Amigos Verdaderos"><div><b>GRUPO AMIGOS VERDADEROS</b><br>Narcóticos Anónimos<br>Unidad · Servicio · Recuperación</div></div><h1>Informe de Tesorería</h1><p>${esc(M.monthName(r.month))} · ${r.closure ? "MES CERRADO" : "PROVISIONAL · MES ABIERTO"}<br>Emitido por: ${esc(person)} · ${M.date(M.today())}</p><table><thead><tr><th>Fondo</th><th>Saldo inicial</th><th>Ingresos</th><th>Egresos</th><th>Saldo final</th></tr></thead><tbody>${r.funds.map((f) => `<tr><td>${f.fund === "rent" ? "Local" : "General"}</td>${["opening", "income", "expense", "closing"].map((k) => `<td>${esc(M.money(f[k]))}</td>`).join("")}</tr>`).join("")}<tr><th>Total</th>${["opening", "income", "expense", "closing"].map((k) => `<th>${esc(M.money(t[k]))}</th>`).join("")}</tr></tbody></table><h2>Movimientos confirmados</h2><table><thead><tr><th>Fecha</th><th>Concepto / fondo</th><th>Ingreso</th><th>Egreso</th><th>Respaldo</th></tr></thead><tbody>${entries.map((e) => `<tr><td>${M.date(e.entry_date)}</td><td>${esc(e.description)}<br>${esc(M.categories[e.category])} · ${e.fund === "rent" ? "Local" : "General"}${e.due_month ? "<br>Aporte de " + esc(M.monthName(e.due_month)) : ""}</td><td>${e.kind === "income" ? esc(M.money(e.amount_cents)) : ""}</td><td>${e.kind === "expense" ? esc(M.money(e.amount_cents)) : ""}</td><td>${e.receipt_path ? "Adjunto privado" : e.no_receipt_reason ? esc(e.no_receipt_reason) : "Sin adjunto"}</td></tr>`).join("") || '<tr><td colspan="5">No hay movimientos confirmados.</td></tr>'}</tbody></table>${r.closure ? `<h2>Revisión y cierre</h2><p>Dinero contado: ${esc(M.money(r.closure.counted_cents))}<br>Diferencia: ${esc(M.money(r.closure.difference_cents))}<br>Cerrado por: ${esc(r.closure.closed_name)}</p><p class="print-note">${esc(r.closure.note || "Sin observaciones.")}</p>` : "<p>Este informe puede cambiar mientras el mes permanezca abierto.</p>"}${includeDues ? `<h2>Anexo privado · Aportes para el local</h2><table><thead><tr><th>Compañero</th><th>Referencia</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead><tbody>${r.dues.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(M.money(d.expected))}</td><td>${esc(M.money(d.paid))}</td><td>${esc(M.money(Math.max(0, d.expected - d.paid)))}</td><td>${M.dueStatus(d)}</td></tr>`).join("")}</tbody></table><p>Los aportes se asignan al mes que corresponden; el flujo de caja usa la fecha en que se recibió el dinero. Un pendiente no es dinero disponible.</p>` : ""}<p>Borradores: ${r.entries.filter((e) => e.status === "draft").length}. Anulados: ${r.entries.filter((e) => e.status === "void").length}. Excluidos de los totales. Los comprobantes y el historial completo se consultan con acceso autorizado.</p>`;
  }
  async function download(input, includeDues, person) {
    const r = reportData(input),
      doc = new root.jspdf.jsPDF({
        unit: "mm",
        format: "a4",
        putOnlyUsedFonts: true,
      });
    for (const style of ["normal", "bold"]) {
      doc.addFileToVFS("Treasury-" + style + ".ttf", root.TreasuryFonts[style]);
      doc.addFont("Treasury-" + style + ".ttf", "Treasury", style);
    }
    let y = 20;
    const W = 178;
    const clean = (s) =>
      String(s ?? "")
        .replace(/[↗↙→↓·]/g, " - ")
        .replace(/[—–]/g, "-");
    function newPage() {
      doc.addPage();
      y = 20;
      doc.setTextColor(13, 36, 69);
      doc.setFont("Treasury", "bold");
      doc.setFontSize(10);
      doc.text("AMIGOS VERDADEROS / TESORERÍA", 16, y);
      y += 12;
    }
    function ensure(h) {
      if (y + h > 277) newPage();
    }
    function text(s, size = 10, bold = false) {
      doc.setFont("Treasury", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(13, 36, 69);
      const lines = doc.splitTextToSize(clean(s), W);
      for (const line of lines) {
        ensure(size * 0.46 + 2);
        doc.setFont("Treasury", bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.text(line, 16, y);
        y += size * 0.46 + 2;
      }
      y += 2;
    }
    function title(s) {
      ensure(20);
      y += 5;
      text(s, 14, true);
    }
    function table(headers, rows, widths) {
      const height = 5;
      function header() {
        doc.setFillColor(13, 36, 69);
        doc.rect(16, y, W, 9, "F");
        doc.setFont("Treasury", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255);
        let x = 18;
        headers.forEach((h, i) => {
          doc.text(clean(h), x, y + 6);
          x += widths[i];
        });
        y += 11;
      }
      ensure(20);
      header();
      for (const row of rows) {
        doc.setFont("Treasury", "normal");
        doc.setFontSize(8);
        const cells = row.map((v, i) =>
          doc.splitTextToSize(clean(v), widths[i] - 4),
        );
        const max = Math.max(...cells.map((c) => c.length));
        let offset = 0;
        while (offset < max) {
          let available = Math.floor((274 - y - 4) / height);
          if (available < 1) {
            newPage();
            header();
            available = Math.floor((274 - y - 4) / height);
          }
          const count = Math.min(max - offset, available);
          let x = 18;
          doc.setTextColor(32, 51, 70);
          doc.setFont("Treasury", "normal");
          doc.setFontSize(8);
          cells.forEach((c, i) => {
            doc.text(c.slice(offset, offset + count), x, y + 4);
            x += widths[i];
          });
          y += count * height + 4;
          doc.setDrawColor(214, 224, 232);
          doc.line(16, y - 1, 194, y - 1);
          offset += count;
          if (offset < max) {
            newPage();
            header();
          }
        }
      }
      y += 4;
    }
    try {
      const img = new Image();
      img.src = "../assets/img/logo-amigos-verdaderos.png";
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240;
      canvas.getContext("2d").drawImage(img, 0, 0, 240, 240);
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 16, 13, 22, 22);
    } catch {}
    doc.setFont("Treasury", "bold");
    doc.setFontSize(15);
    doc.setTextColor(13, 36, 69);
    doc.text("AMIGOS VERDADEROS", 43, 21);
    doc.setFontSize(9);
    doc.text("NARCÓTICOS ANÓNIMOS", 43, 28);
    doc.setDrawColor(140, 160, 180);
    doc.line(16, 40, 194, 40);
    y = 52;
    text("Informe mensual de Tesorería", 23, true);
    text(M.monthName(r.month), 13);
    text(r.closure ? "MES CERRADO" : "PROVISIONAL - MES ABIERTO", 10, true);
    text("Emitido por: " + person + " | " + M.date(M.today()), 9);
    const total = M.totals(r);
    title("Resumen de fondos");
    table(
      ["Fondo", "Saldo inicial", "Ingresos", "Egresos", "Saldo final"],
      [
        ...r.funds.map((f) => [
          f.fund === "rent" ? "Local" : "General",
          ...["opening", "income", "expense", "closing"].map((k) =>
            M.money(f[k]),
          ),
        ]),
        [
          "TOTAL",
          ...["opening", "income", "expense", "closing"].map((k) =>
            M.money(total[k]),
          ),
        ],
      ],
      [34, 36, 36, 36, 36],
    );
    const entries = r.entries.filter((e) => e.status === "posted"),
      grouped = {};
    for (const e of entries) {
      const k = e.kind + ":" + e.category;
      grouped[k] = (grouped[k] || 0) + Number(e.amount_cents);
    }
    title("Totales por categoría");
    table(
      ["Tipo", "Categoría", "Total"],
      Object.entries(grouped).map(([k, n]) => {
        const [kind, cat] = k.split(":");
        return [
          kind === "income" ? "Ingreso" : "Egreso",
          M.categories[cat],
          M.money(n),
        ];
      }),
      [35, 105, 38],
    );
    title("Detalle de movimientos");
    table(
      ["Fecha", "Concepto / fondo", "Ingreso", "Egreso"],
      entries.map((e) => [
        M.date(e.entry_date),
        e.description +
          "\n" +
          M.categories[e.category] +
          " / " +
          (e.fund === "rent" ? "Local" : "General") +
          (e.due_month ? "\nAporte: " + M.monthName(e.due_month) : "") +
          "\n" +
          (e.receipt_path
            ? "Comprobante adjunto"
            : e.no_receipt_reason
              ? "Sin comprobante: " + e.no_receipt_reason
              : "Sin adjunto"),
        e.kind === "income" ? M.money(e.amount_cents) : "",
        e.kind === "expense" ? M.money(e.amount_cents) : "",
      ]),
      [25, 91, 31, 31],
    );
    if (!entries.length) text("No hay movimientos confirmados.");
    if (r.closure) {
      title("Conciliación y cierre");
      text(
        "Dinero contado: " +
          M.money(r.closure.counted_cents) +
          " | Diferencia: " +
          M.money(r.closure.difference_cents),
        11,
        true,
      );
      text("Cerrado por: " + r.closure.closed_name);
      text(r.closure.note || "Sin observaciones.");
    } else
      text(
        "Informe provisional. Los valores pueden cambiar mientras el mes permanezca abierto.",
      );
    if (includeDues) {
      title("Anexo privado / Aportes para el local");
      table(
        ["Compañero", "Referencia", "Pagado", "Pendiente", "Estado"],
        r.dues.map((d) => [
          d.name,
          M.money(d.expected),
          M.money(d.paid),
          M.money(Math.max(0, d.expected - d.paid)),
          M.dueStatus(d),
        ]),
        [46, 30, 30, 30, 42],
      );
      text(
        "Los aportes corresponden al mes asignado; la caja registra la fecha del ingreso. Los pendientes no se suman al saldo disponible.",
        9,
      );
    }
    text(
      "Borradores: " +
        r.entries.filter((e) => e.status === "draft").length +
        ". Anulados: " +
        r.entries.filter((e) => e.status === "void").length +
        ". Excluidos de los totales. Comprobantes e historial disponibles con acceso autorizado.",
      9,
    );
    for (let n = 1; n <= doc.getNumberOfPages(); n++) {
      doc.setPage(n);
      doc.setFont("Treasury", "normal");
      doc.setFontSize(8);
      doc.setTextColor(89, 110, 132);
      doc.text("Unidad - Servicio - Recuperación", 16, 288);
      doc.text(n + " / " + doc.getNumberOfPages(), 194, 288, {
        align: "right",
      });
    }
    doc.save("Tesoreria_Amigos_Verdaderos_" + r.month.slice(0, 7) + ".pdf");
  }
  root.TreasuryReport = { html, download };
})(window);
