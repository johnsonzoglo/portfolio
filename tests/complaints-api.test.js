const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { once } = require('events');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsonRequest = async (url, options = {}) => {
  const response = await fetch(url, options);
  const payload = await response.json();
  return { response, payload };
};

const availablePort = () => new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const { port } = listener.address();
    listener.close(error => error ? reject(error) : resolve(port));
  });
});

test('visitor and admin complaint APIs persist a secure two-way conversation', async t => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-complaints-'));
  for (const file of ['server.js', 'launch-services.js', 'business.js']) {
    fs.copyFileSync(path.join(root, file), path.join(testRoot, file));
  }

  const port = await availablePort();
  const password = 'Complaint-Test-Owner!2026';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: testRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: String(port),
      ADMIN_PASSWORD: password,
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
      BACKUP_INTERVAL_HOURS: '0'
    }
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
    }
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) assert.fail(`Test server exited early.\n${output}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, `Test server did not become ready.\n${output}`);

  const created = await jsonRequest(`${base}/api/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Visitor',
      email: 'visitor@example.com',
      subject: 'Delivery complaint',
      message: 'Please help with my delivery.',
      page: '/shop.html'
    })
  });
  assert.equal(created.response.status, 201);
  assert.match(created.payload.visitorToken, /^[a-f0-9]{64}$/);
  assert.equal(created.payload.conversation.status, 'open');
  assert.equal('visitorTokenHash' in created.payload.conversation, false);

  const stored = fs.readFileSync(path.join(testRoot, 'data', 'complaints.json'), 'utf8');
  assert.equal(stored.includes(created.payload.visitorToken), false);
  assert.match(stored, /"visitorTokenHash": "[a-f0-9]{64}"/);

  const denied = await jsonRequest(`${base}/api/complaints/${created.payload.conversationId}`, {
    headers: { 'X-Visitor-Token': 'wrong-token' }
  });
  assert.equal(denied.response.status, 404);

  const followUp = await jsonRequest(`${base}/api/complaints/${created.payload.conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Token': created.payload.visitorToken },
    body: JSON.stringify({ message: 'The order number is JZ-TEST.' })
  });
  assert.equal(followUp.response.status, 201);
  assert.equal(followUp.payload.conversation.messages.length, 2);

  const unauthorized = await jsonRequest(`${base}/api/admin/complaints`);
  assert.equal(unauthorized.response.status, 401);

  const login = await jsonRequest(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password })
  });
  assert.equal(login.response.status, 200);
  const adminHeaders = { Authorization: `Bearer ${login.payload.token}` };

  const list = await jsonRequest(`${base}/api/admin/complaints`, { headers: adminHeaders });
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.length, 1);
  assert.equal(list.payload[0].unreadCount, 2);
  assert.equal('visitorTokenHash' in list.payload[0], false);

  const reply = await jsonRequest(`${base}/api/admin/complaints/${created.payload.conversationId}/messages`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'We are checking this for you now.' })
  });
  assert.equal(reply.response.status, 201);
  assert.equal(reply.payload.conversation.status, 'in-progress');

  const visitorView = await jsonRequest(`${base}/api/complaints/${created.payload.conversationId}`, {
    headers: { 'X-Visitor-Token': created.payload.visitorToken }
  });
  assert.equal(visitorView.response.status, 200);
  assert.equal(visitorView.payload.conversation.messages.at(-1).sender, 'admin');
  assert.equal(visitorView.payload.conversation.messages.at(-1).message, 'We are checking this for you now.');
  assert.equal('user' in visitorView.payload.conversation.messages.at(-1), false);
  assert.equal('assignedTo' in visitorView.payload.conversation, false);

  const resolved = await jsonRequest(`${base}/api/admin/complaints/${created.payload.conversationId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'resolved', read: true })
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.payload.status, 'resolved');

  const reopened = await jsonRequest(`${base}/api/complaints/${created.payload.conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Token': created.payload.visitorToken },
    body: JSON.stringify({ message: 'I still need help.' })
  });
  assert.equal(reopened.response.status, 201);
  assert.equal(reopened.payload.conversation.status, 'open');
});
