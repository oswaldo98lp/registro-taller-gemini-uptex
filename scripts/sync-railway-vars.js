const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '../.env');
const serviceAccountPath = path.join(__dirname, '../service-account.json');

const parsedEnv = fs.existsSync(envPath)
  ? dotenv.parse(fs.readFileSync(envPath, 'utf8'))
  : {};

// Si existe service-account.json en local, inyectamos sus credenciales como variables para Railway
if (fs.existsSync(serviceAccountPath)) {
  try {
    const rawJson = fs.readFileSync(serviceAccountPath, 'utf8');
    const creds = JSON.parse(rawJson);
    if (creds.client_email && !parsedEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      parsedEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL = creds.client_email;
    }
    if (creds.private_key && !parsedEnv.GOOGLE_PRIVATE_KEY) {
      parsedEnv.GOOGLE_PRIVATE_KEY = creds.private_key;
    }
    parsedEnv.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(creds);
  } catch (err) {
    console.warn('⚠️ No se pudo leer service-account.json:', err.message);
  }
}

// Ajustar NODE_ENV a production para el despliegue en Railway
parsedEnv.NODE_ENV = 'production';
delete parsedEnv.PORT; // Railway inyecta su propio PORT dinámicamente
delete parsedEnv.PUBLIC_BASE_URL;
delete parsedEnv.GOOGLE_APPLICATION_CREDENTIALS;

const keys = Object.keys(parsedEnv).filter(
  (k) => parsedEnv[k] !== undefined && String(parsedEnv[k]).trim() !== ''
);

console.log(`🚀 Sincronizando ${keys.length} variables de entorno con Railway...`);

for (const key of keys) {
  const value = String(parsedEnv[key]);
  const res = spawnSync(
    process.platform === 'win32' ? 'railway.cmd' : 'railway',
    ['variable', 'set', key, '--stdin', '--skip-deploys'],
    {
      input: value,
      encoding: 'utf8',
      shell: process.platform === 'win32'
    }
  );

  if (res.status !== 0) {
    console.error(`❌ Error configurando ${key}:`, (res.stderr || res.stdout || '').trim());
    process.exit(1);
  } else {
    console.log(`   ✅ Variable configurada en Railway: ${key}`);
  }
}

console.log('\n🎉 Todas las variables de entorno quedaron configuradas en Railway.');
