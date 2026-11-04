# 🎓 Sistema de Registro: Sesión Google Gemini Multidisciplinaria (GSA 2026 · UPTEX)

Sitio web de una sola página (SPA) y backend en **Node.js + Express** para el registro en tiempo real de participantes al taller **"Sesión Google Gemini Multidisciplinaria"** impartido por **Oswaldo Lucas Pablo** (*Estudiante Embajador de Google 2026*) en el **Laboratorio 3** de la **Universidad Politécnica de Texcoco (UPTEX)**.

---

## ✨ Características Principales

- **Disponibilidad en tiempo real:** Consulta automática de cupos por cada una de las 3 sesiones (`8:00-10:00`, `10:00-12:00`, `12:00-14:00`) con cupo configurable (default: 40 por sesión). Si una sesión se llena, se marca `"Cupo lleno"` y se deshabilita.
- **Integración nativa con Google Sheets API (Service Account):**
  - Crea automáticamente la pestaña **`Registros`** y sus **11 encabezados** si la hoja está vacía.
  - Incluye un bloqueo de exclusión mutua (**Mutex asíncrono**) para evitar condiciones de carrera cuando dos personas envían el formulario al mismo tiempo por el último lugar o con el mismo correo.
  - Sanitización contra inyección de fórmulas (`=`, `+`, `-`, `@`) y etiquetas HTML.
- **3 Correos Automáticos (HTML con identidad visual + texto plano alternativo):**
  1. **Confirmación inmediata** al registrarse (incluye folio, horario, Laboratorio 3 y qué llevar).
  2. **Recordatorio 24 horas antes** del inicio de la sesión elegida (9 de noviembre a las 8:00, 10:00 o 12:00 hrs).
  3. **Recordatorio 30 minutos antes** del inicio de la sesión elegida (10 de noviembre a las 7:30, 9:30 o 11:30 hrs).
  - *Regla de registros tardíos:* Si alguien se registra cuando ya pasó la hora de un recordatorio, ese recordatorio se marca como `OMITIDO_REGISTRO_TARDIO` y solo se envían los que falten.
  - *Reintentos automáticos:* Solo marca la columna como `SI (fecha y hora)` cuando el envío es exitoso; si falla, el scheduler lo reintenta en el siguiente ciclo de 5 minutos.
- **Zona horaria estricta:** Todos los cálculos utilizan `America/Mexico_City`.

---

## 📁 Estructura del Proyecto

```text
Registro taller/
├── assets/                     # Recursos gráficos oficiales (UPTEX.png, cartel y elementos 3D Gemini)
├── config/
│   └── workshop.config.js      # Configuración editable del taller (nombre, ponente, lugar, cupo, etc.)
├── public/                     # Frontend SPA (HTML5 + CSS3 + JS puro)
│   ├── index.html              # Hero, Sobre el taller, 3 tarjetas de horario, Formulario y Footer
│   ├── styles.css              # Diseño mobile-first con paleta Google y animaciones al hacer scroll
│   └── app.js                  # Cupo en vivo, validaciones accesibles y pantalla de confirmación
├── src/
│   ├── server.js               # Servidor Express, rate-limit por IP, honeypot y rutas API
│   ├── services/
│   │   ├── sheets.service.js   # Google Sheets API v4 (Service Account) + Mutex anti-condición de carrera
│   │   ├── mail.service.js     # Envío por Gmail SMTP (Nodemailer) o Resend configurable por .env
│   │   └── scheduler.service.js# Cron cada 5 minutos en zona America/Mexico_City
│   └── templates/
│       └── emails.js           # Plantillas HTML + texto plano para los 3 correos
├── scripts/
│   └── test-simulation.js      # Script para simular un registro y forzar el envío de los 3 correos
├── .env                        # Variables de entorno activas (ignorado por Git)
├── .env.example                # Plantilla de ejemplo de variables de entorno
└── package.json
```

---

## 🚀 Inicio Rápido en Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```
2. **Iniciar el servidor:**
   ```bash
   npm start
   ```
3. Abre en tu navegador: **[http://localhost:3000](http://localhost:3000)**

> 💡 **Nota útil:** Si ejecutas `npm start` antes de configurar tu Service Account o tu contraseña SMTP, el sistema funciona automáticamente en **Modo Simulación Local** (guardando los registros en `data/local-registros.json` y los correos HTML generados en `data/outbox/`) para que puedas probar toda la interfaz de inmediato. En cuanto agregues tus credenciales en `.env`, se conectará automáticamente a tu Google Sheet real.

---

## 🛠️ Guía Paso a Paso: Configurar Google Sheets API (Service Account)

### Paso 1: Crear el proyecto y habilitar Google Sheets API
1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto nuevo (por ejemplo: `registro-taller-gsa-2026`) o selecciona uno existente.
3. En el menú lateral ve a **APIs y servicios > Biblioteca** (*APIs & Services > Library*).
4. Busca **Google Sheets API**, selecciónala y haz clic en **Habilitar** (*Enable*).

### Paso 2: Crear la Service Account y descargar la llave JSON
1. Ve a **APIs y servicios > Credenciales** (*Credentials*).
2. Haz clic en **+ Crear credenciales** arriba y elige **Cuenta de servicio** (*Service account*).
3. Ponle un nombre (ej. `bot-registro-taller`) y haz clic en **Crear y continuar** y luego en **Listo**.
4. En la lista de cuentas de servicio, haz clic sobre el correo que se acaba de crear (tiene el formato `bot-registro-taller@tu-proyecto.iam.gserviceaccount.com`). **Copia ese correo electrónico**.
5. Ve a la pestaña superior **Claves** (*Keys*) > **Agregar clave** (*Add key*) > **Crear clave nueva** > elige **JSON** y haz clic en **Crear**.
6. Se descargará un archivo `.json` a tu computadora.

### Paso 3: Compartir tu Google Sheet con la Service Account
1. Abre tu hoja de cálculo de Google (ya configurada en tu `.env`):
   - `https://docs.google.com/spreadsheets/d/1kDYJ43MRqrcp9GE6-iLXxDW9eGN6UNAVnX5LbpUe5JU/edit`
2. Haz clic en el botón **Compartir** (arriba a la derecha).
3. Pega el correo de tu Service Account (`...@...iam.gserviceaccount.com`), asegúrate de darle permiso de **Editor** y haz clic en **Enviar**.
   - *(No necesitas crear las columnas manualmente: el backend creará la pestaña `Registros` y las 11 columnas automáticamente al arrancar).*

### Paso 4: Conectar las credenciales al proyecto (Elige Opción A u Opción B)
- **Opción A (Más rápida en local):** Renombra el archivo `.json` que descargaste a `service-account.json` y colócalo en la raíz de esta carpeta (`Registro taller/service-account.json`).
- **Opción B (Ideal para desplegar en la nube):** Abre el archivo `.json` con un editor de texto, copia los valores de `"client_email"` y `"private_key"` y pégalos en tu archivo `.env`:
  ```env
  GOOGLE_SERVICE_ACCOUNT_EMAIL=bot-registro-taller@tu-proyecto.iam.gserviceaccount.com
  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhki...\n-----END PRIVATE KEY-----\n"
  ```

---

## 📧 Guía Paso a Paso: Configurar el Correo Emisor

El proyecto soporta **Gmail SMTP (Nodemailer)** o **Resend** mediante la variable `EMAIL_PROVIDER` en `.env`.

### Opción 1: Gmail con Contraseña de Aplicación (Recomendado y 100% gratis)
1. Entra a tu cuenta de Google en [myaccount.google.com/security](https://myaccount.google.com/security).
2. Activa la **Verificación en 2 pasos** (si aún no la tienes activa).
3. En el buscador superior de tu cuenta de Google escribe **Contraseñas de aplicaciones** (*App passwords*) o entra a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
4. Escribe un nombre (ej. `Taller GSA UPTEX`) y haz clic en **Crear**.
5. Google te mostrará una clave de **16 letras**. Cópiala y llena tu `.env` así:
   ```env
   EMAIL_PROVIDER=smtp
   EMAIL_FROM_NAME="Estudiantes Embajadores de Google 2026 - UPTEX"
   EMAIL_FROM_ADDRESS=tu-correo@gmail.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=tu-correo@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   ```

### Opción 2: Resend API (Alternativa)
1. Crea una cuenta gratuita en [resend.com](https://resend.com/) y genera una API Key.
2. En tu `.env` configura:
   ```env
   EMAIL_PROVIDER=resend
   EMAIL_FROM_NAME="Estudiantes Embajadores de Google 2026 - UPTEX"
   EMAIL_FROM_ADDRESS=onboarding@resend.dev
   RESEND_API_KEY=re_tu_api_key_aqui
   ```

---

## 🧪 Prueba Rápida de Registro y Recordatorios (Sin esperar al 10 de noviembre)

Para verificar en cualquier momento que el registro, la validación de duplicados y el envío de los 3 correos (**Confirmación**, **Recordatorio 24h antes** y **Recordatorio 30min antes**) funcionan correctamente:

```bash
npm run test:simulate
```

Si quieres recibir los **3 correos reales en tu propia bandeja de entrada** durante la prueba, pasa tu correo como argumento:

```bash
node scripts/test-simulation.js tu-correo@gmail.com
```

¿Qué hace este script automáticamente?
1. Registra un participante en la `Sesión 1 (8:00-10:00)` y envía el **Correo de Confirmación**.
2. Intenta registrar el mismo correo por segunda vez y verifica que sea rechazado amablemente.
3. Simula que el reloj en `America/Mexico_City` está en el **9 de noviembre de 2026 a las 8:05 hrs** (24 horas antes), dispara el **Recordatorio de 24h** y marca la columna `Recordatorio 24h enviado` en Google Sheets.
4. Simula que el reloj está en el **10 de noviembre de 2026 a las 7:31 hrs** (30 minutos antes), dispara el **Recordatorio de 30min** y marca la columna `Recordatorio 30min enviado`.
5. Ejecuta un ciclo adicional para comprobar que **no se envían correos duplicados** una vez marcados como `SI`.

---

## ☁️ Guía de Despliegue Gratuito (Render.com + cron-job.org)

1. **Sube tu código a un repositorio de GitHub** (el archivo `.gitignore` ya protege tu `.env` y `service-account.json` para que nunca se suban).
2. Crea una cuenta gratuita en **[Render.com](https://render.com/)** y selecciona **New + > Web Service**.
3. Conecta tu repositorio de GitHub y configura:
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. En la sección **Environment Variables** de Render, agrega las variables de tu `.env` (`GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SMTP_USER`, `SMTP_PASS`, `CRON_SECRET`, etc.).
5. Haz clic en **Create Web Service**. Obtendrás una URL pública como `https://taller-gemini-uptex.onrender.com`.
6. **Mantener el scheduler activo cada 5 minutos gratis:**
   - Además del `node-cron` interno, para evitar que la instancia gratuita de Render entre en reposo por inactividad, crea una cuenta gratuita en **[cron-job.org](https://cron-job.org/)**.
   - Crea un Cronjob apuntando a:
     `https://tu-app.onrender.com/api/cron/reminders?secret=gsa_2026_uptex_cron_secret_key`
   - Configúralo para ejecutarse **cada 5 minutos (`*/5 * * * *`)**. Esto mantendrá tu servidor despierto 24/7 y disparará puntualmente todos los recordatorios.
