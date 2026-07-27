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
