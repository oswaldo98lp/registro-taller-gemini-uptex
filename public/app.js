(() => {
  'use strict';

  const form = document.getElementById('registration-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');
  const formAlert = document.getElementById('form-alert');
  const confirmationScreen = document.getElementById('confirmation-screen');
  const registerAnotherBtn = document.getElementById('register-another-btn');
  const refreshAvailabilityBtn = document.getElementById('refresh-availability-btn');

  let isSubmitting = false;

  /**
   * 1. Fallback de :user-invalid con WeakMap y puente ARIA (aria-invalid)
   * siguiendo los lineamientos de modern-web-guidance.
   */
  const UserInvalidFallback = (() => {
    const dirtyState = new WeakMap();

    const updateState = (input) => {
      const isValid = input.checkValidity();
      input.classList.toggle('user-invalid-fallback', !isValid);
      input.classList.toggle('user-valid-fallback', isValid);
      if (!isValid) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
    };

    const handleEvent = (event) => {
      const input = event.target;
      if (event.type === 'reset') {
        const controls = input.elements || [];
        for (const control of controls) {
          dirtyState.delete(control);
          control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          control.removeAttribute('aria-invalid');
        }
        return;
      }

      if (!input || typeof input.checkValidity !== 'function') return;

      if (event.type === 'input' || event.type === 'change') {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(input, state);
        if (state.hasBlurred) {
          updateState(input);
        }
      } else if (event.type === 'blur') {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(input, state);
        if (state.hasInteracted) {
          updateState(input);
        }
      }
    };

    const init = (root = document) => {
      if (CSS.supports('selector(:user-invalid)')) return;
      root.addEventListener('blur', handleEvent, true);
      root.addEventListener('input', handleEvent);
      root.addEventListener('change', handleEvent);
      root.addEventListener('reset', handleEvent, true);
    };

    return { init };
  })();

  UserInvalidFallback.init(form);

  /**
   * Sincroniza aria-invalid con la validez del control en blur, input y submit.
   */
  function syncAriaInvalid(control) {
    if (!control || typeof control.checkValidity !== 'function') return;

    // Validación extra para Nombre Completo (nombre + apellido)
    if (control.id === 'nombreCompleto') {
      const val = control.value.trim();
      if (val && !val.includes(' ')) {
        control.setCustomValidity('Por favor ingresa tu nombre y al menos un apellido.');
      } else {
        control.setCustomValidity('');
      }
    }

    const valid = control.checkValidity();
    if (!valid) {
      control.setAttribute('aria-invalid', 'true');
    } else {
      control.removeAttribute('aria-invalid');
    }
  }

  form.addEventListener(
    'blur',
    (e) => {
      if (e.target.matches('input[required], select[required]')) {
        syncAriaInvalid(e.target);
      }
    },
    true
  );

  form.addEventListener('input', (e) => {
    if (e.target.id === 'nombreCompleto') {
      e.target.setCustomValidity('');
    }
    if (e.target.matches('input[required], select[required]') && e.target.checkValidity()) {
      e.target.removeAttribute('aria-invalid');
    }
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'horario') {
      document.getElementById('horario-error').classList.remove('is-visible');
      highlightSelectedSessionCard(e.target.value);
    }
    if (e.target.name === 'genero') {
      document.getElementById('genero-error').classList.remove('is-visible');
    }
    if (e.target.matches('select[required]')) {
      syncAriaInvalid(e.target);
    }
  });

  /**
   * 2. Fallback con IntersectionObserver para navegadores que no soportan animation-timeline: view()
   */
  if (
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches &&
    !CSS.supports('(animation-timeline: view()) and (animation-range: entry)')
  ) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }
        }
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.45s ease-out, transform 0.45s ease-out';
      observer.observe(el);
    });
  }

  /**
   * 3. Renderizado de configuración editable y disponibilidad en tiempo real
   */
  function applyWorkshopConfig(workshop) {
    if (!workshop) return;

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
    };

    setText('hero-title', workshop.title);
    setText('hero-speaker', workshop.speaker);
    setText('hero-date', workshop.dateFormatted);
    setText('hero-location', workshop.location);
    setText('schedule-location', workshop.location);
    setText('hero-capacity', String(workshop.capacityPerSession));
    setText('conf-workshop-title', workshop.title);

    if (Array.isArray(workshop.aboutWorkshop) && workshop.aboutWorkshop.length > 0) {
      const container = document.getElementById('about-lines-container');
      if (container) {
        container.innerHTML = '';
        workshop.aboutWorkshop.forEach((line) => {
          const p = document.createElement('p');
          p.textContent = line;
          container.appendChild(p);
        });
      }
    }

    if (workshop.whatToBringSummary) {
      setText('what-to-bring-summary', workshop.whatToBringSummary);
    }

    if (Array.isArray(workshop.whatToBringList) && workshop.whatToBringList.length > 0) {
      const ul = document.getElementById('what-to-bring-list');
      if (ul) {
        ul.innerHTML = '';
        workshop.whatToBringList.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = item;
          ul.appendChild(li);
        });
      }
    }
  }

  function updateSessionsUI(sessions) {
    if (!Array.isArray(sessions)) return;

    sessions.forEach((session) => {
      const val = session.value;
      const card = document.querySelector(`.session-card[data-session="${val}"]`);
      const statusPill = document.querySelector(`[data-status-for="${val}"]`);
      const availableText = document.querySelector(`[data-available-text="${val}"]`);
      const progressFill = document.querySelector(`[data-progress-for="${val}"]`);
      const selectBtn = document.querySelector(`[data-select-session="${val}"]`);
      const radioCard = document.querySelector(`[data-radio-card="${val}"]`);
      const radioSpots = document.querySelector(`[data-radio-spots="${val}"]`);
      const radioInput = radioCard ? radioCard.querySelector('input[type="radio"]') : null;

      const pctOccupied =
        session.capacity > 0
          ? Math.min(100, Math.round((session.registered / session.capacity) * 100))
          : 100;

      if (card) {
        card.classList.toggle('is-full', session.isFull);
      }

      if (statusPill) {
        if (session.isFull) {
          statusPill.textContent = 'Cupo lleno';
        } else if (session.available <= 5) {
          statusPill.textContent = `¡Últimos ${session.available}!`;
        } else {
          statusPill.textContent = 'Disponible';
        }
      }

      if (availableText) {
        availableText.innerHTML = session.isFull
          ? '<strong>0</strong> lugares disponibles (Cupo lleno)'
          : `<strong>${session.available}</strong> de ${session.capacity} lugares disponibles`;
      }

      if (progressFill) {
        progressFill.style.width = `${pctOccupied}%`;
      }

      if (selectBtn) {
        selectBtn.disabled = session.isFull;
        selectBtn.textContent = session.isFull
          ? 'Cupo lleno'
          : `Elegir horario ${session.shortTime || val}`;
      }

      if (radioCard && radioInput && radioSpots) {
        radioCard.classList.toggle('is-disabled', session.isFull);
        radioInput.disabled = session.isFull;
        if (session.isFull && radioInput.checked) {
          radioInput.checked = false;
        }
        radioSpots.textContent = session.isFull
          ? 'Cupo lleno (0 disponibles)'
          : `${session.available} lugares disponibles`;
      }
    });
  }

  function highlightSelectedSessionCard(selectedValue) {
    document.querySelectorAll('.session-card').forEach((card) => {
      card.classList.toggle('is-selected', card.dataset.session === selectedValue);
    });
  }

  // Botones de las 3 tarjetas de horario -> seleccionan el radio correspondiente y bajan al formulario
  document.querySelectorAll('[data-select-session]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sessionVal = btn.getAttribute('data-select-session');
      const radio = form.querySelector(`input[name="horario"][value="${sessionVal}"]`);
      if (radio && !radio.disabled) {
        radio.checked = true;
        document.getElementById('horario-error').classList.remove('is-visible');
        highlightSelectedSessionCard(sessionVal);
        const registroSection = document.getElementById('registro');
        if (registroSection) {
          registroSection.scrollIntoView({ behavior: 'smooth' });
        }
        const firstEmptyInput =
          form.querySelector('input[required]:not(:valid)') ||
          document.getElementById('nombreCompleto');
        if (firstEmptyInput) {
          setTimeout(() => firstEmptyInput.focus({ preventScroll: true }), 450);
        }
      }
    });
  });

  async function loadInitialConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.ok) {
        applyWorkshopConfig(data.workshop);
        updateSessionsUI(data.sessions);
      }
    } catch (err) {
      console.error('Error cargando configuración inicial:', err);
    }
  }

  async function refreshAvailability() {
    try {
      if (refreshAvailabilityBtn) {
        refreshAvailabilityBtn.textContent = '↻ Actualizando...';
      }
      const res = await fetch('/api/availability');
      const data = await res.json();
      if (data.ok && data.sessions) {
        updateSessionsUI(data.sessions);
      }
    } catch (err) {
      console.error('Error al actualizar disponibilidad:', err);
    } finally {
      if (refreshAvailabilityBtn) {
        refreshAvailabilityBtn.textContent = '↻ Actualizar disponibilidad';
      }
    }
  }

  if (refreshAvailabilityBtn) {
    refreshAvailabilityBtn.addEventListener('click', refreshAvailability);
  }

  // Actualizar disponibilidad automáticamente cada 30 segundos
  setInterval(refreshAvailability, 30000);
  loadInitialConfig();

  /**
   * 4. Envío del formulario con prevención de doble envío, estado de carga y manejo de errores
   */
  function showFormAlert(message) {
    formAlert.textContent = message;
    formAlert.hidden = false;
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideFormAlert() {
    formAlert.hidden = true;
    formAlert.textContent = '';
  }

  function setSubmittingState(loading) {
    isSubmitting = loading;
    submitBtn.disabled = loading;
    btnSpinner.hidden = !loading;
    btnText.textContent = loading
      ? 'Registrando tu lugar...'
      : 'Confirmar mi registro al taller';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    hideFormAlert();

    // Sincronizar validación en todos los campos requeridos
    const requiredControls = form.querySelectorAll('input[required], select[required]');
    requiredControls.forEach(syncAriaInvalid);

    const selectedHorario = form.querySelector('input[name="horario"]:checked');
    const selectedGenero = form.querySelector('input[name="genero"]:checked');

    const horarioError = document.getElementById('horario-error');
    const generoError = document.getElementById('genero-error');

    horarioError.classList.toggle('is-visible', !selectedHorario);
    generoError.classList.toggle('is-visible', !selectedGenero);

    if (!form.checkValidity() || !selectedHorario || !selectedGenero) {
      // Añadir clase fallback si algún campo está inválido al intentar enviar
      requiredControls.forEach((ctrl) => {
        if (!ctrl.checkValidity()) {
          ctrl.classList.add('user-invalid-fallback');
        }
      });
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }

    setSubmittingState(true);

    const payload = {
      nombreCompleto: document.getElementById('nombreCompleto').value.trim(),
      carrera: document.getElementById('carrera').value.trim(),
      cuatrimestre: document.getElementById('cuatrimestre').value,
      grupo: document.getElementById('grupo').value.trim(),
      horario: selectedHorario.value,
      genero: selectedGenero.value,
      correo: document.getElementById('correo').value.trim(),
      website_url: document.getElementById('website_url').value
    };

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.sessions) {
        updateSessionsUI(result.sessions);
      }

      if (!response.ok || !result.ok) {
        showFormAlert(
          result.message || 'No se pudo completar el registro. Revisa tus datos e intenta de nuevo.'
        );
        setSubmittingState(false);
        return;
      }

      // Mostrar pantalla de confirmación exitosa y actualizar título de la SPA
      const reg = result.registration || {};
      document.getElementById('conf-id').textContent = reg.id || 'Confirmado';
      document.getElementById('conf-name').textContent = reg.nombreCompleto || payload.nombreCompleto;
      document.getElementById('conf-career-group').textContent = `${reg.carrera || payload.carrera} · ${reg.grupo || payload.grupo}`;
      document.getElementById('conf-schedule').textContent = `${reg.fechaEvento || '10 de noviembre de 2026'} · ${reg.horarioDisplay || payload.horario}`;
      document.getElementById('conf-location').textContent = `${reg.lugar || 'Laboratorio 3'} · UPTEX`;
      document.getElementById('conf-email').textContent = reg.correo || payload.correo;

      form.hidden = true;
      document.querySelector('.form-card-header').hidden = true;
      confirmationScreen.hidden = false;
      document.title = '¡Registro Confirmado! | Sesión Google Gemini Multidisciplinaria';
      confirmationScreen.focus();
    } catch (networkErr) {
      console.error('Error de red al enviar formulario:', networkErr);
      showFormAlert(
        'Error de conexión con el servidor. Verifica tu conexión a internet e inténtalo nuevamente.'
      );
    } finally {
      setSubmittingState(false);
    }
  });

  if (registerAnotherBtn) {
    registerAnotherBtn.addEventListener('click', () => {
      form.reset();
      highlightSelectedSessionCard('');
      hideFormAlert();
      confirmationScreen.hidden = true;
      form.hidden = false;
      document.querySelector('.form-card-header').hidden = false;
      document.title = 'Registro | Sesión Google Gemini Multidisciplinaria · GSA 2026 UPTEX';
      document.getElementById('nombreCompleto').focus();
      refreshAvailability();
    });
  }
})();
