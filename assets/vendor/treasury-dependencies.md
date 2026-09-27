# Dependencias locales de Tesorería

- `supabase/supabase.js`: distribución UMD de `@supabase/supabase-js` **2.57.4**, obtenida de npm, licencia MIT adjunta.
- `jspdf/jspdf.umd.min.js`: distribución UMD de `jspdf` **4.2.1**, obtenida de npm, licencia MIT adjunta. Se usa la API de texto, tablas dibujadas y PNG del logo; no se interpreta HTML de terceros.
- `jspdf/fonts.js`: subconjunto latino de DejaVu Sans normal/negrita, para incrustar la tipografía y conservar tildes y legibilidad en los PDF. Licencia adjunta en `FONT-LICENSE`.

Las versiones están fijadas mediante los archivos distribuidos; Tesorería no carga bibliotecas desde un CDN ni requiere añadir dependencias al servidor. La auditoría de los paquetes npm utilizados no reportó vulnerabilidades tras actualizar jsPDF a 4.2.1 (26/09/2026). Para actualizarlas, obtener versiones explícitas, conservar sus licencias y repetir las pruebas de descarga/renderizado.
