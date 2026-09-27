(function (root) {
  "use strict";
  const categories = {
    seventh: "Séptima tradición",
    rent_contribution: "Aporte para el local",
    other_income: "Otro ingreso",
    rent: "Arriendo",
    supplies: "Café, azúcar e insumos",
    literature: "Literatura",
    service: "Servicio / área",
    event: "Actividad del grupo",
    other_expense: "Otro gasto",
  };
  const incomeCategories = ["seventh", "rent_contribution", "other_income"];
  function cents(value, optional = false) {
    const text = String(value ?? "")
      .trim()
      .replace(",", ".");
    if (!text && optional) return null;
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(text))
      throw Error(
        "Escribe un monto válido, por ejemplo 12,50 (máximo dos decimales).",
      );
    const [a, b = ""] = text.split(".");
    const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
    if (n > 100000000) throw Error("El monto supera el límite permitido.");
    return n;
  }
  const money = (n) =>
    new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(Number(n || 0) / 100);
  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const monthName = (m) =>
    new Intl.DateTimeFormat("es-EC", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(m.slice(0, 7) + "-01T12:00:00Z"));
  const date = (d) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const totals = (r) =>
    (r?.funds || []).reduce(
      (a, f) => {
        for (const k of ["opening", "income", "expense", "closing"])
          a[k] += Number(f[k]);
        return a;
      },
      { opening: 0, income: 0, expense: 0, closing: 0 },
    );
  const dueStatus = (d) =>
    Number(d.paid) > Number(d.expected)
      ? "Anticipo / excedente"
      : Number(d.paid) >= Number(d.expected)
        ? "Completo"
        : Number(d.paid) > 0
          ? "Parcial"
          : "Pendiente";
  const api = {
    categories,
    incomeCategories,
    cents,
    money,
    today,
    monthName,
    date,
    esc,
    totals,
    dueStatus,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.TreasuryModel = api;
})(typeof window !== "undefined" ? window : globalThis);
