(function (root) {
  "use strict";
  const M = root.TreasuryModel,
    esc = M.esc;
  const fundName = (f) => (f === "rent" ? "Arriendo" : "General");
  const fields = ["opening", "income", "expense", "closing"];
  function reportData(r) {
    return r.closure?.summary
      ? { ...r.closure.summary, closure: r.closure }
      : r;
  }
  function sections(input, includeDues) {
    const r = reportData(input),
      total = M.totals(r),
      notes = [],
      receipts = [];
    const entries = r.entries
      .filter((e) => e.status === "posted")
      .slice()
      .sort(
        (a, b) =>
          a.entry_date.localeCompare(b.entry_date) ||
          String(a.created_at || a.id).localeCompare(
            String(b.created_at || b.id),
          ),
      );
    const blocks = [];
    const text = (value) => blocks.push({ type: "text", value });
    const title = (value) => blocks.push({ type: "title", value });
    const table = (headers, rows, widths, numeric = []) =>
      blocks.push({ type: "table", headers, rows, widths, numeric });
    title("Resumen del mes");
    table(
      ["Fondo", "Al iniciar", "Ingresó", "Se gastó", "Al finalizar"],
      [
        ...r.funds.map((f) => [
          fundName(f.fund),
          ...fields.map((k) => M.money(f[k])),
        ]),
        ["TOTAL", ...fields.map((k) => M.money(total[k]))],
      ],
      [34, 36, 36, 36, 36],
      [1, 2, 3, 4],
    );
    text(
      "General: dinero para café, agua, insumos y otros gastos del grupo. Arriendo: dinero reservado para pagar el alquiler del local; no se cuenta como dinero libre para otros gastos.",
    );
    text(
      "Al iniciar es el saldo que viene del período anterior. Al finalizar = al iniciar + lo que ingresó − lo que se gastó. El total reúne ambos fondos; no es un ingreso adicional.",
    );
    if (r.closure) {
      text(
        "Cierre revisado por " +
          r.closure.closed_name +
          ". Dinero contado: " +
          M.money(r.closure.counted_cents) +
          ". Diferencia con el registro: " +
          M.money(r.closure.difference_cents) +
          ".",
      );
      if (r.closure.note) text("Observación del cierre: " + r.closure.note);
    } else
      text(
        "Informe provisional: el mes sigue abierto y sus valores pueden cambiar.",
      );
    const excluded = r.entries.filter((e) => e.status !== "posted").length;
    if (excluded)
      text(
        excluded +
          " registros en borrador o anulados no forman parte de estos totales.",
      );
    for (const kind of ["income", "expense"]) {
      blocks.push({ type: "page" });
      const label = kind === "income" ? "Ingresos" : "Egresos",
        list = entries.filter((e) => e.kind === kind);
      title(label + " · " + list.length + " movimientos");
      text(
        kind === "income"
          ? "Dinero recibido durante el mes, separado por fondo."
          : "Dinero utilizado durante el mes, separado por fondo.",
      );
      const rows = list.map((e, i) => {
        const id =
          (kind === "income" ? "I" : "E") + String(i + 1).padStart(2, "0");
        let concept = e.description || M.categories[e.category] || "Movimiento";
        if (concept.length > 105) {
          notes.push([id, "Concepto completo: " + concept]);
          concept = concept.slice(0, 102) + "… [nota]";
        }
        if (e.due_month)
          notes.push([
            id,
            "Aporte asignado a " + M.monthName(e.due_month) + ".",
          ]);
        if (e.receipt_path) receipts.push({ ...e, ref: id });
        else if (e.no_receipt_reason)
          notes.push([id, "Sin comprobante: " + e.no_receipt_reason]);
        return [
          id,
          M.date(e.entry_date),
          concept,
          fundName(e.fund),
          M.money(e.amount_cents),
        ];
      });
      if (rows.length)
        table(
          ["Ref.", "Fecha", "Concepto", "Fondo", "Valor"],
          rows,
          [13, 25, 87, 23, 30],
          [4],
        );
      else text("No hay " + label.toLowerCase() + " confirmados en este mes.");
      table(
        ["Total " + label.toLowerCase(), "General", "Arriendo", "TOTAL"],
        [
          [
            "Dinero " + (kind === "income" ? "recibido" : "utilizado"),
            ...["general", "rent"].map((f) =>
              M.money(
                list
                  .filter((e) => e.fund === f)
                  .reduce((n, e) => n + Number(e.amount_cents), 0),
              ),
            ),
            M.money(list.reduce((n, e) => n + Number(e.amount_cents), 0)),
          ],
        ],
        [70, 36, 36, 36],
        [1, 2, 3],
      );
    }
    if (notes.length) {
      blocks.push({ type: "page" });
      title("Notas de los movimientos");
      text(
        "Las referencias I identifican ingresos; las E, egresos. Las notas repetidas se muestran una sola vez con todas sus referencias.",
      );
      const grouped = new Map();
      for (const [ref, value] of notes)
        grouped.set(value, [...(grouped.get(value) || []), ref]);
      for (const [value, refs] of grouped)
        text(refs.join(", ") + " — " + value);
    }
    if (includeDues) {
      blocks.push({ type: "page" });
      title("Anexo privado · Aportes para arriendo");
      text(
        "La cuota corresponde al mes asignado. Un pendiente no es dinero disponible; el ingreso se cuenta en la fecha en que se recibió.",
      );
      table(
        ["Compañero", "Cuota", "Pagado", "Pendiente", "Estado"],
        (r.dues || []).map((d) => [
          d.name,
          M.money(d.expected),
          M.money(d.paid),
          M.money(Math.max(0, d.expected - d.paid)),
          M.dueStatus(d),
        ]),
        [54, 29, 29, 29, 37],
        [1, 2, 3],
      );
    }
    if (receipts.length) {
      blocks.push({ type: "page" });
      title("Comprobantes registrados");
      text(
        "Cada referencia corresponde al movimiento de las tablas anteriores. Los originales se conservan en Tesorería, con acceso autorizado.",
      );
      table(
        ["Ref.", "Fecha", "Fondo", "Valor", "Archivo"],
        receipts.map((e) => [
          e.ref,
          M.date(e.entry_date),
          fundName(e.fund),
          M.money(e.amount_cents),
          /\.pdf$/i.test(e.receipt_path) ? "PDF original" : "Fotografía",
        ]),
        [16, 30, 36, 36, 60],
        [3],
      );
      text(
        "Las fotografías se añaden al final solo si se selecciona «Incluir fotos de comprobantes». Los archivos PDF originales se consultan y descargan desde Tesorería; no se reproducen en este informe.",
      );
    }
    return { r, blocks, receipts };
  }
  // Bound network and decoding waits; a missing receipt must never block the report.
  async function deadline(work, ms = 20000) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(work),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Tiempo de espera agotado")),
            ms,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function* receiptImages(input, options = {}) {
    if (!options.includeReceipts) return;
    const photos = sections(input, false).receipts.filter(
      (e) => !/\.pdf$/i.test(e.receipt_path),
    );
    const started = Date.now();
    for (const [index, e] of photos.entries()) {
      options.onProgress?.(
        "Preparando foto " + (index + 1) + " de " + photos.length + "…",
      );
      let url, img, canvas, output;
      try {
        if (Date.now() - started > 90000)
          throw new Error("Límite de espera del anexo");
        const blob = await deadline(
          () => options.loadReceipt(e.receipt_path),
          options.timeoutMs || 20000,
        );
        if (!(blob instanceof Blob) || blob.size > 10 * 1024 * 1024)
          throw new Error("Archivo inválido o demasiado grande");
        url = URL.createObjectURL(blob);
        img = new Image();
        img.src = url;
        await deadline(() => img.decode(), options.timeoutMs || 15000);
        const scale = Math.min(
          1,
          1600 / Math.max(img.naturalWidth, img.naturalHeight),
        );
        canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        output = {
          ...e,
          image: canvas.toDataURL("image/jpeg", 0.78),
          width: canvas.width,
          height: canvas.height,
        };
      } catch {
        output = { ...e, error: true };
      } finally {
        if (img) img.src = "";
        if (url) URL.revokeObjectURL(url);
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      yield output;
      // Let the browser paint progress between photos, especially on phones.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  async function prepare(input, options = {}) {
    const images = [];
    for await (const image of receiptImages(input, options)) images.push(image);
    return images;
  }
  function html(input, includeDues, person, evidence = []) {
    const { r, blocks } = sections(input, includeDues);
    return (
      `<div class="print-header"><img src="../assets/img/logo-amigos-verdaderos.png" alt="Logo"><div><b>GRUPO AMIGOS VERDADEROS</b><br>Narcóticos Anónimos</div></div><h1>Informe mensual de tesorería</h1><p>${esc(M.monthName(r.month))} · ${r.closure ? "MES CERRADO" : "PROVISIONAL"}<br>Preparado por: ${esc(person)} · ${esc(M.date(M.today()))}</p>` +
      blocks
        .map((b) =>
          b.type === "page"
            ? '<div class="report-page-break"></div>'
            : b.type === "title"
              ? `<h2>${esc(b.value)}</h2>`
              : b.type === "text"
                ? `<p class="report-paragraph">${esc(b.value)}</p>`
                : `<table class="report-table"><thead><tr>${b.headers.map((h, i) => `<th class="${b.numeric.includes(i) ? "amount" : ""}" style="width:${(b.widths[i] / 178) * 100}%">${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((row) => `<tr>${row.map((v, i) => `<td class="${b.numeric.includes(i) ? "amount" : ""}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
        )
        .join("") +
      evidence
        .map(
          (e) =>
            `<section class="report-evidence"><h2>Comprobante ${esc(e.ref)}</h2><p>${esc(M.date(e.entry_date))} · ${esc(fundName(e.fund))} · ${esc(M.money(e.amount_cents))}</p>${e.error ? "<p>No se pudo cargar esta fotografía. Consulte el original en Tesorería.</p>" : `<img src="${e.image}" alt="Comprobante ${esc(e.ref)}">`}</section>`,
        )
        .join("")
    );
  }
  async function download(input, includeDues, person, options = {}) {
    const { r, blocks } = sections(input, includeDues);
    let missingReceipts = 0;
    const doc = new root.jspdf.jsPDF({
      unit: "mm",
      format: "a4",
      putOnlyUsedFonts: true,
      compress: true,
    });
    for (const style of ["normal", "bold"]) {
      doc.addFileToVFS("Treasury-" + style + ".ttf", root.TreasuryFonts[style]);
      doc.addFont("Treasury-" + style + ".ttf", "Treasury", style);
    }
    let y = 22,
      section = "Informe mensual";
    const font = (size = 10, bold = false) => {
      doc.setFont("Treasury", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(20, 40, 68);
    };
    function page() {
      doc.addPage();
      y = 22;
      font(9, true);
      doc.text("AMIGOS VERDADEROS · " + M.monthName(r.month), 16, y);
      y += 12;
    }
    function ensure(h) {
      if (y + h > 274) page();
    }
    function text(value, size = 10, bold = false) {
      font(size, bold);
      const lines = doc.splitTextToSize(String(value), 178);
      for (const line of lines) {
        ensure(6);
        font(size, bold);
        doc.text(line, 16, y);
        y += 5.3;
      }
      y += 4;
    }
    function table(b) {
      function header() {
        font(9, true);
        doc.setFillColor(229, 236, 244);
        doc.rect(16, y, 178, 10, "F");
        let x = 16;
        b.headers.forEach((h, i) => {
          doc.text(
            h,
            b.numeric.includes(i) ? x + b.widths[i] - 2 : x + 2,
            y + 6.5,
            { align: b.numeric.includes(i) ? "right" : "left" },
          );
          x += b.widths[i];
        });
        y += 11;
      }
      ensure(24);
      header();
      b.rows.forEach((row, index) => {
        font(9);
        const cells = row.map((v, i) =>
          doc.splitTextToSize(String(v), b.widths[i] - 4),
        );
        const max = Math.max(1, ...cells.map((c) => c.length));
        let offset = 0;
        if (max * 4.8 + 5 < 225 && y + max * 4.8 + 5 > 274) {
          page();
          text(section + " · continuación", 11, true);
          header();
        }
        while (offset < max) {
          let count = Math.min(max - offset, Math.floor((274 - y - 5) / 4.8));
          if (count < 1) {
            page();
            text(section + " · continuación", 11, true);
            header();
            count = Math.min(max - offset, Math.floor((274 - y - 5) / 4.8));
          }
          const h = count * 4.8 + 5;
          if (index % 2 === 0) {
            doc.setFillColor(247, 249, 252);
            doc.rect(16, y, 178, h, "F");
          }
          font(9, row[0] === "TOTAL" || b.headers[0].startsWith("Total "));
          let x = 16;
          cells.forEach((c, i) => {
            const lines = c.slice(offset, offset + count);
            lines.forEach((line, j) =>
              doc.text(
                line,
                b.numeric.includes(i) ? x + b.widths[i] - 2 : x + 2,
                y + 5 + j * 4.8,
                { align: b.numeric.includes(i) ? "right" : "left" },
              ),
            );
            x += b.widths[i];
          });
          y += h;
          offset += count;
        }
      });
      y += 7;
    }
    try {
      const img = new Image();
      img.src = "../assets/img/logo-amigos-verdaderos.png";
      await deadline(() => img.decode());
      doc.addImage(img, "PNG", 16, 12, 19, 19);
    } catch {}
    font(13, true);
    doc.text("AMIGOS VERDADEROS", 40, 20);
    font(9);
    doc.text("NARCÓTICOS ANÓNIMOS", 40, 27);
    y = 44;
    text("Informe mensual de tesorería", 19, true);
    text(M.monthName(r.month), 13, true);
    text(
      (r.closure ? "MES CERRADO" : "PROVISIONAL · MES ABIERTO") +
        " · Emitido el " +
        M.date(M.today()),
      9,
    );
    text("Preparado por: " + person, 9);
    for (const b of blocks) {
      if (b.type === "page") page();
      else if (b.type === "title") {
        section = b.value;
        ensure(24);
        text(b.value, 14, true);
      } else if (b.type === "text") text(b.value);
      else table(b);
    }
    for await (const e of receiptImages(input, options)) {
      if (e.error) missingReceipts++;
      page();
      text("Comprobante " + e.ref, 15, true);
      text(
        M.date(e.entry_date) +
          " · " +
          fundName(e.fund) +
          " · " +
          M.money(e.amount_cents),
        11,
      );
      if (e.error)
        text(
          "No se pudo cargar esta fotografía. Consulte el original en Tesorería.",
        );
      else {
        const scale = Math.min(178 / e.width, (269 - y) / e.height);
        const w = e.width * scale,
          h = e.height * scale;
        doc.addImage(
          e.image,
          "JPEG",
          16 + (178 - w) / 2,
          y,
          w,
          h,
          undefined,
          "FAST",
        );
        e.image = null;
      }
    }
    for (let n = 1; n <= doc.getNumberOfPages(); n++) {
      doc.setPage(n);
      doc.setDrawColor(178, 190, 205);
      doc.line(16, 281, 194, 281);
      font(8);
      doc.text("Tesorería · " + M.monthName(r.month), 16, 287);
      doc.text(n + " / " + doc.getNumberOfPages(), 194, 287, {
        align: "right",
      });
    }
    doc.save("Tesoreria_Amigos_Verdaderos_" + r.month.slice(0, 7) + ".pdf");
    return { missingReceipts };
  }
  root.TreasuryReport = { html, download, prepare, deadline };
})(window);
