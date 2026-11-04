const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');
const { DateTime } = require('luxon');
const workshopConfig = require('../../config/workshop.config');

const HEADERS = [
  'ID',
  'Fecha de registro',
  'Nombre completo',
  'Carrera',
  'Grupo',
  'Horario',
  'Género',
  'Correo',
  'Recordatorio 24h enviado',
  'Recordatorio 30min enviado',
  'Correo de confirmación enviado'
];

/**
 * Cola de exclusión mutua (Mutex asíncrono) para evitar condiciones de carrera
 * al validar cupo por sesión, correos duplicados y escritura de registros.
 */
class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  runExclusive(task) {
    const result = this._queue.then(() => task());
    this._queue = result.catch(() => {});
    return result;
  }
}

const registrationMutex = new AsyncMutex();

/**
 * Extrae el ID limpio de Google Sheets incluso si el usuario pegó la URL completa en .env
 */
function extractSpreadsheetId(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

class SheetsService {
  constructor() {
    this.spreadsheetId = extractSpreadsheetId(process.env.GOOGLE_SHEET_ID);
    this.tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Registros';
    this.sheetsApi = null;
    this.isInitialized = false;
    this.usingLocalFallback = false;
    this.localFallbackPath = path.join(__dirname, '../../data/local-registros.json');
  }

  /**
   * Construye el cliente autenticado de Google Sheets con Service Account
   */
  async _getAuthClient() {
    const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
    const rawKey = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
    const rawJson = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
      : path.resolve(process.cwd(), 'service-account.json');

    // Opción 1: Variables GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY en .env
    if (
      email &&
      rawKey &&
      !email.includes('tu-service-account@') &&
      !rawKey.includes('TU_LLAVE_PRIVADA_AQUI')
    ) {
      const privateKey = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
      return new google.auth.JWT({
        email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    }

    // Opción 2: JSON completo en variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON
    if (rawJson) {
      const credentials = JSON.parse(rawJson);
      return new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    }

    // Opción 3: Archivo service-account.json en disco
    if (fs.existsSync(keyFilePath)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: keyFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      return auth.getClient();
    }

    return null;
  }

  /**
   * Inicializa la conexión a Google Sheets y asegura que exista la hoja "Registros" con sus encabezados.
   */
  async init() {
    if (this.isInitialized) return;

    try {
      const authClient = await this._getAuthClient();
      if (!authClient || !this.spreadsheetId) {
        this._enableLocalFallback(
          'No se detectaron credenciales activas de Service Account en .env ni service-account.json.'
        );
        return;
      }

      this.sheetsApi = google.sheets({ version: 'v4', auth: authClient });

      // 1. Verificar si la pestaña "Registros" existe; si no, crearla automáticamente
      const meta = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const existingSheets = meta.data.sheets || [];
      const targetSheet = existingSheets.find(
        (s) => s.properties && s.properties.title === this.tabName
      );

      if (!targetSheet) {
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.tabName,
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 12,
                      frozenRowCount: 1
                    }
                  }
                }
              }
            ]
          }
        });
        console.log(`✅ Pestaña "${this.tabName}" creada automáticamente en Google Sheets.`);
      }

      // 2. Verificar si tiene los encabezados en A1:K1; si está vacía, escribirlos
      const headerRes = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.tabName}!A1:K1`
      });

      const firstRow = (headerRes.data.values && headerRes.data.values[0]) || [];
      if (firstRow.length === 0 || firstRow[0] !== 'ID') {
        await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.tabName}!A1:K1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [HEADERS]
          }
        });
        console.log(`✅ Encabezados creados automáticamente en la hoja "${this.tabName}".`);
      }

      this.usingLocalFallback = false;
      this.isInitialized = true;
      console.log(
        `📊 Conectado exitosamente a Google Sheets (ID: ${this.spreadsheetId}, Hoja: "${this.tabName}").`
      );
    } catch (error) {
      console.error('⚠️ Error al conectar con Google Sheets API:', error.message);
      this._enableLocalFallback(
        `No se pudo acceder a Google Sheets (${error.message}). Verifica que compartiste la hoja con el correo de la Service Account como Editor.`
      );
    }
  }

  _enableLocalFallback(reason) {
    this.usingLocalFallback = true;
    this.isInitialized = true;
    const dir = path.dirname(this.localFallbackPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.localFallbackPath)) {
      fs.writeFileSync(
        this.localFallbackPath,
        JSON.stringify({ headers: HEADERS, rows: [] }, null, 2),
        'utf8'
      );
    }
    console.warn(`ℹ️  Modo respaldo local activo (${this.localFallbackPath}): ${reason}`);
  }

  /**
   * Obtiene todos los registros mapeados como objetos junto con su número de fila (rowNumber en Sheets, base 1).
   */
  async getAllRegistrations() {
    await this.init();

    if (this.usingLocalFallback) {
      const raw = JSON.parse(fs.readFileSync(this.localFallbackPath, 'utf8'));
      return (raw.rows || []).map((row, idx) => this._mapRowToObject(row, idx + 2));
    }

    const res = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.tabName}!A2:K`
    });

    const rows = res.data.values || [];
    return rows
      .map((row, idx) => this._mapRowToObject(row, idx + 2))
      .filter((item) => item.id || item.correo);
  }

  _mapRowToObject(row, rowNumber) {
    return {
      rowNumber, // Fila real en Google Sheets (2 en adelante)
      id: (row[0] || '').trim(),
      fechaRegistro: (row[1] || '').trim(),
      nombreCompleto: (row[2] || '').trim(),
      carrera: (row[3] || '').trim(),
      grupo: (row[4] || '').trim(),
      horario: (row[5] || '').trim(),
      genero: (row[6] || '').trim(),
      correo: (row[7] || '').trim().toLowerCase(),
      recordatorio24hEnviado: (row[8] || '').trim(),
      recordatorio30minEnviado: (row[9] || '').trim(),
      confirmacionEnviada: (row[10] || '').trim()
    };
  }

  /**
   * Calcula el conteo de lugares ocupados y disponibles por sesión en tiempo real.
   */
  async getSessionAvailability() {
    const registrations = await this.getAllRegistrations();
    const countsBySession = {};

    for (const session of workshopConfig.sessions) {
      countsBySession[session.value] = 0;
    }

    for (const reg of registrations) {
      if (countsBySession[reg.horario] !== undefined) {
        countsBySession[reg.horario] += 1;
      }
    }

    return workshopConfig.sessions.map((session) => {
      const registered = countsBySession[session.value] || 0;
      const available = Math.max(0, session.capacity - registered);
      return {
        id: session.id,
        value: session.value,
        name: session.name,
        displayTime: session.displayTime,
        shortTime: session.shortTime,
        capacity: session.capacity,
        registered,
        available,
        isFull: available <= 0,
        accentColor: session.accentColor
      };
    });
  }

  /**
   * Determina el estado inicial de las columnas de recordatorio según la hora actual en America/Mexico_City.
   * Regla: si alguien se registra cuando ya pasó el momento de un recordatorio, NO se le envía ese recordatorio.
   */
  _computeInitialReminderFlags(horarioValue, nowMx) {
    const session = workshopConfig.sessions.find((s) => s.value === horarioValue);
    if (!session) {
      return { flag24h: 'NO', flag30m: 'NO' };
    }

    const sessionStart = DateTime.fromISO(session.startISO, {
      zone: workshopConfig.timezone
    });
    const reminder24hMoment = sessionStart.minus({ hours: 24 });
    const reminder30mMoment = sessionStart.minus({ minutes: 30 });

    const flag24h = nowMx > reminder24hMoment ? 'OMITIDO_REGISTRO_TARDIO' : 'NO';
    const flag30m = nowMx > reminder30mMoment ? 'OMITIDO_REGISTRO_TARDIO' : 'NO';

    return { flag24h, flag30m };
  }

  /**
   * Registra un participante de forma atómica (protegida por Mutex contra condiciones de carrera).
   */
  async registerParticipant({ nombreCompleto, carrera, grupo, horario, genero, correo }) {
    return registrationMutex.runExclusive(async () => {
      await this.init();

      const normalizedEmail = correo.trim().toLowerCase();
      const registrations = await this.getAllRegistrations();

      // 1. Validar correo duplicado
      const duplicate = registrations.find((r) => r.correo === normalizedEmail);
      if (duplicate) {
        const err = new Error(
          `¡Hola! Este correo electrónico (${normalizedEmail}) ya se encuentra registrado en el horario de ${duplicate.horario}. Revisa tu bandeja de entrada o spam para ver tu confirmación.`
        );
        err.code = 'DUPLICATE_EMAIL';
        err.status = 409;
        throw err;
      }

      // 2. Validar existencia y cupo del horario elegido
      const targetSession = workshopConfig.sessions.find((s) => s.value === horario);
      if (!targetSession) {
        const err = new Error('El horario seleccionado no es válido.');
        err.code = 'INVALID_SESSION';
        err.status = 400;
        throw err;
      }

      const enrolledInSession = registrations.filter((r) => r.horario === horario).length;
      if (enrolledInSession >= targetSession.capacity) {
        const err = new Error(
          `Lo sentimos, el horario de ${targetSession.displayTime} acaba de llenarse (${targetSession.capacity}/${targetSession.capacity} lugares). Por favor elige otra sesión disponible.`
        );
        err.code = 'SESSION_FULL';
        err.status = 409;
        throw err;
      }

      // 3. Preparar datos con fecha/hora en America/Mexico_City
      const nowMx = DateTime.now().setZone(workshopConfig.timezone);
      const fechaRegistro = nowMx.toFormat('yyyy-MM-dd HH:mm:ss');
      const id = `GSA-${nowMx.toFormat('MMdd')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const { flag24h, flag30m } = this._computeInitialReminderFlags(horario, nowMx);

      const newRow = [
        id,
        fechaRegistro,
        nombreCompleto,
        carrera,
        grupo,
        horario,
        genero,
        normalizedEmail,
        flag24h,
        flag30m,
        'NO' // Se actualizará a "SI (timestamp)" en cuanto el correo de confirmación se envíe con éxito
      ];

      let rowNumber;

      if (this.usingLocalFallback) {
        const raw = JSON.parse(fs.readFileSync(this.localFallbackPath, 'utf8'));
        raw.rows.push(newRow);
        rowNumber = raw.rows.length + 1;
        fs.writeFileSync(this.localFallbackPath, JSON.stringify(raw, null, 2), 'utf8');
      } else {
        const appendRes = await this.sheetsApi.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.tabName}!A:K`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [newRow]
          }
        });

        // Extraer el número de fila insertado (ej. "Registros!A15:K15" -> 15)
        const updatedRange =
          (appendRes.data.updates && appendRes.data.updates.updatedRange) || '';
        const matchRow = updatedRange.match(/![A-Z]+(\d+)/);
        rowNumber = matchRow ? parseInt(matchRow[1], 10) : registrations.length + 2;
      }

      return this._mapRowToObject(newRow, rowNumber);
    });
  }

  /**
   * Actualiza el estado de envío de un correo en Google Sheets ('confirmacion', '24h', '30min')
   * Solo se invoca cuando el correo fue enviado exitosamente.
   */
  async markEmailSent(rowNumber, id, type) {
    return registrationMutex.runExclusive(async () => {
      await this.init();

      const nowStamp = DateTime.now()
        .setZone(workshopConfig.timezone)
        .toFormat('yyyy-MM-dd HH:mm:ss');
      const statusValue = `SI (${nowStamp})`;

      // Índices de columna: I (col 8, base 0) = 24h, J (col 9) = 30min, K (col 10) = confirmacion
      const columnMap = {
        '24h': { colLetter: 'I', colIndex: 8 },
        '30min': { colLetter: 'J', colIndex: 9 },
        confirmacion: { colLetter: 'K', colIndex: 10 }
      };

      const targetCol = columnMap[type];
      if (!targetCol) {
        throw new Error(`Tipo de columna de correo desconocido: ${type}`);
      }

      if (this.usingLocalFallback) {
        const raw = JSON.parse(fs.readFileSync(this.localFallbackPath, 'utf8'));
        const rowIndex = raw.rows.findIndex((r) => r[0] === id);
        if (rowIndex !== -1) {
          raw.rows[rowIndex][targetCol.colIndex] = statusValue;
          fs.writeFileSync(this.localFallbackPath, JSON.stringify(raw, null, 2), 'utf8');
        }
        return statusValue;
      }

      // Verificar fila por seguridad; si rowNumber no coincide con el ID, buscar la fila exacta del ID
      let targetRow = rowNumber;
      const checkRes = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.tabName}!A${targetRow}:A${targetRow}`
      });
      const currentId =
        checkRes.data.values && checkRes.data.values[0] && checkRes.data.values[0][0];

      if (currentId !== id) {
        const allRegs = await this.getAllRegistrations();
        const found = allRegs.find((r) => r.id === id);
        if (!found) {
          throw new Error(`No se encontró el registro con ID ${id} para actualizar estado.`);
        }
        targetRow = found.rowNumber;
      }

      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.tabName}!${targetCol.colLetter}${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[statusValue]]
        }
      });

      return statusValue;
    });
  }
}

module.exports = new SheetsService();
