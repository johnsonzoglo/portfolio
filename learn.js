const params = new URLSearchParams(location.search);
const courseId = params.get('id');
const loading = document.querySelector('#learnLoading');
const experience = document.querySelector('#learnExperience');
const errorState = document.querySelector('#learnError');
const curriculumList = document.querySelector('#curriculumList');
const lessonPlayer = document.querySelector('#lessonPlayer');
let accountToken = localStorage.getItem('jz-account-token');
const learningSpace = document.querySelector('#learningSpace');
const curriculumPanel = document.querySelector('#curriculumPanel');
const curriculumToggle = document.querySelector('#curriculumToggle');
const curriculumClose = document.querySelector('#curriculumClose');
const curriculumOverlay = document.querySelector('#curriculumOverlay');
const lessonNotes = document.querySelector('#lessonNotes');
const notesStatus = document.querySelector('#notesStatus');

let accountSnapshot = null;
let accessInfo = null;
let course = null;
let lessons = [];
let activeIndex = 0;
let completed = [];
let notesSaveTimer = null;
let videoPositionTimer = null;

const readLocalJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const savedIds = () => {
  const value = readLocalJson('jz-academy-saved', []);
  return Array.isArray(value) ? value : [];
};
const progressStore = () => {
  const value = readLocalJson('jz-academy-progress', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const notesStore = () => {
  const value = readLocalJson('jz-academy-notes', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const lastLessonStore = () => {
  const value = readLocalJson('jz-academy-last-lesson', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const videoPositionStore = () => {
  const value = readLocalJson('jz-academy-video-position', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function safeAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function toast(message) {
  const element = document.querySelector('#learnToast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function normalizedCurriculum(item) {
  const populatedModules = (item.modules || []).filter(module => (module.lessons || []).length);
  if (populatedModules.length) {
    return populatedModules.map((module, moduleIndex) => ({
      id: module.id || `module-${moduleIndex}`,
      title: module.title || `Module ${moduleIndex + 1}`,
      lessons: (module.lessons || []).map((lesson, lessonIndex) => ({
        ...lesson,
        id: lesson.id || `${moduleIndex}-${lessonIndex}`,
        title: lesson.title || `Lesson ${lessonIndex + 1}`,
        moduleTitle: module.title || `Module ${moduleIndex + 1}`
      }))
    }));
  }

  const count = Math.max(1, Number(item.lessons) || 1);
  const moduleTitle = item.contentType === 'video' ? 'Featured lesson' : 'Course lessons';
  return [{
    id: 'course',
    title: moduleTitle,
    lessons: Array.from({ length: count }, (_, index) => ({
      id: `lesson-${index + 1}`,
      title: index === 0 ? (item.contentType === 'video' ? item.title : 'Welcome and course overview') : `Lesson ${String(index + 1).padStart(2, '0')}`,
      description: index === 0 ? item.description : 'Follow this focused lesson and apply the ideas to your own project.',
      duration: item.contentType === 'video' || index === 0 ? item.duration : 'Self-paced',
      video: index === 0 ? item.src : '',
      resource: '',
      moduleTitle
    }))
  }];
}

function flattenModules(modules) {
  return modules.flatMap((module, moduleIndex) => module.lessons.map((lesson, lessonIndex) => ({
    ...lesson,
    moduleIndex,
    lessonIndex,
    moduleTitle: module.title
  })));
}

async function saveProgress() {
  const store = progressStore();
  store[course.id] = completed;
  localStorage.setItem('jz-academy-progress', JSON.stringify(store));

  const storedCompleteCourses = readLocalJson('jz-academy-completed', []);
  const completeCourses = Array.isArray(storedCompleteCourses) ? storedCompleteCourses : [];
  const isComplete = Boolean(lessons.length) && completed.length === lessons.length;
  const nextCompleteCourses = isComplete
    ? [...new Set([...completeCourses, course.id])]
    : completeCourses.filter(id => id !== course.id);
  localStorage.setItem('jz-academy-completed', JSON.stringify(nextCompleteCourses));

  if (accountToken) {
    try {
      const response = await fetch('/api/account/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
        body: JSON.stringify({
          courseId: course.id,
          completed
        })
      });
      if (!response.ok) throw new Error('Progress sync failed');
    } catch {
      toast('Progress saved here; account sync is unavailable');
      return false;
    }
  }
  return true;
}

function persistLastLesson(lesson) {
  if (!course || !lesson) return;
  const store = lastLessonStore();
  store[course.id] = lesson.id;
  localStorage.setItem('jz-academy-last-lesson', JSON.stringify(store));
}

function persistVideoPosition(lesson, value) {
  if (!course || !lesson || !Number.isFinite(value)) return;
  const store = videoPositionStore();
  store[`${course.id}:${lesson.id}`] = Math.max(0, Math.round(value));
  localStorage.setItem('jz-academy-video-position', JSON.stringify(store));
}

function wireVideoProgress(video, lesson) {
  if (!video) return;
  const savedPosition = Number(videoPositionStore()[`${course.id}:${lesson.id}`]) || 0;
  video.addEventListener('loadedmetadata', () => {
    if (savedPosition > 0 && savedPosition < Math.max(0, video.duration - 8)) {
      video.currentTime = savedPosition;
    }
  }, { once: true });
  video.addEventListener('timeupdate', () => {
    clearTimeout(videoPositionTimer);
    videoPositionTimer = setTimeout(() => persistVideoPosition(lesson, video.currentTime), 500);
  });
  video.addEventListener('pause', () => persistVideoPosition(lesson, video.currentTime));
}

function currentLessonNotes() {
  if (!course || !lessons[activeIndex]) return '';
  const store = notesStore();
  return String(store[course.id]?.[lessons[activeIndex].id] || '');
}

function renderLessonNotes() {
  clearTimeout(notesSaveTimer);
  lessonNotes.value = currentLessonNotes();
  notesStatus.textContent = 'Notes save automatically in this browser.';
}

function saveLessonNotes() {
  if (!course || !lessons[activeIndex]) return;
  const store = notesStore();
  const courseNotes = store[course.id] && typeof store[course.id] === 'object'
    ? store[course.id]
    : {};
  const lessonId = lessons[activeIndex].id;
  const value = lessonNotes.value.trimEnd();
  if (value) courseNotes[lessonId] = value;
  else delete courseNotes[lessonId];
  store[course.id] = courseNotes;
  localStorage.setItem('jz-academy-notes', JSON.stringify(store));
  notesStatus.textContent = 'Saved on this device.';
}

function scheduleLessonNotesSave() {
  notesStatus.textContent = 'Saving…';
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(saveLessonNotes, 450);
}

function setActiveLessonTab(tabName, focus = false) {
  document.querySelectorAll('[data-lesson-tab]').forEach(button => {
    const active = button.dataset.lessonTab === tabName;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  });
  document.querySelectorAll('[data-lesson-panel]').forEach(panel => {
    const active = panel.dataset.lessonPanel === tabName;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
}

function isMobileCurriculum() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function syncCurriculumAccessibility() {
  const mobile = isMobileCurriculum();
  const expanded = mobile
    ? learningSpace.classList.contains('curriculum-open')
    : !learningSpace.classList.contains('curriculum-collapsed');
  curriculumToggle.setAttribute('aria-expanded', String(expanded));
  curriculumToggle.setAttribute('aria-label', expanded ? 'Close course content' : 'Open course content');
  curriculumToggle.querySelector('b').textContent = expanded ? '−' : '+';
  curriculumPanel.setAttribute('aria-hidden', String(!expanded));
  curriculumPanel.inert = !expanded;
  document.body.classList.toggle('curriculum-drawer-open', mobile && expanded);
  return expanded;
}

function openCurriculum() {
  if (isMobileCurriculum()) learningSpace.classList.add('curriculum-open');
  else learningSpace.classList.remove('curriculum-collapsed');
  syncCurriculumAccessibility();
  requestAnimationFrame(() => curriculumPanel.querySelector('.curriculum-lesson.active, .curriculum-lesson')?.focus());
}

function closeCurriculum({ restoreFocus = true } = {}) {
  if (isMobileCurriculum()) learningSpace.classList.remove('curriculum-open');
  else learningSpace.classList.add('curriculum-collapsed');
  syncCurriculumAccessibility();
  if (restoreFocus) curriculumToggle.focus();
}

function toggleCurriculum() {
  const expanded = syncCurriculumAccessibility();
  if (expanded) closeCurriculum();
  else openCurriculum();
}

async function syncFreeEnrollment(item) {
  if (!accountToken || accessInfo?.requiresPurchase) return;
  try {
    const response = await fetch('/api/account/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ courseId: item.id })
    });
    if (!response.ok && response.status !== 409) throw new Error('Enrollment failed');
  } catch {
    // Free lessons remain usable; account enrollment can retry on the next visit.
  }
}

function updateProgress() {
  const percent = lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0;
  document.querySelector('#courseProgressValue').textContent = `${percent}%`;
  document.querySelector('#courseProgressBar').style.width = `${percent}%`;
  const track = document.querySelector('.progress-track');
  track.setAttribute('aria-valuenow', String(percent));
  document.querySelector('#toolbarProgressBar').style.width = `${percent}%`;
  document.querySelector('#toolbarProgress').textContent = `${completed.length} of ${lessons.length} complete`;
  document.querySelector('#headerProgressValue').textContent = `${percent}%`;
  document.querySelector('#headerProgressRing').style.setProperty('--progress', String(percent));
  document.querySelector('#courseProgressCopy').textContent = percent === 100
    ? 'Course complete. Keep building with what you learned.'
    : completed.length
      ? `${completed.length} of ${lessons.length} lessons complete.`
      : 'Start your first lesson.';
}

function moduleDuration(module) {
  const values = (module.lessons || []).map(lesson => lesson.duration).filter(Boolean);
  return values.length ? `${values.length} part${values.length === 1 ? '' : 's'}` : '';
}

function curriculumMarkup(modules) {
  return modules.map((module, moduleIndex) => `
    <section class="curriculum-module">
      <header>
        <div><small>Module ${String(moduleIndex + 1).padStart(2, '0')}</small><small>${escapeHtml(moduleDuration(module))}</small></div>
        <strong>${escapeHtml(module.title)}</strong>
      </header>
      ${module.lessons.map((lesson, lessonIndex) => {
        const flatIndex = lessons.findIndex(item => item.id === lesson.id);
        const isActive = flatIndex === activeIndex;
        const isDone = completed.includes(lesson.id);
        return `
          <button class="curriculum-lesson ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}" type="button" data-lesson-index="${flatIndex}" ${isActive ? 'aria-current="step"' : ''}>
            <i aria-hidden="true">${isDone ? '✓' : String(lessonIndex + 1).padStart(2, '0')}</i>
            <span><strong>${escapeHtml(lesson.title)}</strong><small>${isDone ? 'Completed' : escapeHtml(module.title)}</small></span>
            <b>${escapeHtml(lesson.duration || '')}</b>
          </button>
        `;
      }).join('')}
    </section>
  `).join('');
}

function playerPlaceholder(lesson, message = 'Lesson media will appear here') {
  const cover = safeAssetUrl(course.coverImage);
  return `
    ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}
    <div class="player-placeholder">
      <small>JZ ACADEMY / ${escapeHtml(lesson.moduleTitle || 'LESSON')}</small>
      <strong>${escapeHtml(lesson.title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function playerMarkup(lesson) {
  const video = safeAssetUrl(lesson.video);
  const cover = safeAssetUrl(course.coverImage);
  if (video) {
    return `<video controls preload="metadata" playsinline src="${escapeHtml(video)}" ${cover ? `poster="${escapeHtml(cover)}"` : ''} aria-label="${escapeHtml(lesson.title)} video"></video>`;
  }
  return playerPlaceholder(lesson);
}

function updateLessonUrl(mode = 'replace') {
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set('id', course.id);
  nextUrl.searchParams.set('lesson', String(activeIndex + 1));
  if (mode === 'push') history.pushState({ lesson: activeIndex + 1 }, '', nextUrl);
  else history.replaceState({ lesson: activeIndex + 1 }, '', nextUrl);
}

function selectLesson(index, options = {}) {
  if (!lessons.length) return;
  if (notesSaveTimer) saveLessonNotes();
  clearTimeout(notesSaveTimer);
  activeIndex = Math.max(0, Math.min(lessons.length - 1, Number(index) || 0));
  const lesson = lessons[activeIndex];
  const isDone = completed.includes(lesson.id);

  curriculumList.innerHTML = curriculumMarkup(course.curriculum);
  lessonPlayer.innerHTML = playerMarkup(lesson);
  const video = lessonPlayer.querySelector('video');
  if (video) {
    wireVideoProgress(video, lesson);
    video.addEventListener('error', () => {
      lessonPlayer.innerHTML = playerPlaceholder(lesson, 'This video is temporarily unavailable');
    }, { once: true });
  }

  document.querySelector('#lessonPosition').textContent = `Lesson ${String(activeIndex + 1).padStart(2, '0')} / ${String(lessons.length).padStart(2, '0')}`;
  document.querySelector('#lessonDuration').textContent = lesson.duration || course.duration || 'Self-paced lesson';
  const lessonTitle = document.querySelector('#lessonTitle');
  lessonTitle.textContent = lesson.title;
  lessonTitle.tabIndex = -1;
  document.querySelector('#lessonDescription').textContent = lesson.description || 'Follow the lesson, apply the key idea, and mark it complete when you are ready.';

  const completeButton = document.querySelector('#completeLesson');
  completeButton.textContent = isDone ? '✓ Lesson completed' : 'Mark lesson complete';
  completeButton.classList.toggle('done', isDone);
  completeButton.setAttribute('aria-pressed', String(isDone));
  document.querySelector('#previousLesson').disabled = activeIndex === 0;
  document.querySelector('#nextLesson').disabled = activeIndex === lessons.length - 1;

  const resource = document.querySelector('#lessonResource');
  const resourceUrl = safeAssetUrl(lesson.resource);
  resource.innerHTML = resourceUrl
    ? `<span>Lesson resource</span><strong>Download and keep building</strong><p>Use the supporting material while completing this lesson.</p><a href="${escapeHtml(resourceUrl)}" target="_blank" rel="noopener">Open resource &nearr;</a>`
    : '<span>Lesson resource</span><strong>No download for this lesson</strong><p>Worksheets, references, and files added by the instructor will appear here.</p>';

  renderLessonNotes();
  persistLastLesson(lesson);
  if (!options.fromHistory) updateLessonUrl(options.fromNavigation ? 'push' : 'replace');
  document.querySelector('#lessonStatus').textContent = `Now viewing lesson ${activeIndex + 1} of ${lessons.length}: ${lesson.title}`;

  requestAnimationFrame(() => {
    curriculumList.querySelector('.curriculum-lesson.active')?.scrollIntoView({ block: 'nearest' });
  });

  if (options.fromNavigation) {
    if (isMobileCurriculum()) {
      closeCurriculum({ restoreFocus: false });
      lessonPlayer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    requestAnimationFrame(() => lessonTitle.focus({ preventScroll: true }));
  }
}

function renderSaved() {
  const isSaved = Boolean(course && savedIds().includes(course.id));
  const button = document.querySelector('#learnSave');
  button.classList.toggle('saved', isSaved);
  button.setAttribute('aria-pressed', String(isSaved));
  button.innerHTML = isSaved ? '&#9829; Saved' : '&#9825; Save';
  button.disabled = !course;
}

async function toggleSaved() {
  if (!course) return;
  const localItems = savedIds();
  const wasSaved = localItems.includes(course.id);
  const next = wasSaved ? localItems.filter(id => id !== course.id) : [...localItems, course.id];
  localStorage.setItem('jz-academy-saved', JSON.stringify(next));

  renderSaved();

  if (accountToken && accountSnapshot?.customer) {
    const serverCourses = accountSnapshot.customer.savedCourses || [];
    const courses = wasSaved
      ? serverCourses.filter(id => id !== course.id)
      : [...new Set([...serverCourses, course.id])];
    try {
      const response = await fetch('/api/account/saved', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
        body: JSON.stringify({ courses })
      });
      if (!response.ok) throw new Error('Saved-course sync failed');
      accountSnapshot.customer.savedCourses = courses;
    } catch {
      toast('Saved on this device; account sync is unavailable');
      return;
    }
  } else if (accountToken) {
    toast('Saved on this device; account sync is unavailable');
    return;
  }

  toast(wasSaved ? 'Removed from saved learning' : 'Saved for later');
}

function renderAccessPreview(modules) {
  document.querySelector('#accessPreviewCount').textContent = `${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`;
  document.querySelector('#accessCurriculum').innerHTML = modules.map((module, moduleIndex) => `
    <section class="access-preview-module">
      <strong>Module ${String(moduleIndex + 1).padStart(2, '0')} · ${escapeHtml(module.title)}</strong>
      <ol>
        ${module.lessons.map(lesson => `<li><span>${escapeHtml(lesson.title)}</span><span>${escapeHtml(lesson.duration || 'Self-paced')}</span></li>`).join('')}
      </ol>
    </section>
  `).join('');
}

function renderCourseCover() {
  const image = document.querySelector('#courseCoverImage');
  const source = safeAssetUrl(course.coverImage);
  if (!source) return;
  image.src = source;
  image.alt = `${course.title} course cover`;
  image.hidden = false;
  image.addEventListener('error', () => {
    image.hidden = true;
  }, { once: true });
}

function renderReviews() {
  const reviewList = document.querySelector('#courseReviewList');
  fetch(`/api/reviews?targetId=${encodeURIComponent(course.id)}`)
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(reviews => {
      if (!Array.isArray(reviews) || !reviews.length) {
        reviewList.innerHTML = '<p class="no-reviews">No public reviews yet. Complete the course and share your experience.</p>';
        return;
      }
      reviewList.innerHTML = reviews.map(review => {
        const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));
        const date = new Date(review.createdAt);
        const formattedDate = Number.isNaN(date.getTime()) ? 'Recent student' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        return `
          <article>
            <strong><span aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}</span>${escapeHtml(review.title || 'Student review')}</strong>
            <p>${escapeHtml(review.comment || '')}</p>
            <small>${escapeHtml(review.customerName || 'Academy student')} · ${escapeHtml(formattedDate)}</small>
          </article>
        `;
      }).join('');
    })
    .catch(() => {
      reviewList.innerHTML = '<p class="no-reviews">Student feedback is unavailable right now.</p>';
    });
}

function updatePaymentMethodHint() {
  const method = document.querySelector('#coursePaymentMethod').value;
  const messages = {
    stripe: 'Card payment unlocks the course after secure checkout.',
    bank: 'Send the request first. The admin will share transfer instructions and unlock access after confirmation.',
    cash: 'Send the request first. The admin will arrange payment and unlock access after confirmation.'
  };
  document.querySelector('#paymentMethodHint').textContent = messages[method] || messages.bank;
}

function configureAccessGate() {
  const isLocked = accessInfo.requiresPurchase && !accessInfo.hasAccess;
  const accessLabel = document.querySelector('#courseAccessLabel');
  const skipLink = document.querySelector('.learn-skip-link');
  if (!accessInfo.requiresPurchase) accessLabel.textContent = 'Free access';
  else if (accessInfo.hasAccess) accessLabel.textContent = 'Premium · Access granted';
  else accessLabel.textContent = 'Premium course';

  if (!isLocked) {
    document.querySelector('#learningSpace').hidden = false;
    document.querySelector('#accessGate').hidden = true;
    skipLink.href = '#learningSpace';
    skipLink.textContent = 'Skip to lesson';
    return;
  }

  document.querySelector('#learningSpace').hidden = true;
  document.querySelector('#accessGate').hidden = false;
  skipLink.href = '#accessGate';
  skipLink.textContent = 'Skip to course access';
  const currency = String(accessInfo.currency || 'USD').toUpperCase();
  document.querySelector('#accessPrice').textContent = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number(accessInfo.price) % 1 ? 2 : 0,
    maximumFractionDigits: 2
  }).format(Number(accessInfo.price) || 0);
  renderAccessPreview(course.curriculum);

  const primaryAction = document.querySelector('#coursePrimaryAction');
  primaryAction.href = '#accessGate';
  primaryAction.innerHTML = 'Unlock full course <b aria-hidden="true">&darr;</b>';

  const purchaseButton = document.querySelector('#purchaseCourse');
  if (!accountToken) purchaseButton.innerHTML = 'Sign in to unlock <b aria-hidden="true">&nearr;</b>';
  const pendingOrder = accountSnapshot?.orders?.find(order => (
    order.courseId === course.id
    && order.paymentStatus !== 'paid'
    && order.paymentStatus !== 'refunded'
    && order.status !== 'cancelled'
  ));
  if (pendingOrder) {
    document.querySelector('#purchaseMessage').classList.add('success');
    document.querySelector('#purchaseMessage').textContent = `Request ${pendingOrder.number} is awaiting payment confirmation.`;
    purchaseButton.innerHTML = pendingOrder.checkoutUrl
      ? 'Continue secure checkout <b aria-hidden="true">&nearr;</b>'
      : 'Payment request pending <b aria-hidden="true">✓</b>';
  }
  if (!accessInfo.payments?.stripe) {
    document.querySelector('#courseStripePayment')?.remove();
    document.querySelector('#coursePaymentMethod').value = 'bank';
  }
  updatePaymentMethodHint();
}

function renderCourse(item) {
  course = item;
  course.curriculum = normalizedCurriculum(item);
  lessons = flattenModules(course.curriculum);
  const validLessonIds = new Set(lessons.map(lesson => lesson.id));
  const localCompleted = progressStore()[course.id] || [];
  const accountCompleted = accountSnapshot?.customer?.progress?.[course.id]?.completed || [];
  completed = [...new Set([...localCompleted, ...accountCompleted])].filter(id => validLessonIds.has(id));
  const store = progressStore();
  store[course.id] = completed;
  localStorage.setItem('jz-academy-progress', JSON.stringify(store));

  document.title = `${course.title} · JZ Academy`;
  document.querySelector('meta[name="description"]').content = course.description || 'Learn practical skills with JZ Academy.';
  document.querySelector('#headerCourseTitle').textContent = course.title;
  document.querySelector('#courseEyebrow').textContent = `JZ Academy / ${course.contentType === 'course' ? 'Course' : 'Quick lesson'} / ${course.game || 'Practical learning'}`;
  document.querySelector('#courseTitle').textContent = course.title;
  document.querySelector('#courseDescription').textContent = course.description || 'A practical JZ Academy lesson designed to help you learn by building.';
  document.querySelector('#courseLevel').textContent = course.level || 'All levels';
  document.querySelector('#courseDuration').textContent = course.duration || 'Self-paced';
  document.querySelector('#courseLessonCount').textContent = `${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`;
  document.querySelector('#courseFormat').textContent = course.contentType === 'course' ? 'Guided course' : 'Quick lesson';
  document.querySelector('#curriculumCount').textContent = `${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`;

  renderCourseCover();
  updateProgress();
  renderSaved();
  renderReviews();
  configureAccessGate();

  const requestedLessonParam = new URLSearchParams(location.search).get('lesson');
  const lastLessonId = lastLessonStore()[course.id];
  const lastLessonIndex = lessons.findIndex(lesson => lesson.id === lastLessonId);
  const requestedLesson = requestedLessonParam
    ? Math.max(0, Number(requestedLessonParam) - 1)
    : Math.max(0, lastLessonIndex);
  selectLesson(requestedLesson);
  loading.hidden = true;
  experience.hidden = false;
  syncCurriculumAccessibility();

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'course_view', path: location.pathname, itemId: course.id, label: course.title })
  }).catch(() => {});
}

function showLearningError(type = 'not-found') {
  loading.hidden = true;
  experience.hidden = true;
  errorState.hidden = false;
  if (type === 'network') {
    document.querySelector('#learnErrorCode').textContent = 'CONNECTION / ACADEMY UNAVAILABLE';
    document.querySelector('#learnErrorTitle').textContent = 'We couldn’t load this course.';
    document.querySelector('#learnErrorCopy').textContent = 'Check your connection, then try again. Your saved progress is still safe.';
  } else if (type === 'missing-id') {
    document.querySelector('#learnErrorCode').textContent = 'COURSE LINK / INCOMPLETE';
    document.querySelector('#learnErrorTitle').textContent = 'Choose a course to start learning.';
    document.querySelector('#learnErrorCopy').textContent = 'This link does not include a course. Return to the Academy and select one from the library.';
    document.querySelector('#retryLearning').hidden = true;
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error('Request failed');
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function loadCourseAccess() {
  try {
    return await requestJson(`/api/learning/${encodeURIComponent(courseId)}`, {
      headers: accountToken ? { Authorization: `Bearer ${accountToken}` } : {}
    });
  } catch (error) {
    if (error.status !== 401 || !accountToken) throw error;
    localStorage.removeItem('jz-account-token');
    accountToken = null;
    return requestJson(`/api/learning/${encodeURIComponent(courseId)}`);
  }
}

async function loadLearning() {
  if (!courseId) {
    showLearningError('missing-id');
    return;
  }

  loading.hidden = false;
  experience.hidden = true;
  errorState.hidden = true;
  document.querySelector('#learnSave').disabled = true;
  try {
    const learningPromise = loadCourseAccess();
    const accountPromise = accountToken
      ? requestJson('/api/account/me', { headers: { Authorization: `Bearer ${accountToken}` } }).catch(() => null)
      : Promise.resolve(null);
    const [learning, account] = await Promise.all([learningPromise, accountPromise]);
    accessInfo = learning;
    accountSnapshot = account;
    const item = learning.course;

    if (account?.customer?.savedCourses?.includes(item.id)) {
      const saved = savedIds();
      if (!saved.includes(item.id)) localStorage.setItem('jz-academy-saved', JSON.stringify([...saved, item.id]));
    }

    renderCourse(item);
    syncFreeEnrollment(item);
  } catch (error) {
    showLearningError(error.status === 404 ? 'not-found' : 'network');
  }
}

curriculumList.addEventListener('click', event => {
  const button = event.target.closest('[data-lesson-index]');
  if (button) selectLesson(Number(button.dataset.lessonIndex), { fromNavigation: true });
});
document.querySelector('#completeLesson').addEventListener('click', async () => {
  if (!lessons.length) return;
  const id = lessons[activeIndex].id;
  completed = completed.includes(id) ? completed.filter(item => item !== id) : [...completed, id];
  updateProgress();
  selectLesson(activeIndex);
  toast(completed.includes(id) ? 'Lesson completed' : 'Lesson marked incomplete');
  await saveProgress();
});
document.querySelector('#previousLesson').addEventListener('click', () => selectLesson(activeIndex - 1, { fromNavigation: true }));
document.querySelector('#nextLesson').addEventListener('click', () => selectLesson(activeIndex + 1, { fromNavigation: true }));
document.querySelector('#learnSave').addEventListener('click', toggleSaved);
document.querySelector('#retryLearning').addEventListener('click', loadLearning);
document.querySelector('#coursePaymentMethod').addEventListener('change', updatePaymentMethodHint);

document.querySelector('#purchaseCourse').addEventListener('click', async () => {
  if (!accountToken) {
    location.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }

  const button = document.querySelector('#purchaseCourse');
  const message = document.querySelector('#purchaseMessage');
  button.disabled = true;
  message.classList.remove('success');
  message.textContent = 'Preparing secure access…';
  try {
    const response = await fetch('/api/account/purchase-course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({
        courseId: course.id,
        paymentMethod: document.querySelector('#coursePaymentMethod').value
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        location.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      throw new Error(result.error || 'We could not prepare course access.');
    }
    if (result.checkoutUrl) {
      location.href = result.checkoutUrl;
      return;
    }
    message.classList.add('success');
    message.textContent = `Request ${result.orderNumber} created. Access unlocks after payment is confirmed.`;
    button.innerHTML = 'Access request pending <b aria-hidden="true">✓</b>';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

curriculumToggle.addEventListener('click', toggleCurriculum);
curriculumClose.addEventListener('click', () => closeCurriculum());
curriculumOverlay.addEventListener('click', () => closeCurriculum());
lessonNotes.addEventListener('input', scheduleLessonNotesSave);

document.querySelector('.lesson-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-lesson-tab]');
  if (button) setActiveLessonTab(button.dataset.lessonTab);
});
document.querySelector('.lesson-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('[data-lesson-tab]')];
  const currentIndex = Math.max(0, tabs.indexOf(event.target));
  let nextIndex = currentIndex;
  if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = tabs.length - 1;
  event.preventDefault();
  setActiveLessonTab(tabs[nextIndex].dataset.lessonTab, true);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && learningSpace.classList.contains('curriculum-open')) {
    event.preventDefault();
    closeCurriculum();
    return;
  }
  if (!course || (accessInfo?.requiresPurchase && !accessInfo?.hasAccess) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.matches('input, textarea, select, button, video, [contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft' && activeIndex > 0) selectLesson(activeIndex - 1, { fromNavigation: true });
  if (event.key === 'ArrowRight' && activeIndex < lessons.length - 1) selectLesson(activeIndex + 1, { fromNavigation: true });
});

window.addEventListener('popstate', () => {
  if (!course) return;
  const requestedLesson = Math.max(0, Number(new URLSearchParams(location.search).get('lesson') || 1) - 1);
  selectLesson(requestedLesson, { fromHistory: true });
});
window.addEventListener('resize', () => {
  if (!isMobileCurriculum()) learningSpace.classList.remove('curriculum-open');
  syncCurriculumAccessibility();
});
window.addEventListener('beforeunload', () => {
  if (course) saveLessonNotes();
  const video = lessonPlayer.querySelector('video');
  if (video && lessons[activeIndex]) persistVideoPosition(lessons[activeIndex], video.currentTime);
});

renderSaved();
setActiveLessonTab('overview');
syncCurriculumAccessibility();
loadLearning();
