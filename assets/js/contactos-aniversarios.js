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


  const makeClampedDate = (year, monthIndex, day) => {
    const lastDay = new Date(year, monthIndex + 1, 0, 12).getDate();
    return new Date(year, monthIndex, Math.min(day, lastDay), 12);
  };

  const getRecoveryStartDate = (item) => {
    const year = Number(item.startYear);
    const month = Number(item.month);
    const day = Number(item.day);

    if (!Number.isInteger(year) || year <= 0) return null;
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day, 12);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;

    return date;
  };

  const addYearsClamped = (date, years) =>
    makeClampedDate(date.getFullYear() + years, date.getMonth(), date.getDate());

  const addMonthsClamped = (date, months) => {
    const totalMonths = date.getFullYear() * 12 + date.getMonth() + months;
    const year = Math.floor(totalMonths / 12);
    const monthIndex = totalMonths % 12;
    return makeClampedDate(year, monthIndex, date.getDate());
  };

  const dateOnlyUtc = (date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  const getRecoveryDuration = (item, referenceDate = new Date()) => {
    const start = getRecoveryStartDate(item);
    if (!start) return null;

    const end = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
      12
    );

    if (start > end) {
      return { future: true, years: 0, months: 0, days: 0, start };
    }

    let years = end.getFullYear() - start.getFullYear();
    let anchor = addYearsClamped(start, years);

    if (anchor > end) {
      years -= 1;
      anchor = addYearsClamped(start, years);
    }

    let months = 0;
    while (months < 11) {
      const next = addMonthsClamped(anchor, 1);
      if (next > end) break;
      anchor = next;
      months += 1;
    }

    const days = Math.max(
      0,
      Math.floor((dateOnlyUtc(end) - dateOnlyUtc(anchor)) / 86400000)
    );

    return { future: false, years, months, days, start };
  };

  const joinNatural = (parts) => {
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
  };

  const formatRecoveryDuration = (duration, options = {}) => {
    if (!duration || duration.future) return '';
    const { includeDays = true } = options;
    const parts = [];

    if (duration.years > 0) {
      parts.push(`${duration.years} ${duration.years === 1 ? 'año' : 'años'}`);
    }

    if (duration.months > 0) {
      parts.push(`${duration.months} ${duration.months === 1 ? 'mes' : 'meses'}`);
    }

    if (includeDays && (duration.days > 0 || !parts.length)) {
      parts.push(`${duration.days} ${duration.days === 1 ? 'día' : 'días'}`);
    }

    return joinNatural(parts);
  };

  const getMilestoneForYear = (item, year = new Date().getFullYear()) => {
    const startYear = Number(item.startYear);
    if (!Number.isInteger(startYear) || startYear <= 0) return null;
    const milestone = year - startYear;
    return milestone > 0 ? milestone : null;
  };

  const formatMilestone = (years) =>
    years === 1 ? '1 año de recuperación' : `${years} años de recuperación`;

  const formatRecoveryStartDate = (item) => {
    const start = getRecoveryStartDate(item);
    if (!start) return '';
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(start);
  };


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
        const aCelebration = getCelebrationForYear(a, currentYear)?.date?.getTime()
          || new Date(currentYear, a.month - 1, a.day, 12).getTime();
        const bCelebration = getCelebrationForYear(b, currentYear)?.date?.getTime()
          || new Date(currentYear, b.month - 1, b.day, 12).getTime();
        return aCelebration - bCelebration
          || String(a.name).localeCompare(String(b.name), 'es');
      });

    period.textContent = capitalize(monthLabel);

    if (!entries.length) {
      intro.textContent = `Durante ${monthLabel} no hay aniversarios ni celebraciones programadas. Puedes consultar el calendario completo.`;
      list.innerHTML = `
        <div class="col-12">
          <div class="anniversary-empty anniversary-empty-month">
            <i class="bi bi-calendar2-check"></i>
            <div>
              <strong>No hay aniversarios registrados este mes.</strong>
              <span>Usa el botón “Ver todos” para consultar el calendario anual.</span>
            </div>
          </div>
        </div>`;
      return;
    }

    intro.textContent = `Durante ${monthLabel} acompañamos a ${
      entries.length === 1 ? 'este compañero' : 'estos compañeros'
    } en sus próximos aniversarios y celebraciones de recuperación.`;

    list.innerHTML = entries.map((item, index) => {
      const milestone = getMilestoneForYear(item, currentYear);
      const duration = getRecoveryDuration(item, today);
      const durationText = duration && !duration.future
        ? formatRecoveryDuration(duration)
        : '';
      const celebration = getCelebrationForYear(item, currentYear);
      const animationDelay = 100 + (index * 90);

      const milestoneBadge = milestone
        ? `<div class="anniversary-milestone" aria-label="${escapeHtml(formatMilestone(milestone))}">
             <span>ESTE AÑO</span>
             <strong>${escapeHtml(milestone)}</strong>
             <small>${milestone === 1 ? 'AÑO' : 'AÑOS'}</small>
           </div>`
        : `<div class="anniversary-milestone is-journey" aria-label="Recuperación en curso">
             <i class="bi bi-sunrise-fill"></i>
             <small>EN CAMINO</small>
           </div>`;

      const recoveryCopy = durationText
        ? `<div class="anniversary-live-time">
             <i class="bi bi-hourglass-split"></i>
             <div>
               <span>TIEMPO ACTUAL EN RECUPERACIÓN</span>
               <strong>${escapeHtml(durationText)}</strong>
             </div>
           </div>`
        : `<div class="anniversary-live-time is-unknown">
             <i class="bi bi-stars"></i>
             <div>
               <span>RECUPERACIÓN</span>
               <strong>Próximo aniversario</strong>
             </div>
           </div>`;

      const mapUrl = celebration ? buildCelebrationMapUrl(celebration) : '';
      const celebrationCopy = celebration
        ? `<div class="anniversary-celebration">
             <i class="bi bi-calendar-event-fill"></i>
             <div class="anniversary-celebration-info">
               <span>CELEBRACIÓN PROGRAMADA</span>
               <strong>${escapeHtml(capitalize(formatCelebrationDate(celebration.date)))}</strong>
               ${celebration.location
                 ? `<small class="anniversary-celebration-place">
                      <i class="bi bi-geo-alt-fill"></i>
                      ${escapeHtml(celebration.location)}
                    </small>`
                 : ''}
               ${mapUrl
                 ? `<a class="anniversary-map-link"
                       href="${escapeHtml(mapUrl)}"
                       target="_blank"
                       rel="noopener"
                       aria-label="Ver ubicación de la celebración de ${escapeHtml(item.name)} en Google Maps">
                      <i class="bi bi-map-fill"></i>
                      Cómo llegar
                    </a>`
                 : ''}
             </div>
           </div>`
        : `<div class="anniversary-celebration is-pending">
             <i class="bi bi-calendar2-heart"></i>
             <div>
               <span>CELEBRACIÓN</span>
               <strong>Fecha por confirmar</strong>
               <small>El grupo informará cuando se defina el día.</small>
             </div>
           </div>`;

      return `
        <div class="col-md-6 col-xl-4" data-aos="fade-up" data-aos-delay="${animationDelay}">
          <article class="anniversary-card anniversary-card-v2 is-upcoming">
            <div class="anniversary-card-accent" aria-hidden="true"></div>

            <div class="anniversary-card-head">
              <div class="anniversary-person-mark" aria-hidden="true">
                <span>${escapeHtml(getInitials(item.name))}</span>
                <i class="bi bi-stars"></i>
              </div>
              ${milestoneBadge}
            </div>

            <div class="anniversary-card-content">
              <div class="anniversary-status">
                <i class="bi bi-award-fill"></i>
                <span>Próximo aniversario</span>
              </div>

              <h3>${escapeHtml(item.name)}</h3>

              ${milestone
                ? `<p class="anniversary-milestone-copy">Este año celebra <strong>${escapeHtml(formatMilestone(milestone))}</strong>.</p>`
                : `<p class="anniversary-milestone-copy">Continúa construyendo su recuperación, un día a la vez.</p>`}

              ${recoveryCopy}
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
    const total = siteData.anniversaries.length;

    const summary = `
      <div class="anniversary-calendar-summary">
        <div class="anniversary-calendar-summary-year">
          <span>CALENDARIO</span>
          <strong>${escapeHtml(currentYear)}</strong>
        </div>
        <div class="anniversary-calendar-summary-copy">
          <span>GRUPO AMIGOS VERDADEROS</span>
          <h3>${escapeHtml(total)} ${total === 1 ? 'historia de recuperación' : 'historias de recuperación'}</h3>
          <p>Las fechas muestran el día original de inicio. La celebración puede programarse en una fecha diferente.</p>
        </div>
        <i class="bi bi-stars" aria-hidden="true"></i>
      </div>`;

    const months = monthNames.map((monthName, monthIndex) => {
      const monthNumber = monthIndex + 1;
      const entries = siteData.anniversaries
        .filter((item) => Number(item.month) === monthNumber)
        .sort((a, b) =>
          Number(a.day) - Number(b.day)
          || String(a.name).localeCompare(String(b.name), 'es')
        );

      const currentClass = monthNumber === currentMonth ? ' is-current' : '';
      const countLabel = entries.length === 1
        ? '1 aniversario'
        : `${entries.length} aniversarios`;

      const people = entries.length
        ? entries.map((item) => {
            const duration = getRecoveryDuration(item, currentDate);
            const durationText = duration && !duration.future
              ? formatRecoveryDuration(duration)
              : '';
            const milestone = getMilestoneForYear(item, currentYear);
            const startDate = formatRecoveryStartDate(item);

            const meta = item.startYear
              ? `<div class="anniversary-calendar-meta">
                   <span class="anniversary-calendar-start">
                     <i class="bi bi-calendar-heart"></i>
                     Inicio: ${escapeHtml(startDate)}
                   </span>
                   ${durationText
                     ? `<span class="anniversary-calendar-duration">
                          <i class="bi bi-hourglass-split"></i>
                          ${escapeHtml(durationText)}
                        </span>`
                     : ''}
                 </div>`
              : `<div class="anniversary-calendar-meta">
                   <span class="anniversary-calendar-duration is-missing">
                     <i class="bi bi-info-circle"></i>
                     Año de inicio por registrar
                   </span>
                 </div>`;

            const milestoneTag = milestone
              ? `<span class="anniversary-calendar-milestone">
                   <strong>${escapeHtml(milestone)}</strong>
                   <small>${milestone === 1 ? 'AÑO' : 'AÑOS'}</small>
                 </span>`
              : item.startYear
                ? `<span class="anniversary-calendar-milestone is-current-journey">
                     <i class="bi bi-sunrise-fill"></i>
                     <small>EN CURSO</small>
                   </span>`
                : `<i class="bi bi-stars anniversary-calendar-star" aria-hidden="true"></i>`;

            return `
              <article class="anniversary-calendar-person">
                <span class="anniversary-calendar-day" aria-label="Día ${escapeHtml(item.day)}">
                  ${String(item.day).padStart(2, '0')}
                </span>

                <div class="anniversary-calendar-person-copy">
                  <strong>${escapeHtml(item.name)}</strong>
                  ${meta}
                </div>

                ${milestoneTag}
              </article>`;
          }).join('')
        : `<div class="anniversary-calendar-empty">
             <i class="bi bi-calendar2"></i>
             <span>Sin fechas registradas</span>
           </div>`;

      return `
        <section class="anniversary-month-card${currentClass}" data-anniversary-month="${monthNumber}">
          <header class="anniversary-month-head">
            <span class="anniversary-month-number">${String(monthNumber).padStart(2, '0')}</span>
            <div>
              <h3>${escapeHtml(capitalize(monthName))}</h3>
              <span>${escapeHtml(countLabel)}</span>
            </div>
            ${monthNumber === currentMonth ? '<em>MES ACTUAL</em>' : ''}
          </header>

          <div class="anniversary-month-people">
            ${people}
          </div>
        </section>`;
    }).join('');

    calendar.innerHTML = summary + months;
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