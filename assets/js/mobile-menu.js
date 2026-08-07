/**
 * Corrección independiente para el menú móvil del Grupo Amigos Verdaderos.
 * Se carga después de assets/js/main.js para evitar conflictos con la plantilla.
 */
(() => {
  'use strict';

  const initMobileMenu = () => {
    const body = document.body;
    const nav = document.getElementById('navmenu');
    const toggle = nav?.querySelector('.mobile-nav-toggle');
    const menu = nav?.querySelector(':scope > ul');

    if (!body || !nav || !toggle || !menu || toggle.dataset.mobileMenuReady === 'true') {
      return;
    }

    toggle.dataset.mobileMenuReady = 'true';

    if (!menu.id) {
      menu.id = 'menu-principal-movil';
    }

    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-controls', menu.id);
    toggle.setAttribute('aria-expanded', 'false');

    const setMenuState = (isOpen) => {
      body.classList.toggle('mobile-nav-active', isOpen);
      toggle.classList.toggle('bi-list', !isOpen);
      toggle.classList.toggle('bi-x', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú móvil' : 'Abrir menú móvil');
    };

    const toggleMenu = (event) => {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      setMenuState(!body.classList.contains('mobile-nav-active'));
    };

    /* Captura el evento antes del script original para impedir que se ejecute dos veces. */
    toggle.addEventListener('click', toggleMenu, true);
    toggle.addEventListener('keydown', toggleMenu, true);

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        setMenuState(false);
      }
    });

    nav.addEventListener('click', (event) => {
      if (event.target === nav && body.classList.contains('mobile-nav-active')) {
        setMenuState(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && body.classList.contains('mobile-nav-active')) {
        setMenuState(false);
        toggle.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1200 && body.classList.contains('mobile-nav-active')) {
        setMenuState(false);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu, { once: true });
  } else {
    initMobileMenu();
  }
})();
