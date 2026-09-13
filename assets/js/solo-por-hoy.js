/** Fecha local del grupo; el contenido diario permanece en la fuente oficial. */
(() => {
  'use strict';
  const date = document.getElementById('sph-date');
  if (!date) return;
  const updateDate = () => {
    const now = new Date();
    const options = { timeZone: 'America/Guayaquil', year: 'numeric', month: 'long', day: 'numeric' };
    date.textContent = new Intl.DateTimeFormat('es-EC', options).format(now);
    const parts = new Intl.DateTimeFormat('en-US', { ...options, month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = type => parts.find(item => item.type === type).value;
    date.dateTime = `${part('year')}-${part('month')}-${part('day')}`;
  };
  updateDate();
  window.setInterval(updateDate, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDate(); });
})();
