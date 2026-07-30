const token = sessionStorage.getItem('jz-admin-token');
if (!token) location.href = 'admin.html';

const teamList = document.querySelector('#teamList');
const teamForm = document.querySelector('#teamForm');
const teamMessage = document.querySelector('#teamMessage');
let users = [];

const esc = (value) => {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    sessionStorage.removeItem('jz-admin-token');
    location.href = 'admin.html';
    throw new Error('Your session expired.');
  }
  if (!response.ok) throw new Error(data.error || 'The team could not be updated.');
  return data;
}

function renderUsers() {
  teamList.innerHTML = users.length ? users.map((user) => `
    <article class="list-row team-user-row">
      <div class="team-user"><span>${esc(user.name?.[0] || user.username?.[0] || 'J')}</span><div><strong>${esc(user.name)}</strong><small>@${esc(user.username)}</small></div></div>
      <select data-role="${esc(user.id)}" aria-label="Role for ${esc(user.name)}">
        ${['owner', 'manager', 'staff'].map((role) => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role[0].toUpperCase()}${role.slice(1)}</option>`).join('')}
      </select>
      <span class="team-state ${user.active ? 'active' : ''}"><i></i>${user.active ? 'Active' : 'Disabled'}</span>
      <button type="button" data-password="${esc(user.id)}">Reset password</button>
      <button type="button" data-active="${esc(user.id)}" data-value="${!user.active}">${user.active ? 'Disable' : 'Enable'}</button>
    </article>`).join('') : '<div class="team-empty"><strong>No staff accounts yet</strong><span>Add the first teammate using the form above.</span></div>';
}

async function load() {
  teamList.innerHTML = '<div class="team-empty"><span>Loading team accounts…</span></div>';
  users = await api('/api/admin/users');
  renderUsers();
}

teamForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  teamMessage.textContent = '';
  const button = teamForm.querySelector('button');
  button.disabled = true;
  try {
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(teamForm))) });
    teamForm.reset();
    teamMessage.textContent = 'Team account created.';
    await load();
  } catch (error) {
    teamMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

teamList.addEventListener('change', async (event) => {
  const id = event.target.dataset.role;
  if (!id) return;
  teamMessage.textContent = '';
  try {
    await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) });
    teamMessage.textContent = 'Role updated.';
    await load();
  } catch (error) {
    teamMessage.textContent = error.message;
    await load();
  }
});

teamList.addEventListener('click', async (event) => {
  const passwordButton = event.target.closest('[data-password]');
  const activeButton = event.target.closest('[data-active]');
  if (!passwordButton && !activeButton) return;
  teamMessage.textContent = '';
  const button = passwordButton || activeButton;
  button.disabled = true;
  try {
    if (passwordButton) {
      const password = prompt('Enter a new password with at least 8 characters:');
      if (!password) return;
      await api(`/api/admin/users/${encodeURIComponent(passwordButton.dataset.password)}`, { method: 'PATCH', body: JSON.stringify({ password }) });
      teamMessage.textContent = 'Password reset successfully.';
    } else {
      await api(`/api/admin/users/${encodeURIComponent(activeButton.dataset.active)}`, { method: 'PATCH', body: JSON.stringify({ active: activeButton.dataset.value === 'true' }) });
      teamMessage.textContent = activeButton.dataset.value === 'true' ? 'Account enabled.' : 'Account disabled.';
    }
    await load();
  } catch (error) {
    teamMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

load().catch((error) => {
  teamMessage.textContent = error.message;
  teamList.innerHTML = '<div class="team-empty"><strong>Could not load team accounts</strong><span>Return to the dashboard and sign in again.</span></div>';
});
