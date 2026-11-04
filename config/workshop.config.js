require('dotenv').config();

/**
 * Archivo de configuración central editable del taller.
 * Puedes modificar directamente estos valores o sobrescribirlos desde el archivo .env
 */
const workshopDate = process.env.WORKSHOP_DATE || '2026-11-10';
const capacityPerSession = parseInt(process.env.WORKSHOP_CAPACITY_PER_SESSION || '40', 10);

const workshopConfig = {
  community: 'Estudiantes Embajadores de Google 2026',
  title: process.env.WORKSHOP_TITLE || 'Sesión Google Gemini Multidisciplinaria',
  speaker: process.env.WORKSHOP_SPEAKER || 'Oswaldo Lucas Pablo',
  speakerRole: 'Estudiante Embajador de Google 2026',
  university: process.env.WORKSHOP_UNIVERSITY || 'Universidad Politécnica de Texcoco (UPTEX)',
  universityShort: 'UPTEX',
  location: process.env.WORKSHOP_LOCATION || 'Laboratorio 3',
  date: workshopDate, // Formato YYYY-MM-DD
  dateFormatted: 'Martes 10 de noviembre de 2026',
  timezone: process.env.WORKSHOP_TIMEZONE || 'America/Mexico_City',
  capacityPerSession,

  // Texto editable para la sección "Sobre el taller" (2-3 líneas)
  aboutWorkshop: [
    'Descubre cómo potenciar tus proyectos académicos, investigaciones y tareas de cualquier carrera utilizando el ecosistema de inteligencia artificial de Google Gemini.',
    'Sin importar el cuatrimestre o la carrera que curses en la UPTEX, saldrás con herramientas listas para aplicar desde el primer día.'
  ],

  // Qué llevar (mostrado en la página y enviado en los correos)
  whatToBringSummary:
    'Preferentemente llevar Laptop o Celular con una Cuenta de Google activa y la app de Google Gemini instalada.',
  whatToBringList: [
    'Laptop o teléfono celular (con batería cargada y/o cargador).',
    'Cuenta de Google activa (personal) con acceso a tu correo.',
    'App de Google Gemini instalada en tu celular o acceso a gemini.google.com en tu navegador.'
  ],

  // Grados por cuatrimestre para los estudiantes de UPTEX
  cuatrimestres: [
    '1° Cuatrimestre',
    '2° Cuatrimestre',
    '3° Cuatrimestre',
    '4° Cuatrimestre',
    '5° Cuatrimestre',
    '6° Cuatrimestre',
    '7° Cuatrimestre',
    '8° Cuatrimestre',
    '9° Cuatrimestre',
    '10° Cuatrimestre'
  ],

  // Las 3 sesiones del mismo día (2 horas cada una)
  sessions: [
    {
      id: 'sesion-1',
      value: '8:00-10:00',
      name: 'Sesión 1 · Matutina A',
      displayTime: '8:00 a 10:00 hrs',
      shortTime: '8:00 - 10:00',
      startHour: 8,
      startMinute: 0,
      endHour: 10,
      endMinute: 0,
      startISO: `${workshopDate}T08:00:00`,
      endISO: `${workshopDate}T10:00:00`,
      capacity: capacityPerSession,
      accentColor: '#4285F4'
    },
    {
      id: 'sesion-2',
      value: '10:00-12:00',
      name: 'Sesión 2 · Matutina B',
      displayTime: '10:00 a 12:00 hrs',
      shortTime: '10:00 - 12:00',
      startHour: 10,
      startMinute: 0,
      endHour: 12,
      endMinute: 0,
      startISO: `${workshopDate}T10:00:00`,
      endISO: `${workshopDate}T12:00:00`,
      capacity: capacityPerSession,
      accentColor: '#34A853'
    },
    {
      id: 'sesion-3',
      value: '12:00-14:00',
      name: 'Sesión 3 · Mediodía',
      displayTime: '12:00 a 14:00 hrs',
      shortTime: '12:00 - 14:00',
      startHour: 12,
      startMinute: 0,
      endHour: 14,
      endMinute: 0,
      startISO: `${workshopDate}T12:00:00`,
      endISO: `${workshopDate}T14:00:00`,
      capacity: capacityPerSession,
      accentColor: '#FBBC05'
    }
  ]
};

module.exports = workshopConfig;
