const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
let csrfToken = '';
let state = null;
let activeMatchFilter = 'All';
let toastTimer;

async function api(url, options = {}) {
  if (!csrfToken) {
    const csrfResponse = await fetch('/api/csrf', { credentials: 'same-origin' });
    const csrf = await csrfResponse.json();
    if (!csrfResponse.ok) throw new Error(csrf.error || 'Could not start a secure session.');
    csrfToken = csrf.csrfToken;
  }
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken, ...options.headers }
  });
  let data = {};
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function toast(message, error = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3600);
}

function openApp(username) {
  $('#admin-login-shell').hidden = true;
  $('#admin-app').hidden = false;
  $('#operator-name').innerHTML = `${esc(username || 'ADMIN')}<small>EVENT ADMINISTRATOR</small>`;
}

$('#admin-login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const credentials = Object.fromEntries(new FormData(form));
  const username = credentials.username;
  button.disabled = true;
  $('#admin-error').textContent = '';
  try {
    const result = await api('/admin/login', { method: 'POST', body: JSON.stringify(credentials) });
    openApp(result.username || username);
    await loadData();
  } catch (error) {
    $('#admin-error').textContent = error.message;
  } finally { button.disabled = false; }
});

function showPage(name) {
  const label = { overview:'Overview', settings:'Event settings', games:'Games & capacity', matches:'Matches & results', registrations:'Registrations', admins:'Admin accounts' };
  $$('.admin-page').forEach(page => { page.hidden = page.dataset.view !== name; });
  $$('.side-nav [data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === name));
  $('#page-title').textContent = label[name] || 'Overview';
  if (innerWidth < 800) window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
$$('[data-goto]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.goto)));

function countRegistered(gameName) {
  return state.students.filter(row => row.game === gameName && row.status === 'Registered').length;
}

function renderOverview() {
  const active = state.students.filter(row => row.status === 'Registered').length;
  const spots = state.games.reduce((sum, game) => sum + Math.max(0, game.capacity - countRegistered(game.name)), 0);
  const live = state.matches.filter(match => match.status === 'Live').length;
  const today = state.matches.filter(match => new Date(match.starts_at).toDateString() === new Date().toDateString()).length;
  $('#stats').innerHTML = [
    ['ACTIVE REGISTRATIONS', active, 'Across all game arenas'],
    ['OPEN SPOTS', spots, 'Available before capacity'],
    ['LIVE MATCHES', live, 'Running in the arena now'],
    ['MATCHES TODAY', today, 'Scheduled for today']
  ].map(([label, value, hint]) => `<article class="metric-card"><small>${label}</small><b>${value}</b><span>${hint}</span></article>`).join('');

  $('#overview-date').textContent = new Date(`${String(state.settings.event_date).slice(0,10)}T12:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  $('#overview-location').textContent = `${state.settings.university_name} · ${state.settings.venue}`.toUpperCase();
  $('#game-stats').innerHTML = state.games.map(game => {
    const registered = countRegistered(game.name);
    const percent = game.capacity ? Math.min(100, Math.round(registered / game.capacity * 100)) : 0;
    return `<div class="game-stat"><span class="game-stat-name">${esc(game.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div><span class="game-stat-count">${registered} / ${game.capacity} <small>· ${Math.max(0,game.capacity-registered)} left</small></span></div>`;
  }).join('');

  const upcoming = state.matches.filter(match => match.status !== 'Completed').sort((a,b) => new Date(a.starts_at)-new Date(b.starts_at)).slice(0,4);
  $('#up-next').innerHTML = upcoming.length ? upcoming.map(match => `<div class="up-next-row"><time>${new Date(match.starts_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time><div><b>${esc(match.label)}</b><small>${esc(match.game)} · ${new Date(match.starts_at).toLocaleDateString()}</small></div><span class="status-pill ${match.status.toLowerCase()}">${esc(match.status.toUpperCase())}</span></div>`).join('') : '<p class="empty-state">No upcoming matches yet. Create the first schedule slot from Matches & results.</p>';
}

function renderSettings() {
  const form = $('#settings-form');
  form.elements.event_date.value = String(state.settings.event_date).slice(0,10);
  form.elements.venue.value = state.settings.venue || '';
  form.elements.university_name.value = state.settings.university_name || '';
  form.onsubmit = async event => {
    event.preventDefault();
    const button = $('.neon-button', form); button.disabled = true;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      toast('Event settings saved.');
      await loadData();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  };
}

function renderGames() {
  $('#games').innerHTML = state.games.map(game => `<form class="admin-game" data-id="${game.id}">
    <label class="game-title-label">GAME NAME<input name="name" maxlength="80" required value="${esc(game.name)}"></label>
    <label>PUBLIC DESCRIPTION<input name="description" maxlength="300" value="${esc(game.description)}"></label>
    <label>CAPACITY<input name="capacity" type="number" min="1" step="1" required value="${game.capacity}"></label>
    <label>PLAYERS / MATCH<input name="players_per_match" type="number" min="1" step="1" required value="${game.players_per_match}"></label>
    <label class="toggle-label"><input name="is_open" type="checkbox" ${game.is_open ? 'checked' : ''}> Registration open</label>
    <button class="neon-button">SAVE GAME</button>
  </form>`).join('');
  $$('.admin-game').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    values.capacity = Number(values.capacity);
    values.players_per_match = Number(values.players_per_match);
    values.is_open = form.elements.is_open.checked;
    const button = $('.neon-button', form); button.disabled = true;
    try {
      await api(`/api/admin/games/${form.dataset.id}`, { method: 'PUT', body: JSON.stringify(values) });
      toast(`${values.name} saved.`);
      await loadData();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  }));
}

async function loadRoster() {
  const gameId = $('#match-game').value;
  const game = state.games.find(item => String(item.id) === String(gameId));
  $('#player-limit').textContent = game ? `${game.players_per_match} PLAYER LIMIT` : 'SELECT A GAME';
  $('#roster-hint').textContent = game ? `Select up to ${game.players_per_match} registered player${game.players_per_match === 1 ? '' : 's'}.` : 'Choose a game to load its active registrations.';
  $('#registered-roster').innerHTML = '<p class="empty-state">Loading roster…</p>';
  try {
    const roster = await api(`/api/admin/roster/${gameId}`);
    $('#registered-roster').innerHTML = roster.length ? roster.map(player => `<label class="roster-player"><input type="checkbox" value="${player.id}"><span>${esc(player.full_name)}<small> · ${esc(player.department)}</small></span></label>`).join('') : '<p class="empty-state">No active registrations for this game yet.</p>';
    $$('#registered-roster input').forEach(input => input.addEventListener('change', () => {
      const max = Number(game.players_per_match);
      const checked = $$('#registered-roster input:checked');
      if (checked.length > max) { input.checked = false; toast(`This game allows ${max} player${max === 1 ? '' : 's'} per match.`, true); }
      $('#selected-count').textContent = `${$$('#registered-roster input:checked').length} selected`;
    }));
    $('#selected-count').textContent = '0 selected';
  } catch (error) {
    $('#registered-roster').innerHTML = `<p class="empty-state">${esc(error.message)}</p>`;
  }
}

function renderMatchForm() {
  const form = $('#match-form');
  $('#match-game').innerHTML = state.games.map(game => `<option value="${game.id}">${esc(game.name)}</option>`).join('');
  $('#match-game').onchange = loadRoster;
  loadRoster();
  form.onsubmit = async event => {
    event.preventDefault();
    const selected = $$('#registered-roster input:checked').map(input => Number(input.value));
    if (!selected.length) return toast('Assign at least one registered player to this match.', true);
    const values = Object.fromEntries(new FormData(form));
    values.game_id = Number(values.game_id);
    values.duration_minutes = Number(values.duration_minutes);
    values.student_ids = selected;
    values.starts_at = new Date(values.starts_at).toISOString();
    const button = $('.neon-button', form); button.disabled = true;
    $('#overlap-note').hidden = true;
    try {
      const result = await api('/api/admin/matches', { method: 'POST', body: JSON.stringify(values) });
      if (result.overlaps) {
        $('#overlap-note').hidden = false;
        $('#overlap-note').textContent = `Schedule notice: this time overlaps ${result.overlaps} other match${result.overlaps === 1 ? '' : 'es'}. The matches are saved; the event team can coordinate the shared room.`;
      } else toast('Match created and players assigned.');
      form.elements.label.value = '';
      form.elements.starts_at.value = '';
      form.elements.duration_minutes.value = '';
      await loadData();
      await loadRoster();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  };
}

function localInputDate(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}

function renderMatches() {
  const all = activeMatchFilter === 'All' ? state.matches : state.matches.filter(match => match.status === activeMatchFilter);
  $('#matches').innerHTML = all.length ? all.map(match => {
    const details = `${new Date(match.starts_at).toLocaleString()}${match.status === 'Live' ? ` · Ends ${new Date(match.ends_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : ''}`;
    const actions = match.status === 'Upcoming'
      ? `<button class="small-action" data-edit="${match.id}">Edit</button><button class="small-action danger" data-delete="${match.id}">Delete</button><button class="small-action primary" data-start="${match.id}">Start match</button>`
      : match.status === 'Live'
        ? `<span class="live-clock" data-ends="${esc(match.ends_at)}"></span><button class="small-action primary" data-end="${match.id}">End match</button>`
        : `<button class="small-action" data-result="${match.id}">${match.winner_id ? 'Edit result' : 'Enter result'}</button>`;
    return `<article class="match-card"><time class="match-date">${new Date(match.starts_at).toLocaleDateString([], {month:'short',day:'numeric'})}<br>${new Date(match.starts_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time><div class="match-main"><b>${esc(match.label)}</b><small>${details}</small></div><span class="status-pill ${match.status.toLowerCase()}">${esc(match.status.toUpperCase())}</span><div class="match-actions">${actions}</div></article>`;
  }).join('') : '<p class="empty-state">No matches in this view yet.</p>';
  $$('[data-match-filter]').forEach(button => button.classList.toggle('active', button.dataset.matchFilter === activeMatchFilter));
  $$('[data-match-filter]').forEach(button => button.onclick = () => { activeMatchFilter = button.dataset.matchFilter; renderMatches(); });
  $$('[data-start]').forEach(button => button.onclick = () => matchAction(`/api/admin/matches/${button.dataset.start}/start`, 'Match is live.'));
  $$('[data-end]').forEach(button => button.onclick = () => matchAction(`/api/admin/matches/${button.dataset.end}/end`, 'Match completed.'));
  $$('[data-delete]').forEach(button => button.onclick = async () => {
    if (!confirm('Delete this upcoming match? Its player assignments will also be removed.')) return;
    await matchAction(`/api/admin/matches/${button.dataset.delete}`, 'Upcoming match deleted.', 'DELETE');
  });
  $$('[data-edit]').forEach(button => button.onclick = () => editMatch(state.matches.find(match => String(match.id) === button.dataset.edit)));
  $$('[data-result]').forEach(button => button.onclick = () => editResult(state.matches.find(match => String(match.id) === button.dataset.result)));
  tickLiveClocks();
}

async function matchAction(url, message, method = 'POST') {
  try { await api(url, { method }); toast(message); await loadData(); }
  catch (error) { toast(error.message, true); }
}

function tickLiveClocks() {
  $$('[data-ends]').forEach(node => {
    const remaining = Math.max(0, new Date(node.dataset.ends) - Date.now());
    const seconds = Math.floor(remaining / 1000);
    node.textContent = remaining ? `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} remaining` : 'Timer ended · updating status';
  });
}
setInterval(tickLiveClocks, 1000);

function showDialog(markup) {
  $('#match-dialog-content').innerHTML = markup;
  $('#match-dialog').showModal();
}
$$('[data-close]').forEach(button => button.addEventListener('click', () => $('#match-dialog').close()));
$('#match-dialog').addEventListener('click', event => { if (event.target === $('#match-dialog')) $('#match-dialog').close(); });

function editMatch(match) {
  showDialog(`<p class="eyebrow">EDIT UPCOMING MATCH</p><h2>Update match details</h2><form id="edit-match-form" class="dialog-form"><label>GAME<input value="${esc(match.game)}" disabled></label><label>MATCH LABEL<input name="label" maxlength="80" required value="${esc(match.label)}"></label><label>START TIME<input name="starts_at" type="datetime-local" required value="${localInputDate(match.starts_at)}"></label><label>DURATION (MINUTES)<input name="duration_minutes" type="number" min="1" max="1440" required value="${match.duration_minutes}"></label><div class="form-actions"><span>Player assignments stay with this match.</span><button class="neon-button">SAVE CHANGES</button></div></form>`);
  $('#edit-match-form').onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.game_id = match.game_id;
    values.duration_minutes = Number(values.duration_minutes);
    values.starts_at = new Date(values.starts_at).toISOString();
    try { await api(`/api/admin/matches/${match.id}`, { method: 'PUT', body: JSON.stringify(values) }); $('#match-dialog').close(); toast('Match schedule updated.'); await loadData(); }
    catch (error) { toast(error.message, true); }
  };
}

async function editResult(match) {
  try {
    const players = await api(`/api/admin/matches/${match.id}/players`);
    if (!players.length) return toast('This match has no assigned players, so a winner cannot be recorded.', true);
    showDialog(`<p class="eyebrow">FINAL SCORE</p><h2>${match.winner_id ? 'Correct match result' : 'Record the winner'}</h2><form id="result-form" class="dialog-form"><label>WINNER<select name="winner_id" required>${players.map(player => `<option value="${player.id}" ${String(player.id)===String(match.winner_id)?'selected':''}>${esc(player.full_name)}</option>`).join('')}</select></label><div class="score-fields"><p class="eyebrow">OPTIONAL PLAYER SCORES</p>${players.map(player => `<label class="score-row"><span>${esc(player.full_name)}</span><input type="text" maxlength="40" data-score="${player.id}" value="${esc(player.score || '')}" placeholder="Score"></label>`).join('')}</div><div class="form-actions"><span>The winner must be one of this match’s players.</span><button class="neon-button">SAVE RESULT</button></div></form>`);
    $('#result-form').onsubmit = async event => {
      event.preventDefault();
      const scores = Object.fromEntries($$('[data-score]', event.currentTarget).map(input => [input.dataset.score, input.value]));
      try { await api(`/api/admin/matches/${match.id}/result`, { method: 'PUT', body: JSON.stringify({ winner_id: Number(event.currentTarget.elements.winner_id.value), scores }) }); $('#match-dialog').close(); toast('Winner and scores saved.'); await loadData(); }
      catch (error) { toast(error.message, true); }
    };
  } catch (error) { toast(error.message, true); }
}

function renderRegistrations() {
  const rows = state.students;
  $('#filter-game').innerHTML = '<option value="">All games</option>' + state.games.map(game => `<option>${esc(game.name)}</option>`).join('');
  $('#filter-dept').innerHTML = '<option value="">All departments</option>' + [...new Set(rows.map(row => row.department))].sort().map(dept => `<option>${esc(dept)}</option>`).join('');
  const draw = () => {
    const query = $('#search').value.trim().toLowerCase();
    const game = $('#filter-game').value;
    const dept = $('#filter-dept').value;
    const filtered = rows.filter(row => (!game || row.game === game) && (!dept || row.department === dept) && JSON.stringify(row).toLowerCase().includes(query));
    $('#registrations').innerHTML = filtered.length ? `<table><thead><tr><th>STUDENT</th><th>PHONE</th><th>EMAIL</th><th>DEPARTMENT</th><th>GAME</th><th>STATUS</th></tr></thead><tbody>${filtered.map(row => `<tr><td class="reg-name">${esc(row.full_name)}</td><td>${esc(row.phone)}</td><td>${esc(row.email)}</td><td>${esc(row.department)}</td><td>${esc(row.game)}</td><td><span class="reg-status">${esc(row.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">No registrations match these filters.</p>';
  };
  ['search','filter-game','filter-dept'].forEach(id => { $('#'+id).oninput = draw; $('#'+id).onchange = draw; });
  draw();
}

function renderAdmins() {
  $('#admin-count').textContent = `${state.admins.length} ACCOUNT${state.admins.length===1?'':'S'}`;
  $('#admins').innerHTML = state.admins.map(admin => `<div class="admin-row"><div><b>${esc(admin.username)}</b><small>${String(admin.id)===String(state.me) ? 'Current session' : 'Event administrator'}</small></div>${String(admin.id)===String(state.me) ? '<span class="self-tag">YOU</span>' : `<button class="small-action danger" data-remove-admin="${admin.id}">Remove</button>`}</div>`).join('');
  $$('[data-remove-admin]').forEach(button => button.onclick = async () => {
    if (!confirm('Remove this administrator account?')) return;
    try { await api(`/api/admin/admins/${button.dataset.removeAdmin}`, { method: 'DELETE' }); toast('Admin account removed.'); await loadData(); }
    catch (error) { toast(error.message, true); }
  });
  const form = $('#add-admin');
  form.onsubmit = async event => {
    event.preventDefault();
    const button = $('.neon-button', form); button.disabled = true;
    try { await api('/api/admin/admins', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); toast('Admin account added.'); await loadData(); }
    catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  };
}

async function loadData() {
  try {
    state = await api('/api/admin/data');
    openApp(state.admins.find(admin => String(admin.id) === String(state.me))?.username);
    renderOverview(); renderSettings(); renderGames(); renderMatchForm(); renderMatches(); renderRegistrations(); renderAdmins();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      $('#admin-app').hidden = true;
      $('#admin-login-shell').hidden = false;
      return;
    }
    toast(error.message, true);
  }
}

$('#csv').addEventListener('click', () => { window.location.href = '/api/admin/export.csv'; });
$('#admin-logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); csrfToken = ''; location.reload(); }
  catch (error) { toast(error.message, true); }
});

loadData();
