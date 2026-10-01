(() => {
  "use strict";
  const treasurySetup = /type=(invite|recovery)/.test(window.location.hash);

  const db = window.amigosSupabase;
  if (!db) {
    document.body.innerHTML =
      '<p style="padding:30px;font-family:sans-serif">No se pudo inicializar Supabase.</p>';
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];

  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const roleInfo = {
    rsg_principal: {
      title: "RSG Principal",
      description: "Representante del servicio del grupo",
      icon: "bi-person-badge-fill",
      className: "principal",
    },
    rsg_alterno: {
      title: "RSG Alterno",
      description: "Representante alterno del servicio del grupo",
      icon: "bi-person-badge",
      className: "alternate",
    },
    secretaria_tesoreria: {
      title: "Secretaria / Tesorera",
      description: "Secretaría y tesorería del grupo",
      icon: "bi-cash-coin",
      className: "secretary",
    },
  };

  let authVersion = 0, signingOut = false;
  let state = {
    user: null,
    profile: null,
    contacts: [],
    anniversaries: [],
    users: [],
  };

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[c],
    );

  const initials = (name) =>
    String(name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");

  const showAlert = (message, type = "success") => {
    const box = $("#admin-alert");
    if (!box) return;
    box.hidden = false;
    box.className = `admin-alert ${type === "error" ? "is-error" : "is-success"}`;
    box.innerHTML = `<i class="bi ${type === "error" ? "bi-exclamation-circle-fill" : "bi-check-circle-fill"}"></i><span>${escapeHtml(message)}</span>`;
    clearTimeout(showAlert.timer);
    showAlert.timer = setTimeout(() => {
      box.hidden = true;
    }, 4500);
  };

  const showLoginError = (message) => {
    const box = $("#login-alert");
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i><span>${escapeHtml(message)}</span>`;
  };

  const setView = (name) => {
    $("#login-view").hidden = name !== "login";
    $("#denied-view").hidden = name !== "denied";
    $("#admin-view").hidden = name !== "admin";
  };

  const clearSessionUI = () => {
    authVersion++;
    usersRequest++;
    setView("login");
    state = {user:null,profile:null,contacts:[],anniversaries:[],users:[]};
    for (const id of ["users-list","anniversary-admin-list","credential-password","signed-user","session-email","session-role"]) $("#"+id)?.replaceChildren();
    $("#credential-result").hidden = true;
    $("#password-modal").hidden = true;
    $("#password-form").reset();
    $("#login-password").value = "";
  };

  const getProfile = async (userId) => {
    const { data, error } = await db
      .from("profiles")
      .select("id,display_name,role,active")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const authorizeCurrentUser = async () => {
    if (signingOut) return false;
    const ticket = ++authVersion;
    const { data: userData, error } = await db.auth.getUser();
    if (ticket !== authVersion || signingOut) return false;
    if (error || !userData?.user) {
      state.user = null;
      state.profile = null;
      setView("login");
      return false;
    }

    state.user = userData.user;
    const profile = await getProfile(userData.user.id);
    if (ticket !== authVersion || signingOut) return false;
    state.profile = profile;

    if (profile?.active && ["treasurer", "auditor"].includes(profile.role)) {
      window.location.replace(
        "../tesoreria/" + (treasurySetup ? "?setup=1" : ""),
      );
      return false;
    }

    if (
      !profile ||
      !profile.active ||
      !["admin", "editor"].includes(profile.role)
    ) {
      $("#denied-copy").textContent =
        profile && !profile.active
          ? "Tu acceso fue desactivado. Comunícate con un administrador del sitio."
          : "Tu cuenta existe en Supabase, pero todavía no tiene un perfil activo como administrador o editor.";
      setView("denied");
      return false;
    }

    $("#logout-retry").hidden = true;
    $("#login-alert").hidden = true;
    setView("admin");
    $("#signed-user").textContent =
      `${profile.display_name || userData.user.email}`;
    $("#session-email").textContent = userData.user.email || "";
    $("#session-role").textContent = profile.role === "admin" ? "Administrador" : "Editor";
    $("#profile-role-label").textContent =
      profile.role === "admin" ? "Administrador" : "Editor";

    $$(".admin-only").forEach((element) => {
      element.hidden = profile.role !== "admin";
    });

    return true;
  };

  let invitationFieldsAvailable = false;
  const loadData = async () => {
    const ticket = authVersion;
    const [contactsResult, anniversariesResult] = await Promise.all([
      db.from("service_contacts").select("role,name,phone,active"),
      db
        .from("anniversaries")
        .select("*")
        .order("recovery_month")
        .order("recovery_day")
        .order("name"),
    ]);

    if (ticket !== authVersion || signingOut || !state.user) return;
    if (contactsResult.error) throw contactsResult.error;
    if (anniversariesResult.error) throw anniversariesResult.error;

    state.contacts = contactsResult.data || [];
    state.anniversaries = anniversariesResult.data || [];
    const extras = await db
      .from("anniversaries")
      .select("celebration_message,celebration_location_confirmed")
      .limit(0);
    if (ticket !== authVersion || signingOut || !state.user) return;
    invitationFieldsAvailable = !extras.error;
    $("#invitation-fields").disabled = !invitationFieldsAvailable;
    $("#invitation-schema-note").textContent = invitationFieldsAvailable
      ? "Invitación: el mensaje y la confirmación del lugar se guardan con la celebración."
      : "Las invitaciones requieren aplicar sql/03_invitaciones_aniversarios.sql en Supabase. Los demás campos siguen disponibles.";
    renderContacts();
    renderAnniversaries();
  };

  const makeClampedDate = (year, monthIndex, day) => {
    const lastDay = new Date(year, monthIndex + 1, 0, 12).getDate();
    return new Date(year, monthIndex, Math.min(day, lastDay), 12);
  };

  const getRecoveryStartDate = (item) => {
    const year = Number(item.recovery_year);
    const month = Number(item.recovery_month);
    const day = Number(item.recovery_day);

    if (!Number.isInteger(year) || year <= 0) return null;
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day, 12);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    )
      return null;

    return date;
  };

  const addYearsClamped = (date, years) =>
    makeClampedDate(
      date.getFullYear() + years,
      date.getMonth(),
      date.getDate(),
    );

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
      12,
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
      Math.floor((dateOnlyUtc(end) - dateOnlyUtc(anchor)) / 86400000),
    );

    return { future: false, years, months, days, start };
  };

  const joinNatural = (parts) => {
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
  };

  const formatRecoveryDuration = (duration) => {
    if (!duration || duration.future) return "";
    const parts = [];

    if (duration.years > 0) {
      parts.push(`${duration.years} ${duration.years === 1 ? "año" : "años"}`);
    }
    if (duration.months > 0) {
      parts.push(
        `${duration.months} ${duration.months === 1 ? "mes" : "meses"}`,
      );
    }
    if (duration.days > 0 || !parts.length) {
      parts.push(`${duration.days} ${duration.days === 1 ? "día" : "días"}`);
    }

    return joinNatural(parts);
  };

  const formatStartDate = (item) => {
    const date = getRecoveryStartDate(item);
    if (!date) return "";
    const formatted = new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const formatCelebration = (item) => {
    if (!item.celebration_date) return "";
    const [y, m, d] = item.celebration_date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return "";
    const formatted = new Intl.DateTimeFormat("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const renderAnniversaries = () => {
    const list = $("#anniversary-admin-list");
    const count = $("#anniversary-count");
    if (!list || !count) return;

    const query = ($("#anniversary-search")?.value || "")
      .trim()
      .toLocaleLowerCase("es");
    const items = [...state.anniversaries].filter((item) =>
      String(item.name).toLocaleLowerCase("es").includes(query),
    );

    count.textContent = `${state.anniversaries.length} compañero${state.anniversaries.length === 1 ? "" : "s"} registrado${state.anniversaries.length === 1 ? "" : "s"}`;

    if (!items.length) {
      list.innerHTML =
        '<div class="empty-state"><i class="bi bi-search"></i><strong>No encontramos registros</strong><span>Prueba otra búsqueda o agrega un compañero.</span></div>';
      return;
    }

    list.innerHTML = items
      .map((item) => {
        const duration = getRecoveryDuration(item);
        const recovery = duration
          ? duration.future
            ? `La fecha de inicio (${formatStartDate(item)}) es posterior a hoy. Revisa el registro.`
            : `Tiempo en recuperación: ${formatRecoveryDuration(duration)}`
          : "Año de inicio por registrar";
        const celebration = formatCelebration(item);
        const location = String(item.celebration_location || "").trim();
        const visibleBadge = item.public_visible
          ? '<span class="record-visibility"><i class="bi bi-eye"></i>Público</span>'
          : '<span class="record-visibility is-hidden"><i class="bi bi-eye-slash"></i>Oculto</span>';

        return `<article class="record-row">
        <div class="record-avatar">${escapeHtml(initials(item.name))}</div>
        <div class="record-main">
          <div class="record-title-line"><strong>${escapeHtml(item.name)}</strong><span>${String(item.recovery_day).padStart(2, "0")} ${escapeHtml(monthNames[Number(item.recovery_month) - 1] || "")}</span>${visibleBadge}</div>
          <small>${escapeHtml(recovery)}</small>
          ${celebration ? `<div class="celebration-chip"><i class="bi bi-calendar-event"></i><span>${escapeHtml(celebration)}${location ? ` · ${escapeHtml(location)}` : ""}</span></div>` : ""}
        </div>
        <div class="record-actions">
          <button type="button" class="icon-btn edit-anniversary" data-id="${escapeHtml(item.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
          <button type="button" class="icon-btn danger delete-anniversary" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}" title="Eliminar"><i class="bi bi-trash3"></i></button>
        </div>
      </article>`;
      })
      .join("");

    $$(".edit-anniversary", list).forEach((button) =>
      button.addEventListener("click", () =>
        editAnniversary(button.dataset.id),
      ),
    );
    $$(".delete-anniversary", list).forEach((button) =>
      button.addEventListener("click", () =>
        deleteAnniversary(button.dataset.id, button.dataset.name),
      ),
    );
  };

  const resetAnniversaryForm = () => {
    $("#anniversary-form")?.reset();
    $("#anniversary-id").value = "";
    $("#anniversary-public-visible").checked = true;
    $("#anniversary-form-title").textContent = "Nuevo compañero";
  };

  const editAnniversary = (id) => {
    const item = state.anniversaries.find((entry) => entry.id === id);
    if (!item) return;

    $("#anniversary-id").value = item.id || "";
    $("#anniversary-name").value = item.name || "";
    $("#anniversary-day").value = item.recovery_day || "";
    $("#anniversary-month").value = item.recovery_month || "";
    $("#anniversary-start-year").value = item.recovery_year ?? "";
    $("#anniversary-public-visible").checked = item.public_visible !== false;
    $("#celebration-date").value = item.celebration_date || "";
    $("#celebration-time").value = window.AnniversaryModel.time(
      item.celebration_time,
    );
    $("#celebration-message").value = item.celebration_message || "";
    $("#celebration-location-confirmed").checked =
      item.celebration_location_confirmed === true;
    $("#celebration-location").value = item.celebration_location || "";
    $("#celebration-latitude").value = item.celebration_latitude ?? "";
    $("#celebration-longitude").value = item.celebration_longitude ?? "";
    $("#celebration-map-url").value = item.celebration_map_url || "";
    $("#anniversary-form-title").textContent = `Editar: ${item.name}`;
    $("#anniversary-editor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const saveAnniversary = async (event) => {
    event.preventDefault();
    const submit = $('#anniversary-form button[type="submit"]');
    submit.disabled = true;

    const id = $("#anniversary-id").value.trim();
    const startYearRaw = $("#anniversary-start-year").value.trim();
    const latitudeRaw = $("#celebration-latitude").value.trim();
    const longitudeRaw = $("#celebration-longitude").value.trim();

    const payload = {
      name: $("#anniversary-name").value.trim(),
      recovery_day: Number($("#anniversary-day").value),
      recovery_month: Number($("#anniversary-month").value),
      recovery_year: startYearRaw ? Number(startYearRaw) : null,
      celebration_date: $("#celebration-date").value || null,
      celebration_time: $("#celebration-time").value || null,
      celebration_location: $("#celebration-location").value.trim() || null,
      celebration_latitude: latitudeRaw ? Number(latitudeRaw) : null,
      celebration_longitude: longitudeRaw ? Number(longitudeRaw) : null,
      celebration_map_url: $("#celebration-map-url").value.trim() || null,
      public_visible: $("#anniversary-public-visible").checked,
      updated_at: new Date().toISOString(),
    };

    try {
      if (
        payload.celebration_time &&
        !window.AnniversaryModel.time(payload.celebration_time)
      )
        throw new Error("Indica una hora válida.");
      if (payload.celebration_time && !payload.celebration_date)
        throw new Error("Indica la fecha de celebración para guardar su hora.");
      if (
        payload.celebration_map_url &&
        !window.AnniversaryModel.mapsUrl(payload.celebration_map_url)
      )
        throw new Error("Pega un enlace válido de Google Maps.");
      if (invitationFieldsAvailable) {
        payload.celebration_message =
          $("#celebration-message").value.trim() || null;
        payload.celebration_location_confirmed = $(
          "#celebration-location-confirmed",
        ).checked;
        if (
          (payload.celebration_message ||
            payload.celebration_location_confirmed) &&
          !payload.celebration_date
        )
          throw new Error(
            "Indica la fecha de celebración para publicar la invitación.",
          );
        if (
          payload.celebration_location_confirmed &&
          !payload.celebration_location &&
          !payload.celebration_map_url &&
          !(latitudeRaw && longitudeRaw)
        )
          throw new Error(
            "Añade el lugar, sus coordenadas o su enlace de Maps antes de confirmarlo.",
          );
      }
      let result;
      if (id) {
        result = await db
          .from("anniversaries")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
      } else {
        result = await db
          .from("anniversaries")
          .insert(payload)
          .select()
          .single();
      }
      if (result.error) throw result.error;
      await loadData();
      resetAnniversaryForm();
      showAlert(id ? "Aniversario actualizado." : "Compañero agregado.");
    } catch (error) {
      showAlert(error.message || "No se pudo guardar el aniversario.", "error");
    } finally {
      submit.disabled = false;
    }
  };

  const deleteAnniversary = async (id, name) => {
    if (
      !confirm(
        `¿Eliminar a ${name} del calendario? Esta acción no se puede deshacer.`,
      )
    )
      return;
    const { error } = await db.from("anniversaries").delete().eq("id", id);
    if (error) {
      showAlert(error.message, "error");
      return;
    }
    await loadData();
    resetAnniversaryForm();
    showAlert("Compañero eliminado.");
  };

  const useCurrentLocation = () => {
    const help = $("#location-help");
    if (!navigator.geolocation) {
      help.textContent = "Este dispositivo no permite obtener la ubicación.";
      help.className = "location-help is-error";
      return;
    }
    help.textContent = "Solicitando ubicación…";
    help.className = "location-help";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(7));
        const lon = Number(position.coords.longitude.toFixed(7));
        $("#celebration-location-confirmed").checked = false;
        $("#celebration-latitude").value = lat;
        $("#celebration-longitude").value = lon;
        $("#celebration-map-url").value =
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
        help.textContent = "Ubicación capturada correctamente.";
        help.className = "location-help is-success";
      },
      (error) => {
        help.textContent =
          error.code === 1
            ? "Debes permitir el acceso a la ubicación."
            : "No se pudo obtener la ubicación actual.";
        help.className = "location-help is-error";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const renderContacts = () => {
    const grid = $("#contacts-admin-grid");
    if (!grid) return;
    const order = ["rsg_principal", "rsg_alterno", "secretaria_tesoreria"];
    const contacts = order.map(
      (role) =>
        state.contacts.find((contact) => contact.role === role) || {
          role,
          name: "",
          phone: "",
          active: true,
        },
    );

    grid.innerHTML = contacts
      .map((contact) => {
        const info = roleInfo[contact.role];
        return `<article class="contact-admin-card ${info.className}">
        <div class="contact-admin-head"><span class="contact-admin-icon"><i class="bi ${info.icon}"></i></span><div><span class="role-label">${escapeHtml(info.title)}</span><h3>${escapeHtml(contact.name || "Sin asignar")}</h3><p>${escapeHtml(info.description)}</p></div></div>
        <form class="contact-form" data-role="${escapeHtml(contact.role)}">
          <label class="field"><span>Nombre</span><input type="text" name="name" value="${escapeHtml(contact.name)}" required maxlength="100"></label>
          <label class="field"><span>Teléfono</span><input type="text" name="phone" value="${escapeHtml(contact.phone)}" required maxlength="30" placeholder="+593 ..."></label>
          <button type="submit" class="btn-primary"><i class="bi bi-floppy"></i> Guardar ${escapeHtml(info.title)}</button>
        </form>
      </article>`;
      })
      .join("");

    $$(".contact-form", grid).forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = $('button[type="submit"]', form);
        button.disabled = true;
        try {
          const { error } = await db
            .from("service_contacts")
            .update({
              name: form.elements.name.value.trim(),
              phone: form.elements.phone.value.trim(),
              active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("role", form.dataset.role);
          if (error) throw error;
          await loadData();
          showAlert("Contacto actualizado.");
        } catch (error) {
          showAlert(error.message, "error");
        } finally {
          button.disabled = false;
        }
      });
    });
  };

  const authHeader = async () => {
    const { data, error } = await Promise.race([
      db.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(new Error("La sesión tardó demasiado. Recarga la página.")),
          10000,
        ),
      ),
    ]);
    if (error || !data.session?.access_token)
      throw new Error("La sesión venció. Vuelve a iniciar sesión.");
    return {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    };
  };

  const usersApi = async (method = "GET", body = null) => {
    // Listing and access changes use an authorized database RPC, independent of server secrets.
    if (method === "GET" || body?.action === "update") {
      const call =
        method === "GET"
          ? db.rpc("admin_list_users").abortSignal(AbortSignal.timeout(12000))
          : db
              .rpc("admin_set_user_access", {
                p_user_id: body.userId,
                p_role: body.role ?? null,
                p_active: body.active ?? null,
              })
              .abortSignal(AbortSignal.timeout(12000));
      const { data, error } = await call;
      if (error)
        throw new Error(
          /abort|timeout|fetch/i.test(error.message || "")
            ? "La consulta no respondió a tiempo. Revisa la conexión y vuelve a intentar."
            : error.message ||
              "No se pudo cargar la información. Intenta de nuevo.",
        );
      return { ok: true, users: method === "GET" ? data : undefined };
    }
    const headers = await authHeader();
    const response = await fetch("/api/admin-users", {
      method,
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(22000),
    });
    const result = await response
      .json()
      .catch(() => ({
        ok: false,
        message: "El servidor no devolvió una respuesta válida.",
      }));
    if (!response.ok || !result.ok)
      throw new Error(result.message || "No se pudo completar la operación.");
    return result;
  };

  let usersRequest = 0;
  const loadUsers = async () => {
    if (state.profile?.role !== "admin") return;
    const current = ++usersRequest;
    $("#users-count").textContent = "Cargando usuarios…";
    $("#users-list").innerHTML =
      '<div class="empty-state">Consultando los accesos del grupo…</div>';
    try {
      const result = await usersApi("GET");
      if (current !== usersRequest) return;
      state.users = result.users || [];
      renderUsers();
    } catch (error) {
      if (current !== usersRequest) return;
      $("#users-count").textContent = "No se pudo cargar";
      $("#users-list").innerHTML =
        `<div class="empty-state"><strong>No pudimos consultar los accesos.</strong><p>${escapeHtml(error.message || "Revisa tu conexión.")}</p><button type="button" class="btn-secondary" id="retry-users">Volver a intentar</button></div>`;
      $("#retry-users").onclick = loadUsers;
    }
  };

  const renderUsers = () => {
    const list = $("#users-list");
    const count = $("#users-count");
    if (!list || !count) return;
    count.textContent = `${state.users.length} usuario${state.users.length === 1 ? "" : "s"}`;

    if (!state.users.length) {
      list.innerHTML =
        '<div class="empty-state"><i class="bi bi-person-lock"></i><strong>No hay usuarios para mostrar</strong></div>';
      return;
    }

    list.innerHTML = state.users
      .map((user) => {
        const profile = user.profile || {};
        const displayName = profile.display_name || user.email || "Usuario";
        const isSelf = user.id === state.user?.id;
        return `<article class="user-row">
        <div class="user-avatar">${escapeHtml(initials(displayName))}</div>
        <div class="user-main">
          <strong>${escapeHtml(displayName)}${isSelf ? " (tú)" : ""}</strong>
          <span>${escapeHtml(user.email || "")}</span>
          <div class="user-badges">
            <span class="user-badge ${profile.role === "admin" ? "admin" : ""}">${escapeHtml({ admin: "Administrador", editor: "Editor", treasurer: "Tesorería", auditor: "Solo consulta" }[profile.role] || "Sin permiso")}</span>
            ${profile.active === true ? '<span class="user-badge">Activo</span>' : '<span class="user-badge inactive">Inactivo</span>'}
          </div>
        </div>
        <div class="user-actions">
          <select class="user-role-select" data-user-id="${escapeHtml(user.id)}" ${isSelf ? "disabled" : ""}>
            <option value="editor" ${profile.role === "editor" ? "selected" : ""}>Editor</option>
            <option value="treasurer" ${profile.role === "treasurer" ? "selected" : ""}>Tesorería</option>
            <option value="auditor" ${profile.role === "auditor" ? "selected" : ""}>Revisión de Tesorería</option>
            <option value="admin" ${profile.role === "admin" ? "selected" : ""}>Administrador</option>
          </select>
          <button type="button" class="user-toggle ${profile.active === false ? "is-inactive" : ""}" data-user-id="${escapeHtml(user.id)}" data-active="${profile.active === true}" ${isSelf ? "disabled" : ""}>${profile.active === true ? "Dar de baja" : "Activar"}</button>
        </div>
      </article>`;
      })
      .join("");

    $$(".user-role-select", list).forEach((select) => {
      select.addEventListener("change", async () => {
        try {
          await usersApi("POST", {
            action: "update",
            userId: select.dataset.userId,
            role: select.value,
          });
          showAlert("Nivel de acceso actualizado.");
          await loadUsers();
        } catch (error) {
          showAlert(error.message, "error");
        }
      });
    });

    $$(".user-toggle", list).forEach((button) => {
      button.addEventListener("click", async () => {
        const currentlyActive = button.dataset.active === "true";
        const text = currentlyActive ? "desactivar" : "activar";
        if (!confirm(`¿Deseas ${text} este acceso?`)) return;
        try {
          await usersApi("POST", {
            action: "update",
            userId: button.dataset.userId,
            active: !currentlyActive,
          });
          showAlert(`Acceso ${currentlyActive ? "desactivado" : "activado"}.`);
          await loadUsers();
        } catch (error) {
          showAlert(error.message, "error");
        }
      });
    });
  };

  const initInvite = () => {
    $("#refresh-users").onclick = loadUsers;
    $("#create-mode").onchange = () => {
      const direct = $("#create-mode").value === "create";
      $("#initial-password-field").hidden = !direct;
      $("#initial-password").required = direct;
    };
    $("#generate-password").onclick = () => {
      const values = crypto.getRandomValues(new Uint8Array(20));
      const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
      $("#initial-password").value = Array.from(
        values,
        (x) => chars[x % chars.length],
      ).join("");
    };
    $("#hide-credentials").onclick = () => {
      $("#credential-password").textContent = "";
      $("#credential-email").textContent = "";
      $("#credential-result").hidden = true;
    };

    $("#btn-show-invite")?.addEventListener("click", () => {
      $("#invite-card").hidden = false;
      $("#invite-name").focus();
    });
    $("#btn-hide-invite")?.addEventListener("click", () => {
      $("#invite-card").hidden = true;
      $("#invite-form").reset();
    });

    $("#invite-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = $('#invite-form button[type="submit"]');
      button.disabled = true;
      try {
        const result = await usersApi("POST", {
          action: $("#create-mode").value,
          email: $("#invite-email").value.trim(),
          displayName: $("#invite-name").value.trim(),
          role: $("#invite-role").value,
          password: $("#initial-password").value,
          redirectTo: `${window.location.origin}/admin/`,
        });
        showAlert(result.message || "Usuario creado.");
        $("#credential-result").hidden = false;
        $("#credential-email").textContent = $("#invite-email").value.trim();
        $("#credential-password").textContent =
          $("#create-mode").value === "create"
            ? $("#initial-password").value
            : "Invitación por correo";
        $("#invite-form").reset();
        $("#invite-card").hidden = true;
        await loadUsers();
      } catch (error) {
        showAlert(error.message, "error");
      } finally {
        button.disabled = false;
      }
    });
  };

  const initTabs = () => {
    $$(".admin-tab").forEach((tab) => {
      tab.addEventListener("click", async () => {
        const name = tab.dataset.tab;
        $$(".admin-tab").forEach((item) =>
          item.classList.toggle("is-active", item === tab),
        );
        $$(".admin-panel").forEach((panel) =>
          panel.classList.toggle("is-active", panel.dataset.panel === name),
        );
        if (name === "users") await loadUsers();
      });
    });
  };

  const initPasswordModal = () => {
    const modal = $("#password-modal");
    const open = () => {
      modal.hidden = false;
      $("#new-password").focus();
    };
    const close = () => {
      modal.hidden = true;
      $("#password-form").reset();
    };

    $("#change-password-button")?.addEventListener("click", open);
    $$("[data-close-password]").forEach((element) =>
      element.addEventListener("click", close),
    );

    $("#password-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = $("#new-password").value;
      const confirm = $("#confirm-password").value;
      if (password !== confirm) {
        showAlert("Las contraseñas no coinciden.", "error");
        return;
      }
      const { error } = await db.auth.updateUser({ password });
      if (error) {
        showAlert(error.message, "error");
        return;
      }
      close();
      showAlert("Contraseña actualizada.");
    });
  };

  const initLogin = () => {
    $("#login-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      $("#login-alert").hidden = true;
      const button = $("#login-button");
      button.disabled = true;
      try {
        const { error } = await db.auth.signInWithPassword({
          email: $("#login-email").value.trim(),
          password: $("#login-password").value,
        });
        if (error) throw error;
        if (await authorizeCurrentUser()) {
          await loadData();
          if (state.profile?.role === "admin") await loadUsers();
        }
      } catch (error) {
        showLoginError(error.message || "No se pudo iniciar sesión.");
      } finally {
        button.disabled = false;
      }
    });

    const logout = async () => {
      if (signingOut) return;
      signingOut = true;
      clearSessionUI();
      const button = $("#login-form button[type=submit]");
      button.disabled = true;
      showLoginError("Cerrando sesión…");
      try {
        const {error} = await db.auth.signOut({scope:"local"});
        if (error) throw error;
        showLoginError("Sesión cerrada.");
      } catch (error) {
        showLoginError("No se pudo confirmar el cierre. Revisa la conexión y pulsa Reintentar cierre.");
        $("#logout-retry").hidden = false;
      } finally {
        signingOut = false;
        button.disabled = false;
      }
    };
    $("#logout-retry").onclick = () => { $("#logout-retry").hidden = true; logout(); };
    $("#logout-button")?.addEventListener("click", logout);
    $("#denied-logout")?.addEventListener("click", logout);
  };

  const initAnniversaryForm = () => {
    $("#anniversary-form")?.addEventListener("submit", saveAnniversary);
    [
      "celebration-date",
      "celebration-location",
      "celebration-latitude",
      "celebration-longitude",
      "celebration-map-url",
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => {
        $("#celebration-location-confirmed").checked = false;
      });
    });
    $("#btn-new-anniversary")?.addEventListener("click", () => {
      resetAnniversaryForm();
      $("#anniversary-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    $("#btn-reset-anniversary")?.addEventListener(
      "click",
      resetAnniversaryForm,
    );
    $("#btn-cancel-anniversary")?.addEventListener(
      "click",
      resetAnniversaryForm,
    );
    $("#anniversary-search")?.addEventListener("input", renderAnniversaries);
    $("#btn-use-location")?.addEventListener("click", useCurrentLocation);
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
        if (state.profile?.role === "admin") await loadUsers();

        const hash = window.location.hash;
        if (hash.includes("type=invite") || hash.includes("type=recovery")) {
          $("#password-modal").hidden = false;
        }
      }
    } catch (error) {
      console.error(error);
      setView("login");
      showLoginError("No se pudo verificar tu sesión.");
    }

    db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearSessionUI();
        showLoginError("Sesión cerrada.");
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // Avoid awaiting Auth methods inside Supabase's auth-state lock.
        const ticket = authVersion;
        setTimeout(async () => {
          if (ticket !== authVersion || signingOut) return;
          try {
            if (await authorizeCurrentUser()) await loadData();
          } catch (error) {
            console.error(error);
          }
        }, 0);
      }
    });
  };

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
