const DB_NAME = 'jz-stream-vault';
const STORE_NAME = 'streams';
const modal = document.querySelector('#uploadModal');
const overlay = document.querySelector('#modalOverlay');
const form = document.querySelector('#uploadForm');
const fileInput = document.querySelector('#streamFile');
const fileName = document.querySelector('#fileName');
const fileDrop = document.querySelector('#fileDrop');
const replayGrid = document.querySelector('#replayGrid');
const emptyVault = document.querySelector('#emptyVault');
const streamCount = document.querySelector('#streamCount');
const message = document.querySelector('#formMessage');
const progress = document.querySelector('#uploadProgress');
const titleInput = document.querySelector('#streamTitle');
const gameInput = document.querySelector('#streamGame');
const dateInput = document.querySelector('#streamDate');
let activeUrls = [];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runStore(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

function openModal() {
  modal.classList.add('open'); overlay.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.querySelector('#streamTitle').focus(), 100);
}
function closeModal() { modal.classList.remove('open'); overlay.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
function formatDate(date) { return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }

async function renderStreams() {
  activeUrls.forEach(URL.revokeObjectURL); activeUrls = [];
  const streams = await runStore('readonly', (store) => store.getAll());
  streams.sort((a, b) => b.id - a.id);
  replayGrid.innerHTML = streams.map((stream) => {
    const url = URL.createObjectURL(stream.video); activeUrls.push(url);
    return `<article class="replay-card"><video controls preload="metadata" src="${url}"></video><div class="replay-info"><div><small>${escapeHtml(stream.game)} / ${formatDate(stream.date)}</small><h3>${escapeHtml(stream.title)}</h3></div><button type="button" data-delete="${stream.id}">Delete</button></div></article>`;
  }).join('');
  streamCount.textContent = streams.length;
  emptyVault.classList.toggle('hidden', streams.length > 0);
}

function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
function showSelectedFile(file) { if (file) fileName.textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB`; }

document.querySelectorAll('[data-open-upload]').forEach((button) => button.addEventListener('click', openModal));
document.querySelector('#uploadClose').addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
fileInput.addEventListener('change', () => showSelectedFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach((type) => fileDrop.addEventListener(type, (event) => { event.preventDefault(); fileDrop.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((type) => fileDrop.addEventListener(type, (event) => { event.preventDefault(); fileDrop.classList.remove('dragging'); }));
fileDrop.addEventListener('drop', (event) => { if (event.dataTransfer.files[0]?.type.startsWith('video/')) { fileInput.files = event.dataTransfer.files; showSelectedFile(fileInput.files[0]); } });

form.addEventListener('submit', async (event) => {
  event.preventDefault(); message.textContent = '';
  const video = fileInput.files[0];
  if (!video) { message.textContent = 'Choose a video file first.'; return; }
  progress.classList.add('active');
  try {
    await runStore('readwrite', (store) => store.add({ title: titleInput.value.trim(), game: gameInput.value.trim(), date: dateInput.value, video, createdAt: Date.now() }));
    form.reset(); fileName.textContent = 'MP4, WebM, OGG or MOV'; closeModal(); await renderStreams();
  } catch (error) {
    message.textContent = error?.name === 'QuotaExceededError' ? 'This video is too large for available browser storage.' : 'The video could not be saved. Please try a smaller file.';
  } finally { progress.classList.remove('active'); }
});

replayGrid.addEventListener('click', async (event) => {
  const id = Number(event.target.dataset.delete);
  if (!id || !confirm('Delete this stream replay from your browser?')) return;
  await runStore('readwrite', (store) => store.delete(id)); await renderStreams();
});

dateInput.valueAsDate = new Date();
renderStreams().catch(() => { document.querySelector('#emptyVault p').textContent = 'Browser storage is unavailable. Try a current version of Chrome, Edge, or Firefox.'; });
