const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

test('Stripe webhook signatures are checked and parsed', () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_jz';
  const launch = require('../launch-services');
  const raw = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest('hex');
  assert.equal(launch.verifyStripeEvent(raw, `t=${timestamp},v1=${signature}`).id, 'evt_test');
  assert.equal(launch.verifyStripeEvent(raw, `t=${timestamp},v1=${'0'.repeat(64)}`), null);
});

test('launch pages and required policy sections exist', () => {
  const root = path.resolve(__dirname, '..');
  const legal = fs.readFileSync(path.join(root, 'legal.html'), 'utf8');
  for (const section of ['terms', 'academy', 'privacy', 'refunds', 'cookies', 'contact-policy']) {
    assert.match(legal, new RegExp(`id="${section}"`));
  }
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const key of ['APP_URL', 'SESSION_SECRET', 'MEDIA_SIGNING_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'BACKUP_INTERVAL_HOURS']) {
    assert.match(env, new RegExp(`^${key}=`, 'm'));
  }
});

test('paid media is served only through signed access URLs', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /isProtectedUpload\(relative\)/);
  assert.match(source, /\/api\/media\/secure/);
  assert.match(source, /mediaSignature/);
});

test('Academy admin supports editable modules, lessons, and direct uploads', () => {
  const root = path.resolve(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  for (const id of ['moduleList', 'addModule', 'streamLessons', 'curriculumStatus', 'streamPreviewLink']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(client, /lesson-video-file/);
  assert.match(client, /lesson-resource-file/);
  assert.match(client, /data-lesson-move/);
  assert.match(server, /\/api\/admin\/academy-upload/);
});

test('security policy permits the same-origin homepage editor preview', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /X-Frame-Options','SAMEORIGIN/);
  assert.match(source, /frame-src 'self' https:\/\/checkout\.stripe\.com/);
});

test('production server restricts public files and validates required secrets', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /const PUBLIC_FILES = new Set/);
  assert.match(source, /!PUBLIC_FILES\.has\(normalized\)&&!normalized\.startsWith\('assets\/'\)/);
  assert.match(source, /validateProductionConfig/);
  assert.match(source, /APP_URL must be a public HTTPS URL/);
  assert.match(source, /Strict-Transport-Security/);
  assert.match(source, /Graceful shutdown started/);
});

test('visitor complaints use hashed access tokens and authenticated admin routes', () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const widget = fs.readFileSync(path.join(root, 'support-chat.js'), 'utf8');
  const adminPage = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
  const adminClient = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
  assert.match(source, /const COMPLAINTS_FILE/);
  assert.match(source, /complaintTokenHash/);
  assert.match(source, /crypto\.timingSafeEqual/);
  assert.match(source, /visitorTokenHash:complaintTokenHash\(visitorToken\)/);
  assert.match(source, /\/api\/complaints/);
  assert.match(source, /\/api\/admin\/complaints/);
  assert.match(source, /complaints:readJson\(COMPLAINTS_FILE\)/);
  assert.match(source, /Array\.isArray\(data\.complaints\)/);
  assert.match(source, /'support-chat\.css'/);
  assert.match(source, /'support-chat\.js'/);
  assert.match(widget, /X-Visitor-Token/);
  assert.match(widget, /\/api\/complaints/);
  assert.match(adminPage, /id="supportView"/);
  assert.match(adminPage, /id="supportThread"/);
  assert.match(adminClient, /\/api\/admin\/complaints/);
});

test('marketplace discovery, mobile controls, and aggregate stock protection stay wired', () => {
  const root = path.resolve(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'shop.html'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'shop.js'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  for (const id of ['heroProductSpotlight', 'catalogFilters', 'filterToggle', 'priceRange', 'stockOnly', 'mobileCartBar', 'productModal']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(page, /shop\.css\?v=market-/);
  assert.match(page, /shop\.js\?v=market-/);
  assert.doesNotMatch(page, /\sonclick=/);
  assert.match(client, /trapFocus/);
  assert.match(client, /productQuantity/);
  assert.match(client, /notifyAdjustments/);
  assert.match(server, /requestedTotals/);
});
