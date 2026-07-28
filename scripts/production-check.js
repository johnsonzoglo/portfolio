const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const requireText = (file, pattern, message) => {
  if (!pattern.test(read(file))) failures.push(`${file}: ${message}`);
};

requireText('server.js', /const PUBLIC_FILES = new Set/, 'public-file allowlist is missing');
requireText('server.js', /\/api\/ready/, 'readiness endpoint is missing');
requireText('server.js', /validateProductionConfig\(\)/, 'production configuration validation is missing');
requireText('server.js', /Strict-Transport-Security/, 'HSTS is missing');
requireText('server.js', /SIGTERM/, 'graceful shutdown handling is missing');
requireText('docker-compose.yml', /read_only:\s*true/, 'container filesystem is not read-only');
requireText('docker-compose.yml', /cap_drop:\s*\n\s*-\s*ALL/, 'Linux capabilities are not dropped');
requireText('docker-compose.yml', /\/api\/ready/, 'container healthcheck does not use readiness');
requireText('.dockerignore', /data\/users\.json/, 'admin credentials are not excluded from image layers');
requireText('.dockerignore', /data\/customers\.json/, 'customer records are not excluded from image layers');
requireText('.github/workflows/production.yml', /docker build -t jz-platform:test/, 'production container is not built in CI');
requireText('.github/workflows/production.yml', /\/data\/users\.json/, 'CI does not test sensitive-file blocking');

const envExample = read('.env.example');
for (const key of ['APP_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET', 'MEDIA_SIGNING_SECRET', 'TRUST_PROXY']) {
  if (!new RegExp(`^${key}=.+`, 'm').test(envExample)) failures.push(`.env.example: ${key} is missing`);
}

if (failures.length) {
  console.error(`Production readiness failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Production readiness checks passed.');
