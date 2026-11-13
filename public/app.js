const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

let csrfToken = '';
let authMode = 'login';
let pendingGameId = null;
let lastGamesMarkup = '';
let lastScheduleMarkup = '';
let lastWinnersMarkup = '';
const authDialog = $('#auth-dialog');
const navActions = $('.site-nav > div');
const profileNavButton = document.createElement('button');
profileNavButton.className = 'outline';
profileNavButton.id = 'profile-nav-button';
profileNavButton.textContent = 'MY PROFILE';
profileNavButton.hidden = true;
navActions.insertBefore(profileNavButton, $('.admin-link', navActions));

const dashboardTitle = $('#dashboard-dialog h2');
dashboardTitle.textContent = 'MY PROFILE';
const profileSummary = document.createElement('div');
profileSummary.id = 'profile-summary';
profileSummary.className = 'profile-summary';
dashboardTitle.insertAdjacentElement('afterend', profileSummary);
const registrationsHeading = document.createElement('p');
registrationsHeading.className = 'eyebrow registrations-heading';
registrationsHeading.textContent = 'MY REGISTRATIONS';
$('#my-registrations').before(registrationsHeading);

function setStudentNavigation(signedIn) {
  document.querySelectorAll('.site-nav > div [data-open]').forEach(button => { button.hidden = signedIn; });
  profileNavButton.hidden = !signedIn;
}

async function api(url, options = {}) {
  if (!csrfToken) {
    const response = await fetch('/api/csrf', { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not start a secure session.');
    csrfToken = data.csrfToken;
  }
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken, ...options.headers }
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  setTimeout(() => node.classList.remove('show'), 3200);
}

function formatCnic(input) {
  const digits = input.value.replace(/\D/g, '').slice(0, 13);
  let formatted = digits.slice(0, 5);
  if (digits.length > 5) formatted += `-${digits.slice(5, 12)}`;
  if (digits.length > 12) formatted += `-${digits.slice(12, 13)}`;
  input.value = formatted;
}

function renderAuthFields() {
  const fields = $('#auth-fields');
  $('#auth-title').textContent = authMode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR PLAYER PROFILE';
  $('#form-msg').textContent = '';
  if (authMode === 'login') {
    fields.innerHTML = '<div class="field"><label>PHONE OR EMAIL</label><input name="identity" required autocomplete="username"></div><div class="field"><label>PASSWORD</label><input name="password" type="password" required autocomplete="current-password"></div>';
  } else {
    fields.innerHTML = `<div class="field"><label>FULL NAME</label><input name="full_name" required autocomplete="name"></div>
      <div class="field"><label>PHONE</label><input name="phone" required inputmode="numeric" placeholder="03XX-XXXXXXX" autocomplete="tel"></div>
      <div class="field"><label>EMAIL</label><input name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label>CNIC</label><input name="cnic" required inputmode="numeric" maxlength="15" pattern="[0-9]{5}-[0-9]{7}-[0-9]{1}" placeholder="XXXXX-XXXXXXX-X" autocomplete="off"></div>
      <div class="field"><label>DEPARTMENT</label><select name="department" required>${['Computer Science','Software Engineering','Artificial Intelligence','Data Science','Electrical Engineering','Mechanical Engineering','Civil Engineering','BBA','BS Accounting & Finance','BS Economics','BS English','BS Psychology','BS Mathematics','BS Physics','BS Chemistry','Other'].map(value => `<option>${esc(value)}</option>`).join('')}</select></div>
      <div class="field"><label>PASSWORD (8+ CHARACTERS)</label><input name="password" type="password" minlength="8" required autocomplete="new-password"></div>`;
    $('[name="cnic"]', fields).addEventListener('input', event => formatCnic(event.currentTarget));
  }
  document.querySelectorAll('.auth-switch button').forEach(button => button.classList.toggle('selected', button.dataset.mode === authMode));
}

function openAuth(mode = 'login') {
  authMode = mode;
  renderAuthFields();
  if (!authDialog.open) authDialog.showModal();
}

profileNavButton.addEventListener('click', () => loadMe());

document.querySelectorAll('[data-open]').forEach(button => {
  button.addEventListener('click', () => openAuth(button.dataset.open));
});
document.querySelectorAll('[data-mode]').forEach(button => {
  button.addEventListener('click', () => {
    authMode = button.dataset.mode;
    renderAuthFields();
  });
});
document.querySelectorAll('dialog .close').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

async function finishAuthentication() {
  authDialog.close();
  setStudentNavigation(true);
  const gameId = pendingGameId;
  pendingGameId = null;
  if (gameId) {
    try {
      await api(`/api/register/${gameId}`, { method: 'POST', body: '{}' });
      toast('Account ready — your game registration is confirmed.');
    } catch (error) {
      toast(`Account ready, but registration failed: ${error.message}`);
    }
    await load();
    await loadMe();
    return;
  }
  toast('Welcome to the arena.');
  await loadMe();
}

$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const submit = $('.auth-submit', form);
  submit.disabled = true;
  try {
    await api(authMode === 'signup' ? '/api/signup' : '/api/login', {
      method: 'POST', body: JSON.stringify(data)
    });
    await finishAuthentication();
  } catch (error) {
    $('#form-msg').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

async function loadMe() {
  try {
    const player = await api('/api/me');
    setStudentNavigation(true);
    const profile = player.profile || { full_name: player.name };
    const initials=String(profile.full_name||'Player').split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
    profileSummary.innerHTML = `<div class="profile-identity">${profile.has_avatar?'<img class="profile-avatar" src="/api/me/avatar" alt="Profile photo">':`<span class="profile-avatar avatar-placeholder">${esc(initials)}</span>`}<label class="avatar-upload">CHANGE PHOTO<input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP · up to 2 MB</small></label></div><div><small>FULL NAME</small><b>${esc(profile.full_name)}</b></div><div><small>PHONE</small><b>${esc(profile.phone)}</b></div><div><small>EMAIL</small><b>${esc(profile.email)}</b></div><div><small>DEPARTMENT</small><b>${esc(profile.department)}</b></div>`;
    $('#avatar-file').addEventListener('change', async event=>{const file=event.currentTarget.files[0];if(!file)return;if(file.size>2*1024*1024){toast('Photo must be 2 MB or smaller.');return}try{await api('/api/me/avatar',{method:'PUT',body:file,headers:{'Content-Type':file.type}});toast('Profile photo saved.');await loadMe()}catch(error){toast(error.message)}});
    const registrations = $('#my-registrations');
    registrations.innerHTML = player.registrations.length
      ? player.registrations.map(registration => `<div class="registration-row"><span><b>${esc(registration.game)}</b><br><small>${esc(registration.status)} · ${registration.starts_at ? new Date(registration.starts_at).toLocaleString() : 'Match time pending'}${registration.result ? ` · ${esc(registration.result)}` : ''}</small></span>${registration.status === 'Registered' && registration.match_status !== 'Live' ? `<button data-cancel="${registration.id}">CANCEL</button>` : ''}</div>`).join('')
      : '<p>No registrations yet. Choose a game to claim a spot.</p><button class="primary" data-browse-games>BROWSE GAMES ↗</button>';
    $('#dashboard-dialog').showModal();
    const browseGames = $('[data-browse-games]', registrations);
    if (browseGames) browseGames.addEventListener('click', () => {
      $('#dashboard-dialog').close();
      if ($('#gate')) $('#enter').click();
      $('#games').scrollIntoView({ behavior: 'smooth' });
    });
    document.querySelectorAll('[data-cancel]').forEach(button => {
      button.addEventListener('click', async () => {
        try {
          await api(`/api/registration/${button.dataset.cancel}`, { method: 'DELETE' });
          await load();
          await loadMe();
        } catch (error) { toast(error.message); }
      });
    });
  } catch {
    setStudentNavigation(false);
    openAuth('login');
  }
}

$('#logout').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
    $('#dashboard-dialog').close();
    setStudentNavigation(false);
    csrfToken = '';
    toast('Signed out.');
  } catch (error) { toast(error.message); }
});

async function load() {
  try {
    const data = await api('/api/public');
    let layoutChanged = false;
    if (data.settings) {
      $('#event-date').textContent = new Date(`${data.settings.event_date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
      $('#event-location').textContent = `${data.settings.university_name} · ${data.settings.venue}`;
      $('#footer-university').textContent = data.settings.university_name.toUpperCase();
    }
    const gamesMarkup = data.games.map((game, index) => `<article class="game-card" data-game-id="${game.id}"><img class="game-bg" src="${esc(game.image_path)}" alt="${esc(game.name)} artwork" loading="lazy" decoding="async"><span class="spots"></span><p class="eyebrow">0${index + 1} / ARENA</p><h3>${esc(game.name)}</h3><p>${esc(game.description)}</p><button data-register="${game.id}"><span>↗</span></button></article>`).join('');
    const gameStructure = JSON.stringify(data.games.map(({ id, name, description, image_path }) => ({ id, name, description, image_path })));
    if (gameStructure !== lastGamesMarkup) {
      $('#game-list').innerHTML = gamesMarkup;
      lastGamesMarkup = gameStructure;
      layoutChanged = true;
      document.querySelectorAll('[data-register]').forEach(button => {
        button.addEventListener('click', async () => {
          const gameId = button.dataset.register;
          try {
            await api(`/api/register/${gameId}`, { method: 'POST', body: '{}' });
            toast('Registration confirmed.');
            await load();
            await loadMe();
          } catch (error) {
            if (error.status === 401) {
              pendingGameId = gameId;
              openAuth('login');
            } else {
              toast(error.message);
            }
          }
        });
      });
    }
    data.games.forEach(game => {
      const card = [...document.querySelectorAll('[data-game-id]')].find(node => node.dataset.gameId === String(game.id));
      if (!card) return;
      const spots = Number(game.spots_left);
      $('.spots', card).textContent = `${spots} SPOTS LEFT`;
      const button = $('[data-register]', card);
      button.disabled = !game.is_open || spots <= 0;
      button.innerHTML = `${!game.is_open ? 'REGISTRATION CLOSED' : spots <= 0 ? 'GAME FULL' : 'REGISTER NOW'} <span>↗</span>`;
    });

    const scheduleMarkup = data.matches.length
      ? data.matches.map(match => `<div class="schedule-row"><small>${new Date(match.starts_at).toLocaleString()}</small><b>${esc(match.game)} · ${esc(match.label)}</b><span class="badge ${match.status.toLowerCase()}">${esc(match.status.toUpperCase())}</span><small ${match.status === 'Live' ? `data-countdown="${esc(match.ends_at)}"` : ''}></small></div>`).join('')
      : '<p class="empty">Match times will appear here once announced.</p>';
    if (scheduleMarkup !== lastScheduleMarkup) {
      $('#schedule-list').innerHTML = scheduleMarkup;
      lastScheduleMarkup = scheduleMarkup;
      layoutChanged = true;
    }
    updateScheduleCountdowns();
    const winnersMarkup = data.winners.length
      ? data.winners.map(winner => `<article class="winner-card">${winner.has_avatar?`<img class="winner-avatar" src="/api/winners/${Number(winner.winner_id)}/avatar" alt="${esc(winner.winner)}" loading="lazy">`:'<span class="winner-avatar avatar-placeholder">✦</span>'}<small>${esc(winner.game).toUpperCase()}</small><h3>${esc(winner.winner)}</h3><p>V SPARK CHAMPION ✦</p></article>`).join('')
      : '<div class="winner-placeholder">WINNERS WILL BE CROWNED HERE <span>✦</span></div>';
    if (winnersMarkup !== lastWinnersMarkup) {
      $('#winner-list').innerHTML = winnersMarkup;
      lastWinnersMarkup = winnersMarkup;
      layoutChanged = true;
    }
    if (layoutChanged && window.gsap && window.ScrollTrigger) {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.utils.toArray('.game-card').forEach(card => {
          if (card.dataset.parallaxReady) return;
          card.dataset.parallaxReady = 'true';
          gsap.to($('.game-bg', card), { yPercent: -7, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: .6 } });
        });
      }
      const images = [...document.querySelectorAll('.game-bg')];
      Promise.allSettled(images.map(image => image.decode ? image.decode() : Promise.resolve())).then(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
    }
  } catch (error) {
    const notice = $('#db-notice');
    notice.hidden = false;
    notice.textContent = error.message.includes('Database not configured') ? error.message : 'Event data is unavailable. Check the database settings.';
    console.warn(error);
  }
}

function updateScheduleCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach(node => {
    const remaining = Math.max(0, new Date(node.dataset.countdown) - Date.now());
    node.textContent = remaining ? `${Math.ceil(remaining / 60000)} min left` : 'Timer ended';
  });
}

$('#enter').addEventListener('click', () => {
  document.body.classList.add('entered');
  document.body.classList.remove('gate-active');
  $('#gate').classList.add('leave');
  setTimeout(() => $('#gate').remove(), 750);
});
let startY = 0;
document.body.classList.add('gate-active');
$('#gate').addEventListener('click', event => { if (!event.target.closest('a, button')) $('#enter').click(); });
$('#gate').addEventListener('touchstart', event => { startY = event.touches[0].clientY; }, { passive: true });
$('#gate').addEventListener('touchend', event => {
  if (startY - event.changedTouches[0].clientY > 35) $('#enter').click();
}, { passive: true });
window.addEventListener('keydown', event => {
  if (['Enter', ' ', 'ArrowDown'].includes(event.key) && $('#gate')) { event.preventDefault(); $('#enter').click(); }
});
window.addEventListener('wheel', event => {
  if ($('#gate') && !document.body.classList.contains('entered')) {
    if (event.deltaY > 0) $('#enter').click();
    event.preventDefault();
  }
}, { passive: false });
window.addEventListener('scroll', () => {
  if (!window.gsap) return;
  const dots = document.querySelectorAll('.progress-dots a');
  const sections = [...document.querySelectorAll('.chapter')];
  const index = sections.findIndex(section => section.getBoundingClientRect().top < innerHeight * .45 && section.getBoundingClientRect().bottom > innerHeight * .45);
  dots.forEach((dot, i) => dot.classList.toggle('active', i === Math.min(dots.length - 1, Math.max(0, index))));
});

window.addEventListener('load', () => {
  let progress = 0;
  const timer = setInterval(() => {
    progress = Math.min(100, progress + 7);
    $('#loadbar').style.width = `${progress}%`;
    if (progress >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        const preloader = $('#preloader');
        preloader.style.opacity = 0;
        setTimeout(() => preloader.remove(), 500);
      }, 100);
    }
  }, 35);
  if (window.gsap && window.ScrollTrigger && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.chapter').forEach(section => gsap.from(section.querySelectorAll('h2'), {
      y: 26, opacity: .72, duration: .7, stagger: .07, ease: 'power2.out', immediateRender: false,
      scrollTrigger: { trigger: section, start: 'top 82%', once: true }
    }));
    gsap.fromTo('.step-line i', { scaleX: 0 }, { scaleX: 1, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 55%', scrub: true } });
    const nav = $('.site-nav');
    let lastScrollY = 0, navFrame = false;
    window.addEventListener('scroll', () => {
      if (navFrame) return;
      navFrame = true;
      requestAnimationFrame(() => {
        const currentY = scrollY;
        nav.classList.toggle('hidden', currentY > lastScrollY && currentY > 300);
        lastScrollY = currentY;
        navFrame = false;
      });
    }, { passive: true });
  }
  load().then(() => refreshStudentNavigation());
  setInterval(load, 15000);
  setInterval(updateScheduleCountdowns, 1000);
});

async function refreshStudentNavigation() {
  try {
    await api('/api/me');
    setStudentNavigation(true);
  } catch {
    setStudentNavigation(false);
  }
}
