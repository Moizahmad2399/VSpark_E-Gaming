import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const { Pool } = require('pg');
const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
const db = new Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres', max: 1 });
const prefix = `VERIFY-${Date.now()}`;
const email1 = `${prefix.toLowerCase()}-1@example.test`;
const email2 = `${prefix.toLowerCase()}-2@example.test`;
const password = 'LocalVerifyPass123!';
const studentIds = [];
const sessions = [];
const testGameIds = [];
const check = (condition, message) => { if (!condition) throw new Error(message); };

async function session() {
  const response = await fetch(`${base}/api/csrf`);
  const body = await response.json();
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  check(response.ok && cookie, 'Could not create a local session.');
  return { token: body.csrfToken, cookie };
}
async function request(s, path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Cookie: s.cookie, 'CSRF-Token': s.token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}
async function signup(index, email) {
  const s = await session(); sessions.push(s);
  const digits = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const phone = `0301${digits.slice(-7)}`;
  const cnicDigits = `9${digits.padStart(12, '0').slice(-12)}`;
  const cnic = `${cnicDigits.slice(0,5)}-${cnicDigits.slice(5,12)}-${cnicDigits.slice(12)}`;
  const result = await request(s, '/api/signup', 'POST', {
    full_name: `Local Verification ${index}`, phone, email, cnic,
    department: 'Computer Science', password
  });
  check(result.status === 200, `Signup ${index} failed: ${result.body.error}`);
  const found = await db.query('SELECT id FROM students WHERE email=$1', [email]);
  studentIds.push(found.rows[0].id);
  const profile = await request(s, '/api/me');
  check(profile.status === 200 && profile.body.profile?.email === email, 'Signed-in student profile did not load.');
  return s;
}

try {
  const data = await (await fetch(`${base}/api/public`)).json();
  check(data.games?.length === 3 && data.settings?.university_name, 'Public event data did not load.');
  const denied = await (await fetch(`${base}/api/admin/data`)).status;
  check(denied === 403, 'Admin route was not protected.');

  const [s1, s2] = await Promise.all([signup(1, email1), signup(2, email2)]);
  const admin = await session(); sessions.push(admin);
  const login = await request(admin, '/admin/login', 'POST', {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD
  });
  check(login.status === 200, `Local admin login failed: ${login.body.error}`);
  const adminData = await request(admin, '/api/admin/data');
  check(adminData.status === 200, 'Admin dashboard data did not load.');
  const originalSettings = adminData.body.settings;
  const settingsSave = await request(admin, '/api/admin/settings', 'PUT', {
    event_date: String(originalSettings.event_date).slice(0, 10), venue: `${originalSettings.venue} `,
    university_name: originalSettings.university_name
  });
  check(settingsSave.status === 200, 'Event settings could not be saved.');
  await request(admin, '/api/admin/settings', 'PUT', {
    event_date: String(originalSettings.event_date).slice(0, 10), venue: originalSettings.venue,
    university_name: originalSettings.university_name
  });

  for (const [slug, name] of [[`${prefix}-tekken`.toLowerCase(), 'Verify Tekken'], [`${prefix}-fifa`.toLowerCase(), 'Verify FIFA'], [`${prefix}-pubg`.toLowerCase(), 'Verify PUBG']]) {
    const created = await db.query('INSERT INTO games(slug,name,description,capacity,players_per_match) VALUES($1,$2,$3,1,1) RETURNING id', [slug, name, 'Temporary verification game']);
    testGameIds.push(created.rows[0].id);
  }

  const tekken = data.games.find(g => g.slug === 'tekken-3');
  const fifa = data.games.find(g => g.slug === 'fifa');
  const pubg = data.games.find(g => g.slug === 'pubg-mobile');
  const originalGame = adminData.body.games.find(g => g.id === tekken.id);
  const gameSave = await request(admin, `/api/admin/games/${tekken.id}`, 'PUT', {
    name: originalGame.name, description: `${originalGame.description} `, capacity: originalGame.capacity,
    players_per_match: originalGame.players_per_match, is_open: originalGame.is_open
  });
  check(gameSave.status === 200, 'Game settings could not be saved.');
  await request(admin, `/api/admin/games/${tekken.id}`, 'PUT', originalGame);
  const [raceGameId, secondGameId, cancelGameId] = testGameIds;
  const race = await Promise.all([
    request(s1, `/api/register/${raceGameId}`, 'POST', {}),
    request(s2, `/api/register/${raceGameId}`, 'POST', {})
  ]);
  check(race.filter(r => r.status === 200).length === 1, `Parallel registration did not admit exactly one player: ${JSON.stringify(race)}`);
  check(race.filter(r => r.status === 400 || r.status === 409).length === 1, 'Parallel capacity rejection was not returned.');
  await request(s1, `/api/register/${secondGameId}`, 'POST', {});

  const adminId = adminData.body.me;
  const student = await db.query('SELECT id FROM students WHERE email=$1', [email1]);
  const playerId = student.rows[0].id;
  const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const secondStart = new Date(+start + 20 * 60 * 1000);
  const firstMatch = await request(admin, '/api/admin/matches', 'POST', {
    game_id: raceGameId, label: `${prefix}-A`, starts_at: start.toISOString(), duration_minutes: 60, student_ids: [playerId]
  });
  check(firstMatch.status === 200, `Could not create first test match: ${firstMatch.body.error}`);
  const secondMatch = await request(admin, '/api/admin/matches', 'POST', {
    game_id: secondGameId, label: `${prefix}-B`, starts_at: secondStart.toISOString(), duration_minutes: 60, student_ids: [playerId]
  });
  check(secondMatch.status === 400 && /overlapping/i.test(secondMatch.body.error), 'Overlapping match assignment was not rejected.');
  const roster = await request(admin, `/api/admin/roster/${raceGameId}`);
  check(roster.status === 200 && roster.body.some(player => Number(player.id) === Number(playerId)), 'Registered-player roster did not load.');
  const matchId = firstMatch.body.id;
  const edit = await request(admin, `/api/admin/matches/${matchId}`, 'PUT', {
    game_id: raceGameId, label: `${prefix}-A-EDITED`, starts_at: new Date(+start + 5 * 60000).toISOString(), duration_minutes: 60
  });
  check(edit.status === 200, `Upcoming match could not be edited: ${edit.body.error}`);
  const startMatch = await request(admin, `/api/admin/matches/${matchId}/start`, 'POST', {});
  check(startMatch.status === 200, 'Match could not be started.');
  const endMatch = await request(admin, `/api/admin/matches/${matchId}/end`, 'POST', {});
  check(endMatch.status === 200, 'Live match could not be ended.');
  const resultSave = await request(admin, `/api/admin/matches/${matchId}/result`, 'PUT', { winner_id: playerId, scores: { [playerId]: '3' } });
  check(resultSave.status === 200, 'Completed match result could not be saved.');
  const players = await request(admin, `/api/admin/matches/${matchId}/players`);
  check(players.status === 200 && String(players.body[0]?.score) === '3', 'Player score did not persist.');
  const correction = await request(admin, `/api/admin/matches/${matchId}/result`, 'PUT', { winner_id: playerId, scores: {} });
  check(correction.status === 200, 'Completed match result could not be corrected.');

  const pendingMatch = await request(admin, '/api/admin/matches', 'POST', {
    game_id: raceGameId, label: `${prefix}-DELETE`, starts_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), duration_minutes: 30, student_ids: [playerId]
  });
  check(pendingMatch.status === 200, 'Could not create upcoming match for delete check.');
  const deletion = await request(admin, `/api/admin/matches/${pendingMatch.body.id}`, 'DELETE');
  check(deletion.status === 200, 'Upcoming match could not be deleted.');

  const pubgRegistration = await request(s2, `/api/register/${cancelGameId}`, 'POST', {});
  check(pubgRegistration.status === 200, 'Student registration did not persist for cancellation check.');
  const cancelStudent = await db.query('SELECT id FROM students WHERE email=$1', [email2]);
  const reg = await db.query("SELECT id FROM registrations WHERE student_id=$1 AND game_id=$2", [cancelStudent.rows[0].id, cancelGameId]);
  const cancellation = await request(s2, `/api/registration/${reg.rows[0].id}`, 'DELETE');
  check(cancellation.status === 200, 'Upcoming registration could not be cancelled.');
  const cancelled = await db.query('SELECT status FROM registrations WHERE id=$1', [reg.rows[0].id]);
  check(cancelled.rows[0].status === 'Cancelled', 'Registration cancellation did not persist.');

  const csvResponse = await fetch(`${base}/api/admin/export.csv`, { headers: { Cookie: admin.cookie } });
  check(csvResponse.status === 200 && (await csvResponse.text()).startsWith('Name,Phone,Email'), 'Registration CSV export failed.');
  const newAdmin = await request(admin, '/api/admin/admins', 'POST', { username: `${prefix}-admin`, password: 'TemporaryAdmin123!' });
  check(newAdmin.status === 200, 'Admin account could not be added.');
  const added = await db.query('SELECT id FROM admins WHERE username=$1', [`${prefix}-admin`]);
  const removeAdmin = await request(admin, `/api/admin/admins/${added.rows[0].id}`, 'DELETE');
  check(removeAdmin.status === 200, 'Additional admin account could not be removed.');
  check(adminId, 'Admin session did not have an ID.');
  console.log('Local verification passed: public data, signup, admin access, parallel capacity, overlap rejection, settings/game saves, match lifecycle/results, cancellation, CSV, and admin management.');
} finally {
  if (studentIds.length) {
    await db.query('DELETE FROM matches WHERE label LIKE $1', [`${prefix}%`]);
    await db.query('DELETE FROM students WHERE id=ANY($1::bigint[])', [studentIds]);
  }
  if (testGameIds.length) {
    await db.query('DELETE FROM registrations WHERE game_id=ANY($1::bigint[])', [testGameIds]);
    await db.query('DELETE FROM games WHERE id=ANY($1::bigint[])', [testGameIds]);
  }
  await db.end();
}
