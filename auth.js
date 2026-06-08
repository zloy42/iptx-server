// auth.js — Xtream username/password authentication
// Multiple users supported. Configure via .env or edit this file.

const dotenv = process.env.DOTENV_LOADED ? {} : await import('dotenv');
if (!process.env.DOTENV_LOADED) {
  dotenv.config();
  process.env.DOTENV_LOADED = '1';
}

// Parse USERS from env: format "user1:pass1,user2:pass2"
const envUsers = process.env.USERS || 'admin:admin123';
const USERS = Object.fromEntries(
  envUsers.split(',').map(entry => {
    const [u, p] = entry.split(':');
    return [u.trim(), p.trim()];
  })
);

export function authenticate(username, password) {
  if (!username || !password) return false;
  return USERS[username] === password;
}

export function getUserInfo(username) {
  return {
    username,
    password: '***',
    auth: 1,
    status: 'Active',
    exp_date: '2030-01-01',
    is_trial: '0',
    active_cons: 1,
    created_at: '2025-01-01',
    max_connections: 5,
    allowed_output_formats: ['m3u8', 'ts']
  };
}

export function getServerInfo() {
  return {
    url: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`,
    port: parseInt(process.env.PORT || '3000'),
    https_port: 0,
    server_protocol: 'http',
    rtmp_port: 0,
    timezone: 'UTC',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString()
  };
}
