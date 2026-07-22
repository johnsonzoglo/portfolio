const replayGrid = document.querySelector('#replayGrid');
const emptyVault = document.querySelector('#emptyVault');
const streamCount = document.querySelector('#streamCount');

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

async function renderStreams() {
  const response = await fetch('/api/streams');
  if (!response.ok) throw new Error('Stream library unavailable');
  const streams = await response.json();
  replayGrid.innerHTML = streams.map(stream => `<article class="replay-card ${stream.featured?'featured':''}"><div class="replay-video"><video controls preload="metadata" playsinline src="${escapeHtml(stream.src)}"></video>${stream.featured?'<span>Featured replay</span>':''}</div><div class="replay-info"><div><small>${escapeHtml(stream.game)} / ${formatDate(stream.date)}</small><h3>${escapeHtml(stream.title)}</h3></div></div></article>`).join('');
  streamCount.textContent = streams.length;
  emptyVault.classList.toggle('hidden', streams.length > 0);
}

renderStreams().catch(() => {
  emptyVault.classList.remove('hidden');
  emptyVault.querySelector('h3').textContent = 'The vault is unavailable';
  emptyVault.querySelector('p').textContent = 'Please check back shortly.';
});
