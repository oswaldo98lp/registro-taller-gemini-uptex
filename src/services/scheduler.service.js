const cron = require('node-cron');
const { DateTime } = require('luxon');
const workshopConfig = require('../../config/workshop.config');
const sheetsService = require('./sheets.service');
const mailService = require('./mail.service');

class SchedulerService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Verifica si una columna de estado de correo ya fue enviada o fue omitida por registro tardío.
   */
  _isAlreadyHandled(cellValue) {
    if (!cellValue) return false;
    const upper = cellValue.trim().toUpperCase();
    return upper.startsWith('SI') || upper.startsWith('SÍ') || upper.startsWith('OMITIDO');
  }

  /**
   * Parsea la fecha de registro guardada en la hoja ("yyyy-MM-dd HH:mm:ss") en zona America/Mexico_City.
   */
  _parseRegistrationDate(fechaStr) {
    if (!fechaStr) return null;
    let dt = DateTime.fromFormat(fechaStr.trim(), 'yyyy-MM-dd HH:mm:ss', {
      zone: workshopConfig.timezone
    });
    if (!dt.isValid) {
      dt = DateTime.fromISO(fechaStr.trim(), { zone: workshopConfig.timezone });
    }
    return dt.isValid ? dt : null;
  }

  /**
   * Ejecuta un ciclo de revisión de recordatorios y confirmaciones pendientes.
   * @param {Object} options
   * @param {string} [options.simulatedNowISO] - Fecha ISO opcional (en America/Mexico_City) para simular el reloj en pruebas.
   * @param {string} [options.onlyEmail] - Si se especifica, solo procesa el registro con ese correo (útil para el script de prueba).
   */
  async processPendingReminders(options = {}) {
    if (this.isRunning) {
      return { skipped: true, reason: 'Ya hay una ejecución del scheduler en curso.' };
    }

    this.isRunning = true;
    const summary = {
      timestampMx: '',
      checked: 0,
      confirmationsRetried: 0,
      reminders24hSent: 0,
      reminders30mSent: 0,
      omittedLate: 0,
      errors: []
    };

    try {
      const nowMx = options.simulatedNowISO
        ? DateTime.fromISO(options.simulatedNowISO, { zone: workshopConfig.timezone })
        : DateTime.now().setZone(workshopConfig.timezone);

      summary.timestampMx = nowMx.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');

      const registrations = await sheetsService.getAllRegistrations();
      const targetEmail = options.onlyEmail ? options.onlyEmail.trim().toLowerCase() : null;

      for (const reg of registrations) {
        if (targetEmail && reg.correo !== targetEmail) continue;
        if (!reg.correo || !reg.horario) continue;

        summary.checked += 1;

        const session = workshopConfig.sessions.find((s) => s.value === reg.horario);
        if (!session) continue;

        const sessionStart = DateTime.fromISO(session.startISO, {
          zone: workshopConfig.timezone
        });
        const reminder24hTime = sessionStart.minus({ hours: 24 });
        const reminder30mTime = sessionStart.minus({ minutes: 30 });
        const regDate = this._parseRegistrationDate(reg.fechaRegistro);

        // 1. Reintentar correo de confirmación si quedó pendiente ("NO") por algún fallo previo
        if (!this._isAlreadyHandled(reg.confirmacionEnviada)) {
          try {
            await mailService.sendConfirmation(reg);
            await sheetsService.markEmailSent(reg.rowNumber, reg.id, 'confirmacion');
            summary.confirmationsRetried += 1;
          } catch (err) {
            summary.errors.push(
              `Error reintentando confirmación para ${reg.correo}: ${err.message}`
            );
          }
        }

        // 2. Evaluar Recordatorio 24 horas antes
        if (!this._isAlreadyHandled(reg.recordatorio24hEnviado)) {
          // Regla: si se registró después del momento del recordatorio 24h, NO enviar
          if (regDate && regDate > reminder24hTime) {
            summary.omittedLate += 1;
          } else if (nowMx >= reminder24hTime && nowMx < reminder30mTime) {
            try {
              await mailService.sendReminder24h(reg);
              await sheetsService.markEmailSent(reg.rowNumber, reg.id, '24h');
              summary.reminders24hSent += 1;
            } catch (err) {
              summary.errors.push(
                `Error enviando recordatorio 24h a ${reg.correo}: ${err.message}`
              );
            }
          }
        }

        // 3. Evaluar Recordatorio 30 minutos antes
        if (!this._isAlreadyHandled(reg.recordatorio30minEnviado)) {
          // Regla: si se registró después del momento del recordatorio 30min, NO enviar
          if (regDate && regDate > reminder30mTime) {
            summary.omittedLate += 1;
          } else if (nowMx >= reminder30mTime && nowMx <= sessionStart.plus({ minutes: 30 })) {
            try {
              await mailService.sendReminder30m(reg);
              await sheetsService.markEmailSent(reg.rowNumber, reg.id, '30min');
              summary.reminders30mSent += 1;
            } catch (err) {
              summary.errors.push(
                `Error enviando recordatorio 30min a ${reg.correo}: ${err.message}`
              );
            }
          }
        }
      }

      return summary;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Inicia el cron job interno cada 5 minutos en zona horaria America/Mexico_City.
   */
  start() {
    if (this.cronJob) return;

    this.cronJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        try {
          const res = await this.processPendingReminders();
          if (
            !res.skipped &&
            (res.confirmationsRetried > 0 ||
              res.reminders24hSent > 0 ||
              res.reminders30mSent > 0 ||
              res.errors.length > 0)
          ) {
            console.log('⏱️  [Scheduler 5m]', JSON.stringify(res));
          }
        } catch (err) {
          console.error('⚠️ Error en ejecución programada del scheduler:', err.message);
        }
      },
      {
        scheduled: true,
        timezone: workshopConfig.timezone
      }
    );

    console.log(
      `⏰ Scheduler de recordatorios activo (cada 5 minutos en zona ${workshopConfig.timezone}).`
    );
  }
}

module.exports = new SchedulerService();
