(() => {
  'use strict';

  const db = window.amigosSupabase;
  if (!db) {
    document.body.innerHTML = '<p style="padding:30px;font-family:sans-serif">No se pudo inicializar Supabase.</p>';
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const monthNames = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ];

  const roleInfo = {
    rsg_principal: { title: 'RSG Principal', description: 'Representante del servicio del grupo', icon: 'bi-person-badge-fill', className: 'principal' },
    rsg_alterno: { title: 'RSG Alterno', description: 'Representante alterno del servicio del grupo', icon: 'bi-person-badge', className: 'alternate' },
    secretaria_tesoreria: { title: 'Secretaria / Tesorera', description: 'Secretaría y tesorería del grupo', icon: 'bi-cash-coin', className: 'secretary' }
  };

  let state = {
    user: null,
    profile: null,
    contacts: [],
    anniversaries: [],
    users: []
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  const initials = (name) => String(name || '').trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() || '').join('');

  const showAlert = (message, type = 'success') => {
    const box = $('#admin-alert');
    if (!box) return;
    box.hidden = false;
    box.className = `admin-alert ${type === 'error' ? 'is-error' : 'is-success'}`;
    box.innerHTML = `<i class="bi ${type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}"></i><span>${escapeHtml(message)}</span>`;
    clearTimeout(showAlert.timer);
    showAlert.timer = setTimeout(() => { box.hidden = true; }, 4500);
  };

  const showLoginError = (message) => {
    const box = $('#login-alert');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(message)}</span>`;
  };

  const setView = (name) => {
    $('#login-view').hidden = name !== 'login';
    $('#denied-view').hidden = name !== 'denied';
    $('#admin-view').hidden = name !== 'admin';
  };

  const getProfile = async (userId) => {
    const { data, error } = await db.from('profiles')
      .select('id,display_name,role,active')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const authorizeCurrentUser = async () => {
    const { data: userData, error } = await db.auth.getUser();
    if (error || !userData?.user) {
      state.user = null;
      state.profile = null;
      setView('login');
      return false;
    }

    state.user = userData.user;
    const profile = await getProfile(userData.user.id);
    state.profile = profile;

    if (!profile || !profile.active || !['admin', 'editor'].includes(profile.role)) {
      $('#denied-copy').textContent = profile && !profile.active
        ? 'Tu acceso fue desactivado. Comunícate con un administrador del sitio.'
        : 'Tu cuenta existe en Supabase, pero todavía no tiene un perfil activo como administrador o editor.';
      setView('denied');
      return false;
    }

    setView('admin');
    $('#signed-user').textContent = `${profile.display_name || userData.user.email}`;
    $('#profile-role-label').textContent = profile.role === 'admin' ? 'Administrador' : 'Editor';

    $$('.admin-only').forEach(element => {
      element.hidden = profile.role !== 'admin';
    });

    return true;
  };

  const loadData = async () => {
    const [contactsResult, anniversariesResult] = await Promise.all([
      db.from('service_contacts').select('role,name,phone,active'),
      db.from('anniversaries').select('*').order('recovery_month').order('recovery_day').order('name')
    ]);

    if (contactsResult.error) throw contactsResult.error;
    if (anniversariesResult.error) throw anniversariesResult.error;

    state.contacts = contactsResult.data || [];
    state.anniversaries = anniversariesResult.data || [];
    renderContacts();
    renderAnniversaries();
  };

  const yearsFor = (item) => {
    const y = Number(item.recovery_year);
    if (!Number.isInteger(y) || y <= 0) return null;
    const years = new Date().getFullYear() - y;
    return years > 0 ? years : null;
  };

  const formatCelebration = (item) => {
    if (!item.celebration_date) return '';
    const [y,m,d] = item.celebration_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return '';
    const formatted = new Intl.DateTimeFormat('es-EC', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const renderAnniversaries = () => {
    const list = $('#anniversary-admin-list');
    const count = $('#anniversary-count');
    if (!list || !count) return;

    const query = ($('#anniversary-search')?.value || '').trim().toLocaleLowerCase('es');
    const items = [...state.anniversaries].filter(item => String(item.name).toLocaleLowerCase('es').includes(query));

    count.textContent = `${state.anniversaries.length} compañero${state.anniversaries.length === 1 ? '' : 's'} registrado${state.anniversaries.length === 1 ? '' : 's'}`;

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><i class="bi bi-search"></i><strong>No encontramos registros</strong><span>Prueba otra búsqueda o agrega un compañero.</span></div>';
      return;
    }

    list.innerHTML = items.map(item => {
      const years = yearsFor(item);
      const recovery = years ? `${years} ${years === 1 ? 'año' : 'años'} de recuperación en ${new Date().getFullYear()}` : 'Año de inicio no registrado';
      const celebration = formatCelebration(item);
      const location = String(item.celebration_location || '').trim();
      const visibleBadge = item.public_visible
        ? '<span class="record-visibility"><i class="bi bi-eye"></i>Público</span>'
        : '<span class="record-visibility is-hidden"><i class="bi bi-eye-slash"></i>Oculto</span>';

      return `<article class="record-row">
        <div class="record-avatar">${escapeHtml(initials(item.name))}</div>
        <div class="record-main">
          <div class="record-title-line"><strong>${escapeHtml(item.name)}</strong><span>${String(item.recovery_day).padStart(2,'0')} ${escapeHtml(monthNames[Number(item.recovery_month)-1] || '')}</span>${visibleBadge}</div>
          <small>${escapeHtml(recovery)}</small>
          ${celebration ? `<div class="celebration-chip"><i class="bi bi-calendar-event"></i><span>${escapeHtml(celebration)}${location ? ` · ${escapeHtml(location)}` : ''}</span></div>` : ''}
        </div>
        <div class="record-actions">
          <button type="button" class="icon-btn edit-anniversary" data-id="${escapeHtml(item.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
          <button type="button" class="icon-btn danger delete-anniversary" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}" title="Eliminar"><i class="bi bi-trash3"></i></button>
        </div>
      </article>`;
    }).join('');

    $$('.edit-anniversary', list).forEach(button => button.addEventListener('click', () => editAnniversary(button.dataset.id)));
    $$('.delete-anniversary', list).forEach(button => button.addEventListener('click', () => deleteAnniversary(button.dataset.id, button.dataset.name)));
  };

  const resetAnniversaryForm = () => {
    $('#anniversary-form')?.reset();
    $('#anniversary-id').value = '';
    $('#anniversary-public-visible').checked = true;
    $('#anniversary-form-title').textContent = 'Nuevo compañero';
  };

  const editAnniversary = (id) => {
    const item = state.anniversaries.find(entry => entry.id === id);
    if (!item) return;

    $('#anniversary-id').value = item.id || '';
    $('#anniversary-name').value = item.name || '';
    $('#anniversary-day').value = item.recovery_day || '';
    $('#anniversary-month').value = item.recovery_month || '';
    $('#anniversary-start-year').value = item.recovery_year ?? '';
    $('#anniversary-public-visible').checked = item.public_visible !== false;
    $('#celebration-date').value = item.celebration_date || '';
    $('#celebration-location').value = item.celebration_location || '';
    $('#celebration-latitude').value = item.celebration_latitude ?? '';
    $('#celebration-longitude').value = item.celebration_longitude ?? '';
    $('#celebration-map-url').value = item.celebration_map_url || '';
    $('#anniversary-form-title').textContent = `Editar: ${item.name}`;
    $('#anniversary-editor')?.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  const saveAnniversary = async (event) => {
    event.preventDefault();
    const submit = $('#anniversary-form button[type="submit"]');
    submit.disabled = true;

    const id = $('#anniversary-id').value.trim();
    const startYearRaw = $('#anniversary-start-year').value.trim();
    const latitudeRaw = $('#celebration-latitude').value.trim();
    const longitudeRaw = $('#celebration-longitude').value.trim();

    const payload = {
      name: $('#anniversary-name').value.trim(),
      recovery_day: Number($('#anniversary-day').value),
      recovery_month: Number($('#anniversary-month').value),
      recovery_year: startYearRaw ? Number(startYearRaw) : null,
      celebration_date: $('#celebration-date').value || null,
      celebration_location: $('#celebration-location').value.trim() || null,
      celebration_latitude: latitudeRaw ? Number(latitudeRaw) : null,
      celebration_longitude: longitudeRaw ? Number(longitudeRaw) : null,
      celebration_map_url: $('#celebration-map-url').value.trim() || null,
      public_visible: $('#anniversary-public-visible').checked,
      updated_at: new Date().toISOString()
    };

    try {
      let result;
      if (id) {
        result = await db.from('anniversaries').update(payload).eq('id', id).select().single();
      } else {
        result = await db.from('anniversaries').insert(payload).select().single();
      }
      if (result.error) throw result.error;
      await loadData();
      resetAnniversaryForm();
      showAlert(id ? 'Aniversario actualizado.' : 'Compañero agregado.');
    } catch (error) {
      showAlert(error.message || 'No se pudo guardar el aniversario.', 'error');
    } finally {
      submit.disabled = false;
    }
  };

  const deleteAnniversary = async (id, name) => {
    if (!confirm(`¿Eliminar a ${name} del calendario? Esta acción no se puede deshacer.`)) return;
    const { error } = await db.from('anniversaries').delete().eq('id', id);
    if (error) {
      showAlert(error.message, 'error');
      return;
    }
    await loadData();
    resetAnniversaryForm();
    showAlert('Compañero eliminado.');
  };

  const useCurrentLocation = () => {
    const help = $('#location-help');
    if (!navigator.geolocation) {
      help.textContent = 'Este dispositivo no permite obtener la ubicación.';
      help.className = 'location-help is-error';
      return;
    }
    help.textContent = 'Solicitando ubicación…';
    help.className = 'location-help';

    navigator.geolocation.getCurrentPosition(position => {
      const lat = Number(position.coords.latitude.toFixed(7));
      const lon = Number(position.coords.longitude.toFixed(7));
      $('#celebration-latitude').value = lat;
      $('#celebration-longitude').value = lon;
      $('#celebration-map-url').value = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
      help.textContent = 'Ubicación capturada correctamente.';
      help.className = 'location-help is-success';
    }, error => {
      help.textContent = error.code === 1 ? 'Debes permitir el acceso a la ubicación.' : 'No se pudo obtener la ubicación actual.';
      help.className = 'location-help is-error';
    }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
  };

  const renderContacts = () => {
    const grid = $('#contacts-admin-grid');
    if (!grid) return;
    const order = ['rsg_principal','rsg_alterno','secretaria_tesoreria'];
    const contacts = order.map(role => state.contacts.find(contact => contact.role === role) || { role, name:'', phone:'', active:true });

    grid.innerHTML = contacts.map(contact => {
      const info = roleInfo[contact.role];
      return `<article class="contact-admin-card ${info.className}">
        <div class="contact-admin-head"><span class="contact-admin-icon"><i class="bi ${info.icon}"></i></span><div><span class="role-label">${escapeHtml(info.title)}</span><h3>${escapeHtml(contact.name || 'Sin asignar')}</h3><p>${escapeHtml(info.description)}</p></div></div>
        <form class="contact-form" data-role="${escapeHtml(contact.role)}">
          <label class="field"><span>Nombre</span><input type="text" name="name" value="${escapeHtml(contact.name)}" required maxlength="100"></label>
          <label class="field"><span>Teléfono</span><input type="text" name="phone" value="${escapeHtml(contact.phone)}" required maxlength="30" placeholder="+593 ..."></label>
          <button type="submit" class="btn-primary"><i class="bi bi-floppy"></i> Guardar ${escapeHtml(info.title)}</button>
        </form>
      </article>`;
    }).join('');

    $$('.contact-form', grid).forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = $('button[type="submit"]', form);
        button.disabled = true;
        try {
          const { error } = await db.from('service_contacts')
            .update({ name:form.elements.name.value.trim(), phone:form.elements.phone.value.trim(), active:true, updated_at:new Date().toISOString() })
            .eq('role', form.dataset.role);
          if (error) throw error;
          await loadData();
          showAlert('Contacto actualizado.');
        } catch (error) {
          showAlert(error.message, 'error');
        } finally {
          button.disabled = false;
        }
      });
    });
  };

  const authHeader = async () => {
    const { data, error } = await db.auth.getSession();
    if (error || !data.session?.access_token) throw new Error('La sesión venció. Vuelve a iniciar sesión.');
    return { 'Authorization': `Bearer ${data.session.access_token}`, 'Content-Type':'application/json' };
  };

  const usersApi = async (method = 'GET', body = null) => {
    const headers = await authHeader();
    const response = await fetch('/api/admin-users', {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const result = await response.json().catch(() => ({ ok:false, message:'Respuesta inválida del servidor.' }));
    if (!response.ok || !result.ok) throw new Error(result.message || 'No se pudo completar la operación.');
    return result;
  };

  const loadUsers = async () => {
    if (state.profile?.role !== 'admin') return;
    try {
      const result = await usersApi('GET');
      state.users = result.users || [];
      renderUsers();
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  const renderUsers = () => {
    const list = $('#users-list');
    const count = $('#users-count');
    if (!list || !count) return;
    count.textContent = `${state.users.length} usuario${state.users.length === 1 ? '' : 's'}`;

    if (!state.users.length) {
      list.innerHTML = '<div class="empty-state"><i class="bi bi-person-lock"></i><strong>No hay usuarios para mostrar</strong></div>';
      return;
    }

    list.innerHTML = state.users.map(user => {
      const profile = user.profile || {};
      const displayName = profile.display_name || user.email || 'Usuario';
      const isSelf = user.id === state.user?.id;
      return `<article class="user-row">
        <div class="user-avatar">${escapeHtml(initials(displayName))}</div>
        <div class="user-main">
          <strong>${escapeHtml(displayName)}${isSelf ? ' (tú)' : ''}</strong>
          <span>${escapeHtml(user.email || '')}</span>
          <div class="user-badges">
            <span class="user-badge ${profile.role === 'admin' ? 'admin' : ''}">${escapeHtml(profile.role || 'sin perfil')}</span>
            ${profile.active === false ? '<span class="user-badge inactive">desactivado</span>' : '<span class="user-badge">activo</span>'}
          </div>
        </div>
        <div class="user-actions">
          <select class="user-role-select" data-user-id="${escapeHtml(user.id)}" ${isSelf ? 'disabled' : ''}>
            <option value="editor" ${profile.role === 'editor' ? 'selected' : ''}>Editor</option>
            <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
          <button type="button" class="user-toggle ${profile.active === false ? 'is-inactive' : ''}" data-user-id="${escapeHtml(user.id)}" data-active="${profile.active !== false}" ${isSelf ? 'disabled' : ''}>${profile.active === false ? 'Activar' : 'Desactivar'}</button>
        </div>
      </article>`;
    }).join('');

    $$('.user-role-select', list).forEach(select => {
      select.addEventListener('change', async () => {
        try {
          await usersApi('POST', { action:'update', userId:select.dataset.userId, role:select.value });
          showAlert('Nivel de acceso actualizado.');
          await loadUsers();
        } catch (error) { showAlert(error.message, 'error'); }
      });
    });

    $$('.user-toggle', list).forEach(button => {
      button.addEventListener('click', async () => {
        const currentlyActive = button.dataset.active === 'true';
        const text = currentlyActive ? 'desactivar' : 'activar';
        if (!confirm(`¿Deseas ${text} este acceso?`)) return;
        try {
          await usersApi('POST', { action:'update', userId:button.dataset.userId, active:!currentlyActive });
          showAlert(`Acceso ${currentlyActive ? 'desactivado' : 'activado'}.`);
          await loadUsers();
        } catch (error) { showAlert(error.message, 'error'); }
      });
    });
  };

  const initInvite = () => {
    $('#btn-show-invite')?.addEventListener('click', () => { $('#invite-card').hidden = false; $('#invite-name').focus(); });
    $('#btn-hide-invite')?.addEventListener('click', () => { $('#invite-card').hidden = true; $('#invite-form').reset(); });

    $('#invite-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = $('#invite-form button[type="submit"]');
      button.disabled = true;
      try {
        const result = await usersApi('POST', {
          action:'invite',
          email:$('#invite-email').value.trim(),
          displayName:$('#invite-name').value.trim(),
          role:$('#invite-role').value,
          redirectTo:`${window.location.origin}/admin/`
        });
        showAlert(result.message || 'Invitación enviada.');
        $('#invite-form').reset();
        $('#invite-card').hidden = true;
        await loadUsers();
      } catch (error) {
        showAlert(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  };

  const initTabs = () => {
    $$('.admin-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        const name = tab.dataset.tab;
        $$('.admin-tab').forEach(item => item.classList.toggle('is-active', item === tab));
        $$('.admin-panel').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === name));
        if (name === 'users') await loadUsers();
      });
    });
  };

  const initPasswordModal = () => {
    const modal = $('#password-modal');
    const open = () => { modal.hidden = false; $('#new-password').focus(); };
    const close = () => { modal.hidden = true; $('#password-form').reset(); };

    $('#change-password-button')?.addEventListener('click', open);
    $$('[data-close-password]').forEach(element => element.addEventListener('click', close));

    $('#password-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const password = $('#new-password').value;
      const confirm = $('#confirm-password').value;
      if (password !== confirm) {
        showAlert('Las contraseñas no coinciden.', 'error');
        return;
      }
      const { error } = await db.auth.updateUser({ password });
      if (error) {
        showAlert(error.message, 'error');
        return;
      }
      close();
      showAlert('Contraseña actualizada.');
    });
  };

  const initLogin = () => {
    $('#login-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      $('#login-alert').hidden = true;
      const button = $('#login-button');
      button.disabled = true;
      try {
        const { error } = await db.auth.signInWithPassword({
          email:$('#login-email').value.trim(),
          password:$('#login-password').value
        });
        if (error) throw error;
        if (await authorizeCurrentUser()) {
          await loadData();
          if (state.profile.role === 'admin') await loadUsers();
        }
      } catch (error) {
        showLoginError(error.message || 'No se pudo iniciar sesión.');
      } finally {
        button.disabled = false;
      }
    });

    const logout = async () => {
      await db.auth.signOut();
      state = { user:null, profile:null, contacts:[], anniversaries:[], users:[] };
      setView('login');
    };
    $('#logout-button')?.addEventListener('click', logout);
    $('#denied-logout')?.addEventListener('click', logout);
  };

  const initAnniversaryForm = () => {
    $('#anniversary-form')?.addEventListener('submit', saveAnniversary);
    $('#btn-new-anniversary')?.addEventListener('click', () => { resetAnniversaryForm(); $('#anniversary-editor')?.scrollIntoView({ behavior:'smooth', block:'start' }); });
    $('#btn-reset-anniversary')?.addEventListener('click', resetAnniversaryForm);
    $('#btn-cancel-anniversary')?.addEventListener('click', resetAnniversaryForm);
    $('#anniversary-search')?.addEventListener('input', renderAnniversaries);
    $('#btn-use-location')?.addEventListener('click', useCurrentLocation);
  };

  const boot = async () => {
    initLogin();
    initTabs();
    initAnniversaryForm();
    initInvite();
    initPasswordModal();

    try {
      if (await authorizeCurrentUser()) {
        await loadData();
        if (state.profile.role === 'admin') await loadUsers();

        const hash = window.location.hash;
        if (hash.includes('type=invite') || hash.includes('type=recovery')) {
          $('#password-modal').hidden = false;
        }
      }
    } catch (error) {
      console.error(error);
      setView('login');
      showLoginError('No se pudo verificar tu sesión.');
    }

    db.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') setView('login');
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        try {
          if (await authorizeCurrentUser()) await loadData();
        } catch (error) {
          console.error(error);
        }
      }
    });
  };

  document.addEventListener('DOMContentLoaded', boot, { once:true });
})();
