/**
 * SKYSERVE Restart Verification Script
 * Tests: create user, capture session cookie, restart server, verify both survive.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const COOKIE_FILE = path.join(__dirname, 'data', '_test_cookie.txt');
const BASE = { host: 'localhost', port: 8080 };

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function waitForServer(retries = 20, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await req({ ...BASE, path: '/healthz' });
      if (r.status === 200) { console.log('  Server up!'); return; }
    } catch (_) {}
    await new Promise(r => setTimeout(r, delay));
    process.stdout.write('.');
  }
  throw new Error('Server did not start in time');
}

async function main() {
  console.log('\n=== PHASE 1: Login & Create User (pre-restart) ===');

  // Login
  const loginBody = JSON.stringify({ username: 'aayush.devre', password: 'SkyServe#Aayush2026!' });
  const loginRes = await req({ ...BASE, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) } }, loginBody);
  console.log('LOGIN:', loginRes.status);
  if (loginRes.status !== 200) throw new Error('Login failed: ' + loginRes.body);

  const rawCookie = (loginRes.headers['set-cookie'] || [''])[0].split(';')[0];
  console.log('SESSION COOKIE:', rawCookie ? rawCookie.slice(0,30) + '...' : 'MISSING');

  // Clean up any previous test user
  const cleanupList = await req({ ...BASE, path: '/api/admin/users', headers: { Cookie: rawCookie } });
  const allUsers = JSON.parse(cleanupList.body).users;
  const existingTest = allUsers.find(u => u.username === 'test.operator');
  if (existingTest) {
    const delRes = await req({ ...BASE, path: `/api/admin/users/${existingTest.id}`, method: 'DELETE',
      headers: { Cookie: rawCookie } });
    console.log('Cleaned up existing test.operator:', delRes.status);
  }

  // Create test user
  const createBody = JSON.stringify({ name: 'Test Operator', username: 'test.operator', role: 'USER' });
  const createRes = await req({ ...BASE, path: '/api/admin/users', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(createBody), Cookie: rawCookie } }, createBody);
  console.log('CREATE USER:', createRes.status);
  if (createRes.status !== 201) throw new Error('Create user failed: ' + createRes.body);

  const createdUser = JSON.parse(createRes.body).user;
  console.log('Created:', createdUser.username, '| ID:', createdUser.id);

  // Verify session active
  const meRes = await req({ ...BASE, path: '/api/auth/me', headers: { Cookie: rawCookie } });
  console.log('SESSION /api/auth/me (pre-restart):', meRes.status, JSON.parse(meRes.body).username);

  // Save cookie for post-restart test
  fs.writeFileSync(COOKIE_FILE, rawCookie, 'utf8');
  console.log('Cookie saved to', COOKIE_FILE);

  // Check sessions.json was written
  const sessFile = path.join(__dirname, 'data', 'sessions.json');
  const sessData = JSON.parse(fs.readFileSync(sessFile, 'utf8'));
  const sessCount = Object.keys(sessData).length;
  console.log('sessions.json has', sessCount, 'active session(s)');
  if (sessCount === 0) throw new Error('sessions.json is empty — session not persisted!');

  console.log('\n=== PHASE 2: Restart Server ===');
  // Kill the running server
  try { execSync('powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force"'); }
  catch(_) {}
  console.log('Old server killed');
  await new Promise(r => setTimeout(r, 1000));

  // Start new server
  const child = spawn('node', ['server.js'], {
    cwd: __dirname,
    detached: true,
    stdio: 'inherit'
  });
  child.unref();
  console.log('New server spawned (PID:', child.pid, ')');

  console.log('Waiting for server to become ready…');
  await waitForServer();

  console.log('\n=== PHASE 3: Post-restart Verification ===');
  const restoredCookie = fs.readFileSync(COOKIE_FILE, 'utf8').trim();

  // Verify session survives restart
  const meRes2 = await req({ ...BASE, path: '/api/auth/me', headers: { Cookie: restoredCookie } });
  console.log('SESSION /api/auth/me (post-restart):', meRes2.status,
    meRes2.status === 200 ? JSON.parse(meRes2.body).username : meRes2.body);

  // Verify user survives restart
  const listRes2 = await req({ ...BASE, path: '/api/admin/users', headers: { Cookie: restoredCookie } });
  const users2 = JSON.parse(listRes2.body).users;
  const foundUser = users2.find(u => u.username === 'test.operator');
  console.log('USER test.operator EXISTS (post-restart):', !!foundUser);
  console.log('TOTAL USERS (post-restart):', users2.length);

  // Verify admin seed was skipped (no new admins appeared)
  const admins = users2.filter(u => u.role === 'ADMIN');
  console.log('ADMIN COUNT (should be 2):', admins.length);

  // Cleanup test cookie file
  try { fs.unlinkSync(COOKIE_FILE); } catch(_) {}

  console.log('\n=== RESULTS ===');
  const sessionOk = meRes2.status === 200;
  const userOk    = !!foundUser;
  const seedOk    = admins.length === 2;
  console.log('✓ Session persisted across restart:', sessionOk ? 'PASS' : 'FAIL');
  console.log('✓ New user persisted across restart:', userOk    ? 'PASS' : 'FAIL');
  console.log('✓ Admin seed skipped on restart:    ', seedOk    ? 'PASS' : 'FAIL');

  if (!sessionOk || !userOk || !seedOk) {
    process.exit(1);
  }
  console.log('\nAll checks PASSED ✓');
}

main().catch(err => { console.error('VERIFICATION FAILED:', err.message); process.exit(1); });
