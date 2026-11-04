require('dotenv').config();
const sheetsService = require('../src/services/sheets.service');
const mailService = require('../src/services/mail.service');
const schedulerService = require('../src/services/scheduler.service');
const workshopConfig = require('../config/workshop.config');

async function runSimulation() {
  console.log('======================================================================');
  console.log('🧪 SIMULACIÓN DE REGISTRO Y RECORDATORIOS - GSA 2026 UPTEX');
  console.log(`🎓 Taller: ${workshopConfig.title}`);
  console.log(`🌎 Zona Horaria: ${workshopConfig.timezone}`);
  console.log('======================================================================\n');

  const customEmailArg = process.argv[2];
  const testEmail = customEmailArg
    ? customEmailArg.trim().toLowerCase()
    : `prueba.gsa.${Date.now()}@uptex.edu.mx`;

  await sheetsService.init();

  console.log(`1️⃣  Registrando participante de prueba (${testEmail}) en horario 8:00-10:00...`);
  const registration = await sheetsService.registerParticipant({
    nombreCompleto: 'Alumno de Prueba UPTEX',
    carrera: 'Ingeniería en Sistemas Computacionales',
    grupo: '4° Cuatrimestre · Grupo 4M1',
    horario: '8:00-10:00',
    genero: 'Hombre',
    correo: testEmail
  });

  console.log('   ✅ Registro guardado exitosamente:');
  console.log(`      - ID: ${registration.id}`);
  console.log(`      - Fila: ${registration.rowNumber}`);
  console.log(`      - Fecha de registro (MX): ${registration.fechaRegistro}`);

  console.log('\n2️⃣  Enviando correo de confirmación inmediata...');
  await mailService.sendConfirmation(registration);
  const confStamp = await sheetsService.markEmailSent(
    registration.rowNumber,
    registration.id,
    'confirmacion'
  );
  console.log(`   ✅ Columna "Correo de confirmación enviado" actualizada a: ${confStamp}`);

  console.log('\n3️⃣  Verificando protección contra correos duplicados...');
  try {
    await sheetsService.registerParticipant({
      nombreCompleto: 'Intento Duplicado',
      carrera: 'Ingeniería en Robótica',
      grupo: '2° Cuatrimestre · Grupo 2M1',
      horario: '10:00-12:00',
      genero: 'Mujer',
      correo: testEmail
    });
    console.error('   ❌ ERROR: Se permitió un correo duplicado.');
  } catch (dupErr) {
    console.log(`   ✅ Duplicado bloqueado correctamente (${dupErr.code}): "${dupErr.message}"`);
  }

  console.log(
    '\n4️⃣  Simulando reloj en 2026-11-09T08:05:00 (America/Mexico_City) -> Recordatorio 24h antes...'
  );
  const res24h = await schedulerService.processPendingReminders({
    simulatedNowISO: '2026-11-09T08:05:00',
    onlyEmail: testEmail
  });
  console.log('   📊 Resultado Scheduler (24h antes):', JSON.stringify(res24h));

  console.log(
    '\n5️⃣  Simulando reloj en 2026-11-10T07:31:00 (America/Mexico_City) -> Recordatorio 30min antes...'
  );
  const res30m = await schedulerService.processPendingReminders({
    simulatedNowISO: '2026-11-10T07:31:00',
    onlyEmail: testEmail
  });
  console.log('   📊 Resultado Scheduler (30min antes):', JSON.stringify(res30m));

  console.log(
    '\n6️⃣  Verificando que no se reenvíen correos repetidos en el siguiente ciclo de 5 min...'
  );
  const resIdempotent = await schedulerService.processPendingReminders({
    simulatedNowISO: '2026-11-10T07:36:00',
    onlyEmail: testEmail
  });
  console.log(
    '   📊 Resultado segundo ciclo (debe enviar 0 repetidos):',
    JSON.stringify(resIdempotent)
  );

  const allRegs = await sheetsService.getAllRegistrations();
  const updatedRecord = allRegs.find((r) => r.id === registration.id);

  console.log('\n======================================================================');
  console.log('📋 ESTADO FINAL DE LA FILA EN LA HOJA "Registros":');
  console.log(JSON.stringify(updatedRecord, null, 2));
  console.log('======================================================================');
  console.log(
    '\n💡 Tip: Puedes pasar tu propio correo real para recibir los 3 correos de prueba:'
  );
  console.log('   node scripts/test-simulation.js tu-correo@gmail.com\n');
}

runSimulation().catch((err) => {
  console.error('❌ Error durante la simulación:', err);
  process.exit(1);
});
