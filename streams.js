const academyGrid = document.querySelector('#replayGrid');
const academyState = document.querySelector('#academyState');
const academyStateLabel = document.querySelector('#academyStateLabel');
const academyStateTitle = document.querySelector('#academyStateTitle');
const academyStateCopy = document.querySelector('#academyStateCopy');
const academyStateAction = document.querySelector('#academyStateAction');
const contentCount = document.querySelector('#streamCount');
const searchInput = document.querySelector('#academySearch');
const filterButtons = [...document.querySelectorAll('.academy-filters [data-filter]')];
const levelInput = document.querySelector('#academyLevel');
const sortInput = document.querySelector('#academySort');
const savedFilterButton = document.querySelector('#savedLearningFilter');
const academyToast = document.querySelector('#academyToast');
const academyResume = document.querySelector('#academyResume');
const resumeGrid = document.querySelector('#resumeGrid');
const academyMenu = document.querySelector('#academyMenu');
const academyNav = document.querySelector('#academyNav');
const academyNavBackdrop = document.querySelector('#academyNavBackdrop');

const readLocalJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

let academyItems = [];
let activeFilter = 'all';
let savedLearning = readLocalJson('jz-academy-saved', []);
if (!Array.isArray(savedLearning)) savedLearning = [];
let showSavedLearning = false;
let featuredItem = null;
let libraryStatus = 'loading';
let academyCurrency = 'USD';
let academyAccount = null;

const academyMoney = value => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: academyCurrency,
  minimumFractionDigits: Number(value) % 1 ? 2 : 0,
  maximumFractionDigits: 2
}).format(Number(value) || 0);

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

function itemType(item) {
  return item.contentType === 'course' ? 'course' : 'video';
}

function lessonCount(item) {
  const moduleTotal = (item.modules || []).reduce((total, module) => total + (module.lessons || []).length, 0);
  return Math.max(1, moduleTotal || Number(item.lessons) || 1);
}

function durationMinutes(value) {
  const normalized = String(value || '').toLowerCase();
  const hours = Number(normalized.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour)/)?.[1] || 0);
  const minutes = Number(normalized.match(/(\d+)\s*(?:m|min|minute)/)?.[1] || 0);
  if (hours || minutes) return (hours * 60) + minutes;
  return Number(normalized.match(/\d+/)?.[0] || Number.MAX_SAFE_INTEGER);
}

function progressFor(item) {
  const storedCompletedCourses = readLocalJson('jz-academy-completed', []);
  const completedCourses = Array.isArray(storedCompletedCourses) ? storedCompletedCourses : [];
  if (completedCourses.includes(item.id)) return 100;
  const storedProgress = readLocalJson('jz-academy-progress', {});
  const progress = storedProgress && typeof storedProgress === 'object' && !Array.isArray(storedProgress) ? storedProgress : {};
  const validIds = new Set(itemLessons(item).map(lesson => lesson.id));
  const completed = Array.isArray(progress[item.id]) ? [...new Set(progress[item.id])].filter(id => validIds.has(id)) : [];
  return Math.min(100, Math.round((completed.length / lessonCount(item)) * 100));
}

function itemLessons(item) {
  const moduleLessons = (item.modules || []).flatMap(module => module.lessons || []);
  if (moduleLessons.length) return moduleLessons;
  return Array.from({ length: lessonCount(item) }, (_, index) => ({
    id: `lesson-${index + 1}`,
    title: item.contentType === 'video' && index === 0 ? item.title : `Lesson ${index + 1}`
  }));
}

function resumeHref(item, lastLessonId, completedIds) {
  const lessons = itemLessons(item);
  const lastIndex = lessons.findIndex(lesson => lesson.id === lastLessonId);
  const nextIndex = lessons.findIndex(lesson => !completedIds.includes(lesson.id));
  const lessonIndex = lastIndex >= 0 ? lastIndex : Math.max(0, nextIndex);
  return `learn.html?id=${encodeURIComponent(item.id)}&lesson=${lessonIndex + 1}`;
}

function renderResumeLearning() {
  const storedProgress = readLocalJson('jz-academy-progress', {});
  const progress = storedProgress && typeof storedProgress === 'object' && !Array.isArray(storedProgress)
    ? storedProgress
    : {};
  const storedLastLessons = readLocalJson('jz-academy-last-lesson', {});
  const lastLessons = storedLastLessons && typeof storedLastLessons === 'object' && !Array.isArray(storedLastLessons)
    ? storedLastLessons
    : {};

  const resumable = academyItems
    .map(item => {
      const validIds = new Set(itemLessons(item).map(lesson => lesson.id));
      const completedIds = Array.isArray(progress[item.id])
        ? [...new Set(progress[item.id])].filter(id => validIds.has(id))
        : [];
      const percent = progressFor(item);
      return {
        item,
        completedIds,
        percent,
        lastLessonId: lastLessons[item.id] || ''
      };
    })
    .filter(entry => (entry.completedIds.length || entry.lastLessonId) && entry.percent < 100)
    .slice(0, 3);

  if (!resumable.length) {
    academyResume.hidden = true;
    resumeGrid.innerHTML = '';
    return;
  }

  academyResume.hidden = false;
  resumeGrid.innerHTML = resumable.map(({ item, completedIds, percent, lastLessonId }) => {
    const image = safeAssetUrl(item.coverImage);
    const lessons = itemLessons(item);
    const lastIndex = lessons.findIndex(lesson => lesson.id === lastLessonId);
    const nextIndex = lessons.findIndex(lesson => !completedIds.includes(lesson.id));
    const lesson = lessons[lastIndex >= 0 ? lastIndex : Math.max(0, nextIndex)];
    const href = resumeHref(item, lastLessonId, completedIds);
    const progressLabel = percent > 0 ? `${percent}% complete` : 'Ready to continue';
    return `
      <article class="resume-card">
        <a class="resume-card-media" href="${href}" aria-label="Continue ${escapeHtml(item.title)}">
          ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ''}
          <span>${percent || 0}%</span>
        </a>
        <div class="resume-card-copy">
          <small>${escapeHtml(item.game || 'JZ Academy')}</small>
          <h3 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          <div class="resume-progress-copy"><span>${progressLabel}</span><b>${completedIds.length}/${lessons.length}</b></div>
          <div class="resume-progress-track" aria-label="${progressLabel}"><i style="width:${percent}%"></i></div>
          <a href="${href}">
            <span>${lesson ? `Resume: ${escapeHtml(lesson.title)}` : 'Continue learning'}</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </article>
    `;
  }).join('');
}

function filteredItems() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedLevel = levelInput.value;
  const items = academyItems.filter(item => {
    const searchable = [
      item.title,
      item.game,
      item.description,
      item.level,
      item.contentType
    ].some(value => String(value || '').toLowerCase().includes(query));
    return (activeFilter === 'all' || itemType(item) === activeFilter)
      && (selectedLevel === 'all' || item.level === selectedLevel)
      && (!showSavedLearning || savedLearning.includes(item.id))
      && (!query || searchable);
  });

  return items.sort((a, b) => {
    if (sortInput.value === 'title') return String(a.title).localeCompare(String(b.title));
    if (sortInput.value === 'newest') return String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''));
    if (sortInput.value === 'duration') return durationMinutes(a.duration) - durationMinutes(b.duration);
    return (Number(b.featured) - Number(a.featured)) || academyItems.indexOf(a) - academyItems.indexOf(b);
  });
}

function showAcademyToast(message) {
  academyToast.textContent = message;
  academyToast.classList.add('show');
  clearTimeout(showAcademyToast.timer);
  showAcademyToast.timer = setTimeout(() => academyToast.classList.remove('show'), 2200);
}

async function toggleSaved(id) {
  savedLearning = savedLearning.includes(id)
    ? savedLearning.filter(itemId => itemId !== id)
    : [...savedLearning, id];
  localStorage.setItem('jz-academy-saved', JSON.stringify(savedLearning));
  renderAcademy();
  const isSaved = savedLearning.includes(id);
  const accountToken = localStorage.getItem('jz-account-token');
  if (accountToken && academyAccount?.customer) {
    try {
      const response = await fetch('/api/account/saved', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
        body: JSON.stringify({ courses: savedLearning })
      });
      if (!response.ok) throw new Error('Saved learning sync failed');
      academyAccount.customer.savedCourses = [...savedLearning];
    } catch {
      showAcademyToast('Saved on this device; account sync is unavailable');
      return;
    }
  } else if (accountToken) {
    showAcademyToast('Saved on this device; account sync is unavailable');
    return;
  }
  showAcademyToast(isSaved ? 'Saved to your learning list' : 'Removed from saved learning');
}

function setLibraryState(type) {
  academyState.hidden = false;
  academyGrid.hidden = true;
  if (type === 'error') {
    academyStateLabel.textContent = 'Connection issue';
    academyStateTitle.textContent = 'The Academy could not be loaded.';
    academyStateCopy.textContent = 'Check your connection and try loading the course library again.';
    academyStateAction.textContent = 'Try again';
    return;
  }

  if (showSavedLearning) {
    academyStateLabel.textContent = 'Your saved learning';
    academyStateTitle.textContent = 'Nothing saved yet.';
    academyStateCopy.textContent = 'Select the heart on any course to keep it here for later.';
  } else {
    academyStateLabel.textContent = 'No matches';
    academyStateTitle.textContent = 'No courses match those filters.';
    academyStateCopy.textContent = 'Try another search, level, or format—or reset the filters to see everything.';
  }
  academyStateAction.textContent = 'Reset filters';
}

function cardMedia(item) {
  const image = safeAssetUrl(item.coverImage);
  return `
    <div class="academy-card-art" aria-hidden="true">
      <small>JZ / ${itemType(item).toUpperCase()}</small>
      <strong>${escapeHtml(item.title)}</strong>
      <b>&#9654;</b>
    </div>
    ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ''}
  `;
}

function cardMarkup(item) {
  const type = itemType(item);
  const count = lessonCount(item);
  const progress = progressFor(item);
  const isSaved = savedLearning.includes(item.id);
  const href = `learn.html?id=${encodeURIComponent(item.id)}`;
  const price = item.accessType === 'paid' ? academyMoney(item.price) : 'Free';
  const accessCopy = item.accessType === 'paid' ? 'One-time access' : 'Open access';

  return `
    <article class="academy-card" data-academy-id="${escapeHtml(item.id)}">
      <div class="academy-card-media">
        ${cardMedia(item)}
        <a class="academy-card-media-link" href="${href}" aria-label="Open ${escapeHtml(item.title)}"></a>
        <div class="academy-card-badges" aria-hidden="true">
          <span>${type === 'course' ? 'Course' : 'Quick lesson'}</span>
          ${item.accessType === 'paid' ? `<span class="paid-badge">Locked · ${academyMoney(item.price)}</span>` : '<span class="free-badge">Free</span>'}
          ${item.featured ? '<span class="featured">Featured</span>' : ''}
        </div>
        <button class="save-learning ${isSaved ? 'saved' : ''}" type="button" aria-label="${isSaved ? 'Remove' : 'Save'} ${escapeHtml(item.title)} ${isSaved ? 'from' : 'to'} your learning list" aria-pressed="${isSaved}" data-save-id="${escapeHtml(item.id)}">${isSaved ? '&#9829;' : '&#9825;'}</button>
        <span class="card-play" aria-hidden="true">&#9654;</span>
      </div>
      <div class="academy-card-info">
        <div class="academy-card-meta">
          <span>${escapeHtml(item.game || 'Practical learning')}</span>
          <span>${escapeHtml(item.level || 'All levels')}</span>
        </div>
        <h3><a href="${href}">${escapeHtml(item.title)}</a></h3>
        <p class="academy-card-description">${escapeHtml(item.description || 'A focused JZ Academy lesson designed to help you learn by building.')}</p>
        <ul class="academy-card-facts" aria-label="Course details">
          <li><i aria-hidden="true"></i>${count} lesson${count === 1 ? '' : 's'}</li>
          <li><i aria-hidden="true"></i>${escapeHtml(item.duration || 'Self-paced')}</li>
        </ul>
        ${progress > 0 ? `
          <div class="course-progress" aria-label="${progress}% complete">
            <div class="course-progress-copy"><span>Your progress</span><b>${progress}%</b></div>
            <div class="course-progress-track"><i style="width:${progress}%"></i></div>
          </div>
        ` : ''}
        <div class="academy-card-footer">
          <span class="academy-card-price"><small>${accessCopy}</small><strong>${price}</strong></span>
          <a class="open-learning" href="${href}">${progress ? 'Continue' : item.accessType === 'paid' ? 'View course' : 'Start learning'} <span aria-hidden="true">&rarr;</span></a>
        </div>
      </div>
    </article>
  `;
}

function renderAcademy() {
  if (libraryStatus === 'loading') return;
  const visible = filteredItems();
  const query = searchInput.value.trim();
  const hasFilters = query || activeFilter !== 'all' || levelInput.value !== 'all' || showSavedLearning;

  contentCount.textContent = visible.length;
  document.querySelector('#savedLearningCount').textContent = savedLearning.length;
  savedFilterButton.classList.toggle('active', showSavedLearning);
  savedFilterButton.setAttribute('aria-pressed', String(showSavedLearning));
  filterButtons.forEach(button => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  if (libraryStatus === 'error') {
    document.querySelector('#academySummary').textContent = 'The library is temporarily unavailable';
    setLibraryState('error');
    return;
  }

  if (showSavedLearning) {
    document.querySelector('#academySummary').textContent = `${visible.length} saved resource${visible.length === 1 ? '' : 's'}`;
  } else if (query) {
    document.querySelector('#academySummary').textContent = `${visible.length} result${visible.length === 1 ? '' : 's'} for “${query}”`;
  } else if (hasFilters) {
    document.querySelector('#academySummary').textContent = `${visible.length} resource${visible.length === 1 ? '' : 's'} match your filters`;
  } else {
    document.querySelector('#academySummary').textContent = `${visible.length} practical learning resource${visible.length === 1 ? '' : 's'}`;
  }

  if (!visible.length) {
    academyGrid.innerHTML = '';
    setLibraryState('empty');
    return;
  }

  academyState.hidden = true;
  academyGrid.hidden = false;
  academyGrid.classList.remove('is-loading');
  academyGrid.setAttribute('aria-busy', 'false');
  academyGrid.innerHTML = visible.map(cardMarkup).join('');
}

function renderSpotlight() {
  featuredItem = academyItems.find(item => item.featured) || academyItems[0] || null;
  const spotlight = document.querySelector('#featuredLesson');
  if (!featuredItem) {
    spotlight.hidden = true;
    return;
  }

  const count = lessonCount(featuredItem);
  const href = `learn.html?id=${encodeURIComponent(featuredItem.id)}`;
  document.querySelector('#spotlightTitle').textContent = featuredItem.title;
  document.querySelector('#spotlightArtTitle').textContent = featuredItem.title;
  document.querySelector('#spotlightDescription').textContent = featuredItem.description || 'A practical lesson designed to help you learn by building.';
  document.querySelector('#spotlightMeta').textContent = `${itemType(featuredItem) === 'course' ? `${count} lesson${count === 1 ? '' : 's'}` : 'Quick lesson'} · ${featuredItem.level || 'All levels'} · ${featuredItem.accessType === 'paid' ? academyMoney(featuredItem.price) : 'Free'}`;
  document.querySelector('#spotlightOpen').href = href;
  document.querySelector('#spotlightVisual').href = href;
  document.querySelector('#spotlightVisual').setAttribute('aria-label', `Open ${featuredItem.title}`);

  const image = document.querySelector('#spotlightImage');
  const source = safeAssetUrl(featuredItem.coverImage);
  if (source) {
    image.src = source;
    image.alt = `${featuredItem.title} course cover`;
    image.hidden = false;
  }
}

function resetFilters(options = {}) {
  searchInput.value = '';
  levelInput.value = 'all';
  sortInput.value = 'recommended';
  activeFilter = 'all';
  showSavedLearning = false;
  renderAcademy();
  if (options.focus) searchInput.focus();
}

async function loadAcademy() {
  libraryStatus = 'loading';
  academyState.hidden = true;
  academyGrid.hidden = false;
  academyGrid.classList.add('is-loading');
  academyGrid.setAttribute('aria-busy', 'true');
  try {
    const accountToken = localStorage.getItem('jz-account-token');
    const [response, settings, account] = await Promise.all([
      fetch('/api/streams', { headers: { Accept: 'application/json' } }),
      fetch('/api/store-settings', { headers: { Accept: 'application/json' } })
        .then(result => result.ok ? result.json() : null)
        .catch(() => null),
      accountToken
        ? fetch('/api/account/me', { headers: { Accept: 'application/json', Authorization: `Bearer ${accountToken}` } })
          .then(result => result.ok ? result.json() : null)
          .catch(() => null)
        : Promise.resolve(null)
    ]);
    if (!response.ok) throw new Error('Academy request failed');
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error('Academy response was invalid');
    if (/^[A-Z]{3}$/.test(String(settings?.currency || '').toUpperCase())) {
      academyCurrency = String(settings.currency).toUpperCase();
    }
    if (account?.customer) {
      academyAccount = account;
      savedLearning = [...new Set([...savedLearning, ...(account.customer.savedCourses || [])])];
      localStorage.setItem('jz-academy-saved', JSON.stringify(savedLearning));
      const localProgress = readLocalJson('jz-academy-progress', {});
      const mergedProgress = localProgress && typeof localProgress === 'object' && !Array.isArray(localProgress)
        ? localProgress
        : {};
      Object.entries(account.customer.progress || {}).forEach(([itemId, entry]) => {
        const localCompleted = Array.isArray(mergedProgress[itemId]) ? mergedProgress[itemId] : [];
        const serverCompleted = Array.isArray(entry?.completed) ? entry.completed : [];
        mergedProgress[itemId] = [...new Set([...localCompleted, ...serverCompleted])];
      });
      localStorage.setItem('jz-academy-progress', JSON.stringify(mergedProgress));
    }
    academyItems = items;
    libraryStatus = 'ready';
    document.querySelector('#heroCourseCount').textContent = items.filter(item => itemType(item) === 'course').length;
    document.querySelector('#heroVideoCount').textContent = items.filter(item => itemType(item) === 'video').length;
    renderResumeLearning();
    renderSpotlight();
    renderAcademy();
  } catch {
    academyItems = [];
    libraryStatus = 'error';
    contentCount.textContent = '0';
    academyGrid.classList.remove('is-loading');
    academyGrid.setAttribute('aria-busy', 'false');
    renderAcademy();
  }
}

filterButtons.forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  showSavedLearning = false;
  renderAcademy();
}));
searchInput.addEventListener('input', renderAcademy);
levelInput.addEventListener('change', renderAcademy);
sortInput.addEventListener('change', renderAcademy);
savedFilterButton.addEventListener('click', () => {
  showSavedLearning = !showSavedLearning;
  renderAcademy();
});
document.querySelector('#clearAcademyFilters').addEventListener('click', () => resetFilters({ focus: true }));
academyStateAction.addEventListener('click', () => {
  if (libraryStatus === 'error') loadAcademy();
  else resetFilters({ focus: true });
});

academyGrid.addEventListener('click', event => {
  const saveButton = event.target.closest('[data-save-id]');
  if (saveButton) toggleSaved(saveButton.dataset.saveId);
});
academyGrid.addEventListener('error', event => {
  if (event.target.matches('.academy-card-media img')) event.target.hidden = true;
}, true);
resumeGrid.addEventListener('error', event => {
  if (event.target.matches('.resume-card-media img')) event.target.hidden = true;
}, true);
document.querySelector('#spotlightImage').addEventListener('error', event => {
  event.currentTarget.hidden = true;
});

document.querySelectorAll('[data-path]').forEach(link => link.addEventListener('click', () => {
  searchInput.value = link.dataset.path;
  levelInput.value = 'all';
  activeFilter = 'all';
  showSavedLearning = false;
  renderAcademy();
}));

function setAcademyMenu(open) {
  academyMenu.setAttribute('aria-expanded', String(open));
  academyMenu.setAttribute('aria-label', open ? 'Close Academy menu' : 'Open Academy menu');
  academyNav.classList.toggle('is-open', open);
  academyNavBackdrop.hidden = !open;
  document.body.classList.toggle('academy-menu-open', open);
}

academyMenu.addEventListener('click', () => {
  setAcademyMenu(academyMenu.getAttribute('aria-expanded') !== 'true');
});
academyNavBackdrop.addEventListener('click', () => setAcademyMenu(false));
academyNav.addEventListener('click', event => {
  if (event.target.closest('a')) setAcademyMenu(false);
});

document.addEventListener('keydown', event => {
  const target = event.target;
  const isTyping = target.matches('input, textarea, select, [contenteditable="true"]');
  if (event.key === '/' && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && academyMenu.getAttribute('aria-expanded') === 'true') {
    setAcademyMenu(false);
    academyMenu.focus();
  }
  if (event.key === 'Tab' && academyMenu.getAttribute('aria-expanded') === 'true') {
    const focusable = [
      academyMenu,
      ...academyNav.querySelectorAll('a'),
      document.querySelector('.academy-cta')
    ].filter(Boolean);
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      focusable.at(-1).focus();
    } else if (!event.shiftKey && index === focusable.length - 1) {
      event.preventDefault();
      focusable[0].focus();
    }
  }
});

document.querySelector('#year').textContent = new Date().getFullYear();
window.addEventListener('pageshow', () => {
  if (academyItems.length) renderResumeLearning();
});
window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
  if (event.matches) setAcademyMenu(false);
});
setAcademyMenu(false);
loadAcademy();
