const workshopConfig = require('../../config/workshop.config');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSessionDetails(horarioValue) {
  return (
    workshopConfig.sessions.find((s) => s.value === horarioValue) || {
      value: horarioValue,
      name: 'Sesión del Taller',
      displayTime: `${horarioValue} hrs`,
      accentColor: '#4285F4'
    }
  );
}

/**
 * Envuelve el contenido HTML en una plantilla de correo responsiva con la barra de colores de Google,
 * encabezado de Estudiantes Embajadores de Google 2026 y pie de página de UPTEX.
 */
function buildBaseEmailHtml({ badgeText, badgeColor, heading, subheading, bodyHtml, footerNote }) {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:'Google Sans','Poppins','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#202124;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(32,33,36,0.08);border:1px solid #e8eaed;">
          <!-- Barra superior de 4 colores de Google -->
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="25%" height="6" style="background-color:#4285F4;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="25%" height="6" style="background-color:#EA4335;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="25%" height="6" style="background-color:#FBBC05;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="25%" height="6" style="background-color:#34A853;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cabecera oscura estilo póster oficial Google Gemini -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d1117 0%,#161b26 100%);padding:32px 32px 28px 32px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:6px 16px;font-size:12px;font-weight:600;color:#ffffff;letter-spacing:0.4px;margin-bottom:16px;">
                ✦ ${escapeHtml(workshopConfig.community)}
              </div>
              <div style="margin-bottom:10px;">
                <span style="display:inline-block;background-color:${badgeColor};color:#ffffff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.6px;">
                  ${escapeHtml(badgeText)}
                </span>
              </div>
              <h1 style="margin:0 0 8px 0;font-size:26px;line-height:1.25;font-weight:800;color:#ffffff;">
                ${escapeHtml(heading)}
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.5;color:#cbd5e1;">
                ${escapeHtml(subheading)}
              </p>
            </td>
          </tr>

          <!-- Cuerpo principal -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer con identidad UPTEX y Google Student Ambassadors -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e8eaed;padding:24px 32px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#202124;">
                ${escapeHtml(workshopConfig.title)} · ${escapeHtml(workshopConfig.university)}
              </p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#5f6368;">
                Ponente: ${escapeHtml(workshopConfig.speaker)} (${escapeHtml(workshopConfig.speakerRole)})
              </p>
              <p style="margin:0;font-size:11px;color:#80868b;line-height:1.5;">
                ${escapeHtml(footerNote)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Plantilla de Confirmación Inmediata al Registrarse
 */
function buildConfirmationEmail(registration) {
  const session = getSessionDetails(registration.horario);
  const subject = `✅ Confirmación de registro: ${workshopConfig.title} (${session.displayTime})`;

  const whatToBringItemsHtml = workshopConfig.whatToBringList
    .map(
      (item) =>
        `<li style="margin-bottom:8px;color:#3c4043;font-size:14px;line-height:1.5;">${escapeHtml(item)}</li>`
    )
    .join('');

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#202124;">
      ¡Hola, <strong>${escapeHtml(registration.nombreCompleto)}</strong>! 👋
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#3c4043;">
      Tu lugar ha quedado confirmado para la <strong>${escapeHtml(workshopConfig.title)}</strong> en la <strong>${escapeHtml(workshopConfig.university)}</strong>. ¡Nos emociona mucho contar contigo!
    </p>

    <!-- Tarjeta de Resumen de Registro -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafd;border:1px solid #d2e3fc;border-left:5px solid #4285F4;border-radius:14px;padding:20px;margin-bottom:24px;">
      <tr>
        <td>
          <div style="font-size:12px;font-weight:700;color:#1967d2;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;">
            📋 Detalles de tu acceso
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size:14px;color:#202124;">
            <tr>
              <td width="38%" style="color:#5f6368;font-weight:600;">Folio de registro:</td>
              <td><code style="background:#e8f0fe;color:#174ea6;padding:2px 8px;border-radius:6px;font-weight:700;">${escapeHtml(registration.id)}</code></td>
            </tr>
            <tr>
              <td style="color:#5f6368;font-weight:600;">Taller:</td>
              <td><strong>${escapeHtml(workshopConfig.title)}</strong></td>
            </tr>
            <tr>
              <td style="color:#5f6368;font-weight:600;">Ponente:</td>
              <td>${escapeHtml(workshopConfig.speaker)}</td>
            </tr>
            <tr>
              <td style="color:#5f6368;font-weight:600;">Fecha:</td>
              <td><strong>${escapeHtml(workshopConfig.dateFormatted)}</strong></td>
            </tr>
            <tr>
              <td style="color:#5f6368;font-weight:600;">Horario elegido:</td>
              <td><strong style="color:#188038;">${escapeHtml(session.displayTime)}</strong> (${escapeHtml(session.name)})</td>
            </tr>
            <tr>
              <td style="color:#5f6368;font-weight:600;">Lugar / Salón:</td>
              <td><strong>${escapeHtml(workshopConfig.location)}</strong> · ${escapeHtml(workshopConfig.universityShort)}</td>
            </tr>
            <tr>
              <td style="color:#5f6368;font-weight:600;">Carrera y Grupo:</td>
              <td>${escapeHtml(registration.carrera)} · ${escapeHtml(registration.grupo)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Qué llevar -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fef7e0;border:1px solid #fde293;border-left:5px solid #FBBC05;border-radius:14px;padding:18px 20px;margin-bottom:24px;">
      <tr>
        <td>
          <div style="font-size:14px;font-weight:700;color:#b06000;margin-bottom:8px;">
            🎒 ¿Qué necesitas llevar al taller?
          </div>
          <p style="margin:0 0 10px 0;font-size:14px;color:#3c4043;line-height:1.5;">
            ${escapeHtml(workshopConfig.whatToBringSummary)}
          </p>
          <ul style="margin:0;padding-left:20px;">
            ${whatToBringItemsHtml}
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;line-height:1.6;color:#5f6368;">
      ⏰ Te recomendamos llegar <strong>10 minutos antes</strong> al <strong>${escapeHtml(workshopConfig.location)}</strong> para agilizar tu acceso. Te enviaremos un recordatorio automático 24 horas antes y 30 minutos antes de tu sesión.
    </p>
  `;

  const html = buildBaseEmailHtml({
    badgeText: 'Registro Confirmado',
    badgeColor: '#34A853',
    heading: workshopConfig.title,
    subheading: `${workshopConfig.dateFormatted} · ${session.displayTime}`,
    bodyHtml,
    footerNote: `Este correo fue enviado a ${registration.correo} porque te registraste en el portal del taller en ${workshopConfig.universityShort}.`
  });

  const text = [
    `¡Hola, ${registration.nombreCompleto}!`,
    '',
    `Tu registro para "${workshopConfig.title}" está confirmado.`,
    '',
    'DETALLES DE TU SESIÓN:',
    `- Folio: ${registration.id}`,
    `- Taller: ${workshopConfig.title}`,
    `- Ponente: ${workshopConfig.speaker} (${workshopConfig.speakerRole})`,
    `- Fecha: ${workshopConfig.dateFormatted}`,
    `- Horario elegido: ${session.displayTime} (${session.name})`,
    `- Lugar: ${workshopConfig.location} - ${workshopConfig.university}`,
    `- Carrera y Grupo: ${registration.carrera} | ${registration.grupo}`,
    '',
    '¿QUÉ LLEVAR?',
    workshopConfig.whatToBringSummary,
    ...workshopConfig.whatToBringList.map((item) => `* ${item}`),
    '',
    'Te recomendamos llegar 10 minutos antes al Laboratorio 3. ¡Nos vemos pronto!'
  ].join('\n');

  return { subject, html, text };
}

/**
 * 2. Plantilla de Recordatorio 24 Horas Antes
 */
function buildReminder24hEmail(registration) {
  const session = getSessionDetails(registration.horario);
  const subject = `📅 Mañana es tu taller: ${workshopConfig.title} (${session.displayTime})`;

  const whatToBringItemsHtml = workshopConfig.whatToBringList
    .map(
      (item) =>
        `<li style="margin-bottom:8px;color:#3c4043;font-size:14px;line-height:1.5;">${escapeHtml(item)}</li>`
    )
    .join('');

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#202124;">
      ¡Hola, <strong>${escapeHtml(registration.nombreCompleto)}</strong>! 🚀
    </p>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#3c4043;">
      Te recordamos que <strong>mañana (${escapeHtml(workshopConfig.dateFormatted)})</strong> exactamente en 24 horas comienza tu sesión de la <strong>${escapeHtml(workshopConfig.title)}</strong>.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8f0fe;border:1px solid #d2e3fc;border-left:5px solid #4285F4;border-radius:14px;padding:20px;margin-bottom:24px;">
      <tr>
        <td>
          <div style="font-size:12px;font-weight:700;color:#1967d2;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">
            ⏰ Cita de mañana
          </div>
          <p style="margin:0 0 6px 0;font-size:15px;color:#202124;">
            <strong>Horario:</strong> ${escapeHtml(session.displayTime)} (${escapeHtml(session.name)})
          </p>
          <p style="margin:0 0 6px 0;font-size:15px;color:#202124;">
            <strong>Lugar:</strong> ${escapeHtml(workshopConfig.location)} · ${escapeHtml(workshopConfig.universityShort)}
          </p>
          <p style="margin:0;font-size:14px;color:#5f6368;">
            <strong>Folio de acceso:</strong> ${escapeHtml(registration.id)}
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;margin-bottom:20px;">
      <tr>
        <td>
          <div style="font-size:14px;font-weight:700;color:#202124;margin-bottom:8px;">
            ✨ Prepara tu equipo desde hoy:
          </div>
          <ul style="margin:0;padding-left:20px;">
            ${whatToBringItemsHtml}
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;line-height:1.6;color:#5f6368;">
      ¡Nos vemos mañana en el <strong>${escapeHtml(workshopConfig.location)}</strong>!
    </p>
  `;

  const html = buildBaseEmailHtml({
    badgeText: 'Recordatorio · Falta 1 Día',
    badgeColor: '#4285F4',
    heading: '¡Mañana nos vemos en el taller!',
    subheading: `${workshopConfig.title} · ${session.displayTime}`,
    bodyHtml,
    footerNote: `Recordatorio automático de 24 horas para ${registration.correo}.`
  });

  const text = [
    `¡Hola, ${registration.nombreCompleto}!`,
    '',
    `Te recordamos que MAÑANA (${workshopConfig.dateFormatted}) es tu sesión de "${workshopConfig.title}".`,
    '',
    `- Horario: ${session.displayTime}`,
    `- Lugar: ${workshopConfig.location} (${workshopConfig.university})`,
    `- Ponente: ${workshopConfig.speaker}`,
    `- Folio: ${registration.id}`,
    '',
    'No olvides llevar:',
    ...workshopConfig.whatToBringList.map((item) => `* ${item}`),
    '',
    '¡Nos vemos mañana!'
  ].join('\n');

  return { subject, html, text };
}

/**
 * 3. Plantilla de Recordatorio 30 Minutos Antes
 */
function buildReminder30mEmail(registration) {
  const session = getSessionDetails(registration.horario);
  const subject = `⏰ ¡Iniciamos en 30 minutos! ${workshopConfig.title} - ${workshopConfig.location}`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#202124;">
      ¡Hola, <strong>${escapeHtml(registration.nombreCompleto)}</strong>! ⚡
    </p>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#3c4043;">
      Tu sesión de la <strong>${escapeHtml(workshopConfig.title)}</strong> comienza en <strong>30 minutos</strong>. ¡Ya te estamos esperando!
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fce8e6;border:1px solid #fad2cf;border-left:5px solid #EA4335;border-radius:14px;padding:20px;margin-bottom:24px;">
      <tr>
        <td>
          <div style="font-size:12px;font-weight:700;color:#c5221f;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">
            📍 Dirígete al salón ahora
          </div>
          <p style="margin:0 0 6px 0;font-size:16px;color:#202124;">
            <strong>Salón:</strong> ${escapeHtml(workshopConfig.location)} (${escapeHtml(workshopConfig.universityShort)})
          </p>
          <p style="margin:0 0 6px 0;font-size:15px;color:#202124;">
            <strong>Horario:</strong> ${escapeHtml(session.displayTime)}
          </p>
          <p style="margin:0;font-size:14px;color:#5f6368;">
            <strong>Tu folio:</strong> <code style="background:#ffffff;padding:2px 6px;border-radius:4px;font-weight:700;">${escapeHtml(registration.id)}</code>
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;line-height:1.6;color:#3c4043;">
      Ten lista tu <strong>Laptop o Celular con tu Cuenta de Google y la app de Gemini instalada</strong> para aprovechar al máximo la práctica con <strong>${escapeHtml(workshopConfig.speaker)}</strong>.
    </p>
  `;

  const html = buildBaseEmailHtml({
    badgeText: '¡Comenzamos en 30 min!',
    badgeColor: '#EA4335',
    heading: `Te esperamos en el ${workshopConfig.location}`,
    subheading: `${workshopConfig.title} · ${session.displayTime}`,
    bodyHtml,
    footerNote: `Recordatorio automático de 30 minutos antes de tu sesión (${registration.correo}).`
  });

  const text = [
    `¡Hola, ${registration.nombreCompleto}!`,
    '',
    `¡Tu sesión de "${workshopConfig.title}" inicia en 30 MINUTOS!`,
    '',
    `- Lugar: ${workshopConfig.location} (${workshopConfig.universityShort})`,
    `- Horario: ${session.displayTime}`,
    `- Folio: ${registration.id}`,
    '',
    'Ten a la mano tu Laptop o Celular con Cuenta de Google y Gemini instalado. ¡Te esperamos!'
  ].join('\n');

  return { subject, html, text };
}

module.exports = {
  buildConfirmationEmail,
  buildReminder24hEmail,
  buildReminder30mEmail
};
