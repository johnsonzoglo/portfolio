const reveals = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

reveals.forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index % 3, 2) * 80}ms`;
  observer.observe(element);
});

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const siteImages = document.querySelectorAll('[data-site-image]');
const siteText = document.querySelectorAll('[data-site-text]');
const siteLinks = document.querySelectorAll('[data-site-href]');
const isEditorPreview = new URLSearchParams(location.search).has('editor-preview');
function applyHomepageContent(homepage = {}) {
  if (homepage.siteTitle) document.title = homepage.siteTitle;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && homepage.metaDescription) metaDescription.content = homepage.metaDescription;
  siteText.forEach((element) => {
    const value = homepage[element.dataset.siteText];
    if (value !== undefined && value !== '') element.textContent = value;
  });
  siteLinks.forEach((element) => {
    const value = homepage[element.dataset.siteHref];
    if (value) element.href = value;
  });
  siteImages.forEach((image) => {
    const source = homepage[image.dataset.siteImage];
    if (source) {
      image.src = source;
      image.alt = homepage[`${image.dataset.siteImage}Alt`] || '';
      image.classList.add('has-custom-image');
    } else {
      image.removeAttribute('src');
      image.classList.remove('has-custom-image');
    }
  });
}
if (siteImages.length || siteText.length || siteLinks.length) {
  fetch('/api/site-content')
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((content) => applyHomepageContent(content.homepage || {}))
    .catch(() => {})
    .finally(() => {
      if (isEditorPreview) window.parent.postMessage({ type: 'jz-preview-ready' }, location.origin);
    });
}

if (isEditorPreview) {
  document.body.classList.add('editor-preview-mode');
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    if (event.data?.type === 'jz-editor-preview') applyHomepageContent(event.data.homepage || {});
    if (event.data?.type === 'jz-editor-scroll') {
      const section = event.data.section;
      const target = ['studio', 'academy', 'market', 'images'].includes(section) ? document.querySelector('#world') : document.querySelector('#top');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  document.addEventListener('click', (event) => {
    const editable = event.target.closest('[data-site-text],[data-site-image],[data-site-href]');
    if (!editable) return;
    event.preventDefault();
    const key = editable.dataset.siteText || editable.dataset.siteImage || editable.dataset.siteHref || '';
    let section = ['studio', 'academy', 'market'].find((name) => key.toLowerCase().startsWith(name)) || 'hero';
    if (editable.dataset.siteImage) section = 'images';
    if (key === 'siteTitle' || key === 'metaDescription' || key === 'contactTitle') section = 'seo';
    window.parent.postMessage({ type: 'jz-preview-select', section }, location.origin);
  });
}

if (!location.pathname.includes('admin') && !isEditorPreview) {
  fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'page_view',path:location.pathname})}).catch(()=>{});
}

// Give project visuals a subtle, tactile response to the pointer.
document.querySelectorAll('.project-visual').forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--y', `${event.clientY - rect.top}px`);
  });
});
