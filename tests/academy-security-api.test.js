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
const jsonOptions = (method, body, token = '') => ({
  method,
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(body)
});
const availablePort = () => new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const { port } = listener.address();
    listener.close(error => error ? reject(error) : resolve(port));
  });
});

test('Academy APIs enforce visibility, paid entitlement, trusted progress, and protected paths', async t => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jz-academy-security-'));
  for (const file of ['server.js', 'launch-services.js', 'business.js']) {
    fs.copyFileSync(path.join(root, file), path.join(testRoot, file));
  }

  const dataDirectory = path.join(testRoot, 'data');
  const uploadsDirectory = path.join(testRoot, 'assets', 'uploads');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.mkdirSync(path.join(uploadsDirectory, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(uploadsDirectory, 'Paid-Lesson.mp4'), 'paid lesson media');
  fs.writeFileSync(path.join(uploadsDirectory, 'Canonical.mp4'), 'canonical paid media');
  fs.writeFileSync(path.join(uploadsDirectory, 'Public.mp4'), 'public media');

  const baseCourse = {
    game: 'Testing',
    date: '2026-07-29',
    contentType: 'course',
    level: 'Beginner',
    duration: '20 min',
    description: 'Security test course',
    coverImage: '',
    size: 0,
    featured: false,
    createdAt: '2026-07-29T00:00:00.000Z'
  };
  const streams = [
    {
      ...baseCourse,
      id: 'free-live',
      title: 'Free live course',
      accessType: 'free',
      price: 0,
      lessons: 2,
      src: '',
      published: true,
      publishAt: '',
      modules: [{
        id: 'free-module',
        title: 'Free module',
        lessons: [
          { id: 'free-1', title: 'Free one', video: '', resource: '' },
          { id: 'free-2', title: 'Free two', video: '', resource: '' }
        ]
      }]
    },
    {
      ...baseCourse,
      id: 'paid-live',
      title: 'Paid live course',
      accessType: 'paid',
      price: 49,
      lessons: 2,
      src: '',
      published: true,
      publishAt: '',
      modules: [{
        id: 'paid-module',
        title: 'Paid module',
        lessons: [
          { id: 'paid-1', title: 'Paid one', video: 'assets/uploads/Paid-Lesson.mp4', resource: '' },
          { id: 'paid-2', title: 'Paid two', video: '', resource: '' }
        ]
      }]
    },
    {
      ...baseCourse,
      id: 'canonical-paid',
      title: 'Canonical paid media',
      accessType: 'paid',
      price: 20,
      lessons: 1,
      src: '',
      published: true,
      publishAt: '',
      modules: [{
        id: 'canonical-module',
        title: 'Canonical module',
        lessons: [{
          id: 'canonical-1',
          title: 'Canonical lesson',
          video: path.join('assets', 'uploads', 'nested', '..', 'Canonical.mp4'),
          resource: ''
        }]
      }]
    },
    {
      ...baseCourse,
      id: 'future-free',
      title: 'Future free course',
      accessType: 'free',
      price: 0,
      lessons: 1,
      src: '',
      published: true,
      publishAt: '2999-01-01T00:00:00.000Z',
      modules: []
    },
    {
      ...baseCourse,
      id: 'future-paid',
      title: 'Future paid course',
      accessType: 'paid',
      price: 99,
      lessons: 1,
      src: '',
      published: true,
      publishAt: '2999-01-01T00:00:00.000Z',
      modules: []
    },
    {
      ...baseCourse,
      id: 'unpublished',
      title: 'Unpublished course',
      accessType: 'free',
      price: 0,
      lessons: 1,
      src: '',
      published: false,
      publishAt: '',
      modules: []
    }
  ];
  fs.writeFileSync(path.join(dataDirectory, 'streams.json'), JSON.stringify(streams, null, 2));
  for (const file of ['products', 'orders', 'customers', 'reviews', 'support', 'notifications', 'analytics', 'media']) {
    fs.writeFileSync(path.join(dataDirectory, `${file}.json`), '[]');
  }

  const port = await availablePort();
  const adminPassword = 'Academy-Security-Owner!2026';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: testRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: String(port),
      ADMIN_PASSWORD: adminPassword,
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

  const library = await jsonRequest(`${base}/api/streams`);
  assert.equal(library.response.status, 200);
  assert.deepEqual(new Set(library.payload.map(course => course.id)), new Set(['free-live', 'paid-live', 'canonical-paid']));

  for (const id of ['future-free', 'future-paid', 'unpublished']) {
    const hidden = await jsonRequest(`${base}/api/learning/${id}`);
    assert.equal(hidden.response.status, 404);
  }

  const registration = await jsonRequest(`${base}/api/account/register`, jsonOptions('POST', {
    name: 'Academy Test User',
    email: 'academy@example.com',
    password: 'Academy-Test-Password!2026'
  }));
  assert.equal(registration.response.status, 201);
  const customerToken = registration.payload.token;

  for (const id of ['future-free', 'future-paid', 'unpublished']) {
    const hiddenEnrollment = await jsonRequest(`${base}/api/account/enroll`, jsonOptions('POST', { courseId: id }, customerToken));
    assert.equal(hiddenEnrollment.response.status, 404);
    const hiddenPurchase = await jsonRequest(`${base}/api/account/purchase-course`, jsonOptions('POST', { courseId: id, paymentMethod: 'bank' }, customerToken));
    assert.equal(hiddenPurchase.response.status, 404);
    const hiddenProgress = await jsonRequest(`${base}/api/account/progress`, jsonOptions('PUT', { courseId: id, completed: [], percent: 100 }, customerToken));
    assert.equal(hiddenProgress.response.status, 404);
  }

  const deniedProgress = await jsonRequest(`${base}/api/account/progress`, jsonOptions('PUT', {
    courseId: 'paid-live',
    completed: ['paid-1'],
    percent: 100
  }, customerToken));
  assert.equal(deniedProgress.response.status, 403);
  let customers = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'customers.json'), 'utf8'));
  assert.equal(customers[0].enrollments.some(item => item.courseId === 'paid-live'), false);
  assert.equal(customers[0].progress['paid-live'], undefined);

  const freeProgress = await jsonRequest(`${base}/api/account/progress`, jsonOptions('PUT', {
    courseId: 'free-live',
    completed: ['free-1', 'free-1'],
    percent: 100
  }, customerToken));
  assert.equal(freeProgress.response.status, 200);
  assert.deepEqual(freeProgress.payload.completed, ['free-1']);
  assert.equal(freeProgress.payload.percent, 50);
  customers = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'customers.json'), 'utf8'));
  assert.equal(customers[0].enrollments.find(item => item.courseId === 'free-live').access, 'free');

  const pendingPurchase = await jsonRequest(`${base}/api/account/purchase-course`, jsonOptions('POST', {
    courseId: 'paid-live',
    paymentMethod: 'bank'
  }, customerToken));
  assert.equal(pendingPurchase.response.status, 201);
  const pendingProgress = await jsonRequest(`${base}/api/account/progress`, jsonOptions('PUT', {
    courseId: 'paid-live',
    completed: ['paid-1'],
    percent: 100
  }, customerToken));
  assert.equal(pendingProgress.response.status, 403);
  customers = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'customers.json'), 'utf8'));
  assert.equal(customers[0].enrollments.some(item => item.courseId === 'paid-live'), false);
  assert.equal(customers[0].progress['paid-live'], undefined);

  const adminLogin = await jsonRequest(`${base}/api/admin/login`, jsonOptions('POST', {
    username: 'owner',
    password: adminPassword
  }));
  assert.equal(adminLogin.response.status, 200);
  const adminToken = adminLogin.payload.token;
  const orders = await jsonRequest(`${base}/api/admin/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const academyOrder = orders.payload.find(order => order.number === pendingPurchase.payload.orderNumber);
  assert.ok(academyOrder);
  const paidOrder = await jsonRequest(`${base}/api/admin/orders/${academyOrder.id}`, jsonOptions('PATCH', {
    paymentStatus: 'paid',
    status: 'completed'
  }, adminToken));
  assert.equal(paidOrder.response.status, 200);

  const trustedProgress = await jsonRequest(`${base}/api/account/progress`, jsonOptions('PUT', {
    courseId: 'paid-live',
    completed: ['paid-1', 'paid-1'],
    percent: 99
  }, customerToken));
  assert.equal(trustedProgress.response.status, 200);
  assert.deepEqual(trustedProgress.payload.completed, ['paid-1']);
  assert.equal(trustedProgress.payload.percent, 50);

  const invalidProgress = await jsonRequest(`${base}/api/account/progress`, jsonOptions('PUT', {
    courseId: 'paid-live',
    completed: ['paid-1', 'free-1'],
    percent: 100
  }, customerToken));
  assert.equal(invalidProgress.response.status, 400);
  customers = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'customers.json'), 'utf8'));
  assert.deepEqual(customers[0].progress['paid-live'].completed, ['paid-1']);
  assert.equal(customers[0].progress['paid-live'].percent, 50);

  const entitledLearning = await jsonRequest(`${base}/api/learning/paid-live`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert.equal(entitledLearning.response.status, 200);
  assert.equal(entitledLearning.payload.hasAccess, true);
  const secureMediaUrl = entitledLearning.payload.course.modules[0].lessons[0].video;
  assert.match(secureMediaUrl, /^\/api\/media\/secure\?/);
  const secureMedia = await fetch(`${base}${secureMediaUrl}`);
  assert.equal(secureMedia.status, 200);
  assert.equal(await secureMedia.text(), 'paid lesson media');

  const protectedDirect = await fetch(`${base}/assets/uploads/Paid-Lesson.mp4`);
  assert.equal(protectedDirect.status, 403);
  const protectedBackslash = await fetch(`${base}/assets/uploads%5CPaid-Lesson.mp4`);
  assert.equal(protectedBackslash.status, 403);
  const protectedCanonical = await fetch(`${base}/assets/uploads/Canonical.mp4`);
  assert.equal(protectedCanonical.status, 403);
  if (process.platform === 'win32') {
    const protectedCaseVariant = await fetch(`${base}/assets/uploads/paid-lesson.mp4`);
    assert.equal(protectedCaseVariant.status, 403);
  }
  const publicMedia = await fetch(`${base}/assets/uploads/Public.mp4`);
  assert.equal(publicMedia.status, 200);
  assert.equal(await publicMedia.text(), 'public media');

  customers = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'customers.json'), 'utf8'));
  customers[0].active = false;
  fs.writeFileSync(path.join(dataDirectory, 'customers.json'), JSON.stringify(customers, null, 2));

  const inactiveAccount = await jsonRequest(`${base}/api/account/me`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert.equal(inactiveAccount.response.status, 401);
  const inactiveProgress = await jsonRequest(`${base}/api/account/progress`, jsonOptions('PUT', {
    courseId: 'paid-live',
    completed: ['paid-1', 'paid-2'],
    percent: 100
  }, customerToken));
  assert.equal(inactiveProgress.response.status, 401);
  const inactiveLearning = await jsonRequest(`${base}/api/learning/paid-live`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert.equal(inactiveLearning.response.status, 200);
  assert.equal(inactiveLearning.payload.hasAccess, false);
  assert.equal(inactiveLearning.payload.course.modules[0].lessons[0].video, undefined);
  const inactiveMedia = await jsonRequest(`${base}${secureMediaUrl}`);
  assert.equal(inactiveMedia.response.status, 403);
});
