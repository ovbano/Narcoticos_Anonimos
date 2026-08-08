/**
 * Grupo Amigos Verdaderos
 * Contactos y aniversarios públicos desde Supabase.
 */
(() => {
  'use strict';

  const db = window.amigosSupabase;

  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const roleConfig = {
    rsg_principal: {
      label: 'RSG PRINCIPAL',
      description: 'Representante del servicio del grupo',
      cssClass: 'is-principal',
      badgeClass: 'role-principal'
    },
    rsg_alterno: {
      label: 'RSG ALTERNO',
      description: 'Representante alterno del servicio del grupo',
      cssClass: 'is-alternate',
      badgeClass: 'role-alternate'
    },
    secretaria_tesoreria: {
      label: 'SECRETARIA / TESORERA',
      description: 'Secretaría y tesorería del grupo',
      cssClass: 'is-secretary',
      badgeClass: 'role-secretary'
    }
  };

  let siteData = { contacts: [], anniversaries: [] };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));

  const capitalize = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

  const getInitials = (name) => String(name || '')
    .trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join('');

  const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');
  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'compañero';

  const buildWhatsAppUrl = (contact) => {
    const phone = normalizePhone(contact.phone);
    const message = `Hola ${firstName(contact.name)}, deseo información sobre las reuniones del Grupo Amigos Verdaderos de Narcóticos Anónimos.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  const getYearsForAnniversary = (item, year = new Date().getFullYear()) => {
    const startYear = Number(item.startYear);
    if (!Number.isInteger(startYear) || startYear <= 0) return null;
    const years = year - startYear;
    return years > 0 ? years : null;
  };

  const formatYears = (years) => years === 1 ? '1 año de recuperación' : `${years} años de recuperación`;

  const getCelebrationForYear = (item, year) => {
    const celebration = item?.celebration;
    if (!celebration?.date) return null;

    const [dateYear, month, day] = String(celebration.date).split('-').map(Number);
    if (!dateYear || !month || !day || dateYear !== year) return null;

    const date = new Date(dateYear, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;

    const latitude = celebration.latitude === null || celebration.latitude === '' ? null : Number(celebration.latitude);
    const longitude = celebration.longitude === null || celebration.longitude === '' ? null : Number(celebration.longitude);

    return {
      date,
      location: String(celebration.location || '').trim(),
      latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
      longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null,
      mapUrl: String(celebration.mapUrl || '').trim()
    };
  };

  const formatCelebrationDate = (date) => new Intl.DateTimeFormat('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(date);

  const isSafeHttpUrl = (value) => {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const buildCelebrationMapUrl = (celebration) => {
    if (!celebration) return '';
    if (Number.isFinite(celebration.latitude) && Number.isFinite(celebration.longitude)) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${celebration.latitude},${celebration.longitude}`)}`;
    }
    if (isSafeHttpUrl(celebration.mapUrl)) return celebration.mapUrl;
    if (celebration.location) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(celebration.location)}`;
    }
    return '';
  };

  const mapAnniversary = (row) => ({
    id: row.id,
    name: row.name,
    day: Number(row.recovery_day),
    month: Number(row.recovery_month),
    startYear: row.recovery_year === null ? null : Number(row.recovery_year),
    celebration: row.celebration_date ? {
      date: row.celebration_date,
      location: row.celebration_location || '',
      latitude: row.celebration_latitude,
      longitude: row.celebration_longitude,
      mapUrl: row.celebration_map_url || ''
    } : null
  });

  const loadSiteData = async () => {
    if (!db) throw new Error('Supabase no está configurado.');

    const [contactsResult, anniversariesResult] = await Promise.all([
      db.from('service_contacts')
        .select('role,name,phone,active')
        .eq('active', true),
      db.from('anniversaries')
        .select('id,name,recovery_day,recovery_month,recovery_year,celebration_date,celebration_location,celebration_latitude,celebration_longitude,celebration_map_url,public_visible')
        .eq('public_visible', true)
    ]);

    if (contactsResult.error) throw contactsResult.error;
    if (anniversariesResult.error) throw anniversariesResult.error;

    siteData = {
      contacts: contactsResult.data || [],
      anniversaries: (anniversariesResult.data || []).map(mapAnniversary)
    };
  };

  const showLoadError = () => {
    const list = document.getElementById('anniversary-list');
    const intro = document.getElementById('anniversary-intro');
    if (intro) intro.textContent = 'No pudimos consultar los aniversarios en este momento. Intenta nuevamente más tarde.';
    if (list) {
      list.innerHTML = `
        <div class="col-12">
          <div class="anniversary-empty anniversary-empty-month">
            <i class="bi bi-wifi-off"></i>
            <div><strong>Información temporalmente no disponible.</strong><span>La conexión con el sistema de datos no respondió.</span></div>
          </div>
        </div>`;
    }
  };

  const isAnniversaryRelevantThisMonth = (item, currentMonth, currentYear) => {
    if (Number(item.month) === currentMonth) return true;
    const celebration = getCelebrationForYear(item, currentYear);
    return celebration ? celebration.date.getMonth() + 1 === currentMonth : false;
  };

  const renderCurrentMonthAnniversaries = () => {
    const list = document.getElementById('anniversary-list');
    const period = document.getElementById('anniversary-period');
    const intro = document.getElementById('anniversary-intro');
    if (!list || !period || !intro) return;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const monthLabel = monthNames[currentMonth - 1];

    const entries = siteData.anniversaries
      .filter((item) => isAnniversaryRelevantThisMonth(item, currentMonth, currentYear))
      .sort((a, b) => {
        const aCelebration = getCelebrationForYear(a, currentYear)?.date?.getTime() || new Date(currentYear, a.month - 1, a.day).getTime();
        const bCelebration = getCelebrationForYear(b, currentYear)?.date?.getTime() || new Date(currentYear, b.month - 1, b.day).getTime();
        return aCelebration - bCelebration || String(a.name).localeCompare(String(b.name), 'es');
      });

    period.textContent = capitalize(monthLabel);

    if (!entries.length) {
      intro.textContent = `Durante ${monthLabel} no hay aniversarios ni celebraciones programadas. Puedes consultar el calendario completo.`;
      list.innerHTML = `
        <div class="col-12">
          <div class="anniversary-empty anniversary-empty-month">
            <i class="bi bi-calendar2-check"></i>
            <div><strong>No hay aniversarios registrados este mes.</strong><span>Usa el botón “Ver todos” para consultar el calendario anual.</span></div>
          </div>
        </div>`;
      return;
    }

    intro.textContent = `Durante ${monthLabel} acompañamos a ${entries.length === 1 ? 'este compañero' : 'estos compañeros'} en sus próximos aniversarios y celebraciones de recuperación.`;

    list.innerHTML = entries.map((item, index) => {
      const years = getYearsForAnniversary(item, currentYear);
      const celebration = getCelebrationForYear(item, currentYear);
      const animationDelay = 100 + (index * 90);
      const recoveryCopy = years
        ? `Cumplirá <strong>${escapeHtml(formatYears(years))}</strong>.`
        : 'Próximamente celebrará un nuevo aniversario de recuperación.';

      const mapUrl = celebration ? buildCelebrationMapUrl(celebration) : '';
      const celebrationCopy = celebration
        ? `<div class="anniversary-celebration">
             <i class="bi bi-calendar-event-fill"></i>
             <div class="anniversary-celebration-info">
               <span>CELEBRACIÓN PROGRAMADA</span>
               <strong>${escapeHtml(capitalize(formatCelebrationDate(celebration.date)))}</strong>
               ${celebration.location ? `<small class="anniversary-celebration-place"><i class="bi bi-geo-alt-fill"></i>${escapeHtml(celebration.location)}</small>` : ''}
               ${mapUrl ? `<a class="anniversary-map-link" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener" aria-label="Ver ubicación de la celebración de ${escapeHtml(item.name)} en Google Maps"><i class="bi bi-map-fill"></i> Ver en Google Maps</a>` : ''}
             </div>
           </div>`
        : `<div class="anniversary-celebration is-pending">
             <i class="bi bi-calendar2-heart"></i>
             <div><span>CELEBRACIÓN</span><strong>Fecha por confirmar</strong><small>El grupo informará cuando se defina el día.</small></div>
           </div>`;

      return `
        <div class="col-md-6 col-xl-4" data-aos="fade-up" data-aos-delay="${animationDelay}">
          <article class="anniversary-card is-upcoming">
            <div class="anniversary-person-mark" aria-hidden="true"><span>${escapeHtml(getInitials(item.name))}</span><i class="bi bi-stars"></i></div>
            <div class="anniversary-card-content">
              <div class="anniversary-status"><i class="bi bi-award"></i><span>Próximo aniversario</span></div>
              <h3>${escapeHtml(item.name)}</h3>
              <p class="anniversary-years-copy">${recoveryCopy}</p>
              ${celebrationCopy}
            </div>
            <i class="bi bi-stars anniversary-card-star" aria-hidden="true"></i>
          </article>
        </div>`;
    }).join('');
  };

  const renderFullCalendar = () => {
    const calendar = document.getElementById('anniversary-calendar');
    if (!calendar) return;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    calendar.innerHTML = monthNames.map((monthName, monthIndex) => {
      const monthNumber = monthIndex + 1;
      const entries = siteData.anniversaries
        .filter((item) => Number(item.month) === monthNumber)
        .sort((a, b) => Number(a.day) - Number(b.day) || String(a.name).localeCompare(String(b.name), 'es'));
      const currentClass = monthNumber === currentMonth ? ' is-current' : '';
      const countLabel = entries.length === 1 ? '1 aniversario' : `${entries.length} aniversarios`;

      const people = entries.length ? entries.map((item) => {
        const years = getYearsForAnniversary(item, currentYear);
        const startInfo = item.startYear
          ? `Inicio: ${escapeHtml(item.startYear)}${years ? ` · ${escapeHtml(formatYears(years))}` : ''}`
          : 'Año de inicio no registrado';

        return `<div class="anniversary-calendar-person">
          <span class="anniversary-calendar-day" aria-label="Día ${escapeHtml(item.day)}">${String(item.day).padStart(2, '0')}</span>
          <div><strong>${escapeHtml(item.name)}</strong><small>${startInfo}</small></div>
          <i class="bi bi-stars" aria-hidden="true"></i>
        </div>`;
      }).join('') : `<div class="anniversary-calendar-empty"><i class="bi bi-calendar2"></i><span>Sin fechas registradas</span></div>`;

      return `<section class="anniversary-month-card${currentClass}" data-anniversary-month="${monthNumber}">
        <header class="anniversary-month-head">
          <span class="anniversary-month-number">${String(monthNumber).padStart(2, '0')}</span>
          <div><h3>${escapeHtml(capitalize(monthName))}</h3><span>${escapeHtml(countLabel)}</span></div>
          ${monthNumber === currentMonth ? '<em>MES ACTUAL</em>' : ''}
        </header>
        <div class="anniversary-month-people">${people}</div>
      </section>`;
    }).join('');
  };

  const renderContacts = () => {
    const contacts = [...siteData.contacts].sort((a, b) => {
      const order = ['rsg_principal', 'rsg_alterno', 'secretaria_tesoreria'];
      return order.indexOf(a.role) - order.indexOf(b.role);
    });

    const directory = document.getElementById('contact-directory-body');
    const footer = document.getElementById('footer-contact-list');
    const whatsapp = document.getElementById('whatsapp-options');

    if (directory && contacts.length) {
      directory.innerHTML = contacts.map((contact) => {
        const role = roleConfig[contact.role] || roleConfig.rsg_alterno;
        return `<a class="contact-person-card ${role.cssClass}" href="${escapeHtml(buildWhatsAppUrl(contact))}" target="_blank" rel="noopener">
          <span class="contact-person-avatar">${escapeHtml(getInitials(contact.name))}</span>
          <span class="contact-person-data"><span class="contact-role-badge ${role.badgeClass}">${escapeHtml(role.label)}</span><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(role.description)}</small><em>${escapeHtml(contact.phone)}</em></span>
          <i class="bi bi-whatsapp"></i>
        </a>`;
      }).join('');
    }

    if (footer && contacts.length) {
      footer.innerHTML = contacts.map((contact) => {
        const role = roleConfig[contact.role] || roleConfig.rsg_alterno;
        const label = role.label.replace('SECRETARIA / TESORERA', 'Secretaria / Tesorera').replace('RSG PRINCIPAL', 'RSG principal').replace('RSG ALTERNO', 'RSG alterno');
        return `<a class="footer-contact-link" href="${escapeHtml(buildWhatsAppUrl(contact))}" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i><span><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(label)} · ${escapeHtml(contact.phone)}</small></span></a>`;
      }).join('');
    }

    if (whatsapp && contacts.length) {
      whatsapp.innerHTML = contacts.map((contact) => {
        const role = roleConfig[contact.role] || roleConfig.rsg_alterno;
        return `<a href="${escapeHtml(buildWhatsAppUrl(contact))}" class="whatsapp-option" target="_blank" rel="noopener">
          <span class="whatsapp-option-avatar">${escapeHtml(getInitials(contact.name))}</span>
          <span><span class="whatsapp-option-role ${role.badgeClass}">${escapeHtml(role.label)}</span><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.phone)}</small></span>
          <i class="bi bi-box-arrow-up-right"></i>
        </a>`;
      }).join('');
    }
  };

  const initAnniversaryModal = () => {
    const modal = document.getElementById('anniversariesModal');
    if (!modal) return;
    modal.addEventListener('shown.bs.modal', () => {
      modal.querySelector('.anniversary-month-card.is-current')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const initWhatsAppMenu = () => {
    const toggle = document.getElementById('whatsapp-toggle');
    const menu = document.getElementById('whatsapp-menu');
    if (!toggle || !menu) return;

    const setOpen = (isOpen) => {
      menu.hidden = !isOpen;
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Cerrar contactos de WhatsApp' : 'Mostrar contactos de WhatsApp');
      toggle.classList.toggle('is-open', isOpen);
      document.body.classList.toggle('whatsapp-menu-active', isOpen);
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('bi-whatsapp', !isOpen);
        icon.classList.toggle('bi-x-lg', isOpen);
      }
    };

    toggle.addEventListener('click', (event) => { event.stopPropagation(); setOpen(menu.hidden); });
    menu.addEventListener('click', (event) => event.stopPropagation());
    document.addEventListener('click', () => { if (!menu.hidden) setOpen(false); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('show.bs.modal', () => { if (!menu.hidden) setOpen(false); });
  };

  const refreshPublicContent = () => {
    renderContacts();
    renderCurrentMonthAnniversaries();
    renderFullCalendar();
    if (window.AOS && typeof window.AOS.refreshHard === 'function') window.AOS.refreshHard();
  };

  const init = async () => {
    initAnniversaryModal();
    initWhatsAppMenu();
    try {
      await loadSiteData();
      refreshPublicContent();
    } catch (error) {
      console.error('No se pudieron cargar los datos públicos desde Supabase:', error);
      showLoadError();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
