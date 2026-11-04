require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const workshopConfig = require('../config/workshop.config');
const sheetsService = require('./services/sheets.service');
const mailService = require('./services/mail.service');
const schedulerService = require('./services/scheduler.service');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Necesario si se despliega detrás de un proxy inverso (Render, Railway, Fly.io, etc.)
app.set('trust proxy', 1);

// Cabeceras de seguridad permitiendo Google Fonts e imágenes propias
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"]
      }
    }
  })
);

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));

// Servir archivos gráficos oficiales (/assets) y el sitio web (/public)
app.use('/assets', express.static(path.join(__dirname, '../assets'), { maxAge: '1d' }));
app.use(express.static(path.join(__dirname, '../public')));

// Límite de peticiones por IP para el endpoint de registro (anti-spam / fuerza bruta)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por IP cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message:
      'Has realizado demasiados intentos desde esta conexión. Por favor espera unos minutos antes de volver a intentarlo.'
  }
});

/**
 * Sanitiza texto eliminando etiquetas HTML, caracteres de control y previniendo
 * inyección de fórmulas en Google Sheets (=, +, -, @ al inicio de una celda).
 */
function sanitizeText(input, maxLength = 120) {
  if (typeof input !== 'string') return '';
  let clean = input
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // Caracteres de control
    .replace(/[<>]/g, '') // Evitar inyección de tags HTML
    .replace(/\s+/g, ' ')
    .trim();

  // Prevenir Formula Injection en hojas de cálculo
  clean = clean.replace(/^[=+\-@]+/, '');

  return clean.slice(0, maxLength);
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 150) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

/**
 * GET /api/config
 * Devuelve la configuración editable del taller junto con el cupo en tiempo real de las 3 sesiones.
 */
app.get('/api/config', async (req, res) => {
  try {
    const sessions = await sheetsService.getSessionAvailability();
    res.json({
      ok: true,
      workshop: {
        community: workshopConfig.community,
        title: workshopConfig.title,
        speaker: workshopConfig.speaker,
        speakerRole: workshopConfig.speakerRole,
        university: workshopConfig.university,
        universityShort: workshopConfig.universityShort,
        location: workshopConfig.location,
        date: workshopConfig.date,
        dateFormatted: workshopConfig.dateFormatted,
        timezone: workshopConfig.timezone,
        capacityPerSession: workshopConfig.capacityPerSession,
        aboutWorkshop: workshopConfig.aboutWorkshop,
        whatToBringSummary: workshopConfig.whatToBringSummary,
        whatToBringList: workshopConfig.whatToBringList,
        cuatrimestres: workshopConfig.cuatrimestres
      },
      sessions,
      storageMode: sheetsService.usingLocalFallback ? 'local-fallback' : 'google-sheets'
    });
  } catch (error) {
    console.error('Error en GET /api/config:', error);
    res.status(500).json({
      ok: false,
      message: 'No se pudo obtener la información de disponibilidad del taller.'
    });
  }
});

/**
 * GET /api/availability
 * Consulta ligera en tiempo real del cupo disponible por sesión.
 */
app.get('/api/availability', async (req, res) => {
  try {
    const sessions = await sheetsService.getSessionAvailability();
    res.json({ ok: true, sessions });
  } catch (error) {
    console.error('Error en GET /api/availability:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al consultar lugares disponibles.'
    });
  }
});

/**
 * POST /api/register
 * Valida, sanitiza, registra en Google Sheets (con Mutex anti-race-condition) y envía correo de confirmación.
 */
app.post('/api/register', registerLimiter, async (req, res) => {
  try {
    const body = req.body || {};

    // 1. Verificación de campo Honeypot anti-bots
    if (body.website_url && String(body.website_url).trim() !== '') {
      console.warn('🤖 Bot bloqueado por campo honeypot.');
      return res.status(200).json({
        ok: true,
        message: '¡Listo! Te enviamos un correo de confirmación.'
      });
    }

    // 2. Sanitización de campos
    const nombreCompleto = sanitizeText(body.nombreCompleto, 120);
    const carrera = sanitizeText(body.carrera, 120);
    const cuatrimestre = sanitizeText(body.cuatrimestre, 40);
    const grupoRaw = sanitizeText(body.grupo, 60);
    const horario = sanitizeText(body.horario, 30);
    const genero = sanitizeText(body.genero, 20);
    const correo = sanitizeText(body.correo, 150).toLowerCase();

    // Si el estudiante seleccionó cuatrimestre y escribió su grupo, los unimos limpiamente para la columna "Grupo"
    let grupoFinal = grupoRaw;
    if (cuatrimestre && grupoRaw && !grupoRaw.toLowerCase().includes('cuatrimestre')) {
      grupoFinal = `${cuatrimestre} · Grupo ${grupoRaw}`;
    } else if (cuatrimestre && !grupoRaw) {
      grupoFinal = cuatrimestre;
    }

    // 3. Validaciones en servidor
    const fieldErrors = {};

    if (!nombreCompleto || nombreCompleto.length < 4 || !nombreCompleto.includes(' ')) {
      fieldErrors.nombreCompleto = 'Por favor ingresa tu nombre y apellidos completos.';
    }

    if (!carrera || carrera.length < 3) {
      fieldErrors.carrera = 'Por favor escribe el nombre de tu carrera o ingeniería.';
    }

    if (!grupoFinal || grupoFinal.length < 1 || !grupoRaw) {
      fieldErrors.grupo = 'Por favor selecciona tu cuatrimestre e indica tu grupo (ej. 4M1).';
    }

    const validHorarios = workshopConfig.sessions.map((s) => s.value);
    if (!validHorarios.includes(horario)) {
      fieldErrors.horario = 'Por favor selecciona uno de los 3 horarios válidos.';
    }

    const validGeneros = ['Hombre', 'Mujer'];
    if (!validGeneros.includes(genero)) {
      fieldErrors.genero = 'Por favor selecciona una opción de género.';
    }

    if (!isValidEmail(correo)) {
      fieldErrors.correo = 'Por favor ingresa un correo electrónico válido.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Por favor revisa los campos marcados en el formulario.',
        errors: fieldErrors
      });
    }

    // 4. Registrar en Google Sheets dentro del bloqueo Mutex
    const registration = await sheetsService.registerParticipant({
      nombreCompleto,
      carrera,
      grupo: grupoFinal,
      horario,
      genero,
      correo
    });

    // 5. Enviar correo de confirmación inmediata y actualizar columna K si tiene éxito
    let emailSent = false;
    try {
      await mailService.sendConfirmation(registration);
      await sheetsService.markEmailSent(registration.rowNumber, registration.id, 'confirmacion');
      emailSent = true;
    } catch (mailError) {
      console.error(
        `⚠️ Registro guardado (${registration.id}), pero falló el envío inicial de confirmación (se reintentará en el scheduler):`,
        mailError.message
      );
    }

    const sessions = await sheetsService.getSessionAvailability();
    const chosenSession = workshopConfig.sessions.find((s) => s.value === horario);

    return res.status(201).json({
      ok: true,
      message: '¡Listo! Te enviamos un correo de confirmación.',
      emailSent,
      registration: {
        id: registration.id,
        nombreCompleto: registration.nombreCompleto,
        carrera: registration.carrera,
        grupo: registration.grupo,
        horario: registration.horario,
        horarioDisplay: chosenSession ? chosenSession.displayTime : registration.horario,
        correo: registration.correo,
        fechaRegistro: registration.fechaRegistro,
        lugar: workshopConfig.location,
        fechaEvento: workshopConfig.dateFormatted
      },
      sessions
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_EMAIL' || error.code === 'SESSION_FULL') {
      const sessions = await sheetsService.getSessionAvailability().catch(() => undefined);
      return res.status(error.status || 409).json({
        ok: false,
        code: error.code,
        message: error.message,
        sessions
      });
    }

    console.error('Error inesperado en POST /api/register:', error);
    return res.status(500).json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message:
        'Ocurrió un error inesperado al procesar tu registro. Por favor inténtalo de nuevo en unos segundos.'
    });
  }
});

/**
 * Endpoint para ejecutar manualmente o mediante Cloud Scheduler / cron-job.org la revisión de recordatorios.
 */
async function handleCronRequest(req, res) {
  const configuredSecret = process.env.CRON_SECRET || 'gsa_2026_uptex_cron_secret_key';
  const providedSecret =
    req.headers['x-cron-secret'] || req.query.secret || (req.body && req.body.secret);

  if (providedSecret !== configuredSecret) {
    return res.status(401).json({
      ok: false,
      message: 'No autorizado. Clave CRON_SECRET inválida.'
    });
  }

  try {
    const simulatedNowISO =
      (req.body && req.body.simulatedNowISO) || req.query.simulatedNowISO || undefined;
    const onlyEmail = (req.body && req.body.onlyEmail) || req.query.onlyEmail || undefined;

    const summary = await schedulerService.processPendingReminders({
      simulatedNowISO,
      onlyEmail
    });
    return res.json({ ok: true, summary });
  } catch (error) {
    console.error('Error en /api/cron/reminders:', error);
    return res.status(500).json({ ok: false, message: error.message });
  }
}

app.post('/api/cron/reminders', handleCronRequest);
app.get('/api/cron/reminders', handleCronRequest);

// Ruta SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log('================================================================');
    console.log(`🚀 Servidor iniciado en: http://localhost:${PORT}`);
    console.log(`🎓 Taller: ${workshopConfig.title}`);
    console.log(`🎤 Ponente: ${workshopConfig.speaker} (${workshopConfig.speakerRole})`);
    console.log(`🏛️  Sede: ${workshopConfig.location} - ${workshopConfig.university}`);
    console.log(`🌎 Zona horaria: ${workshopConfig.timezone}`);
    console.log('================================================================');

    await sheetsService.init();
    schedulerService.start();
  });
}

module.exports = app;
