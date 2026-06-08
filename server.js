// iptx-server — Xtream Codes API server
// Serve IPTV channels from M3U playlist via standard Xtream API

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { URL } from 'url';

dotenv.config();

import { authenticate, getUserInfo, getServerInfo } from './auth.js';
import {
  loadFromM3U,
  loadFromFile,
  fetchM3U,
  getChannels,
  getCategories,
  getChannelById,
  getChannelsByCategory,
  getEpg,
  generateM3U
} from './m3u-parser.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Global error handlers — prevent crash on unhandled rejections ──
process.on('unhandledRejection', (reason) => {
  console.error(`[FATAL] Unhandled Rejection: ${reason?.message || reason}`);
});
process.on('uncaughtException', (err) => {
  console.error(`[FATAL] Uncaught Exception: ${err.message}`);
  // Don't exit — let the server keep running
});

// ──────────────────────────────────────────
// Load M3U source
// ──────────────────────────────────────────
async function initM3U() {
  const m3uUrl = process.env.M3U_URL;
  const m3uFile = process.env.M3U_FILE;

  if (m3uUrl) {
    try {
      console.log(`[INIT] Fetching M3U from URL: ${m3uUrl}`);
      const content = await fetchM3U(m3uUrl);
      loadFromM3U(content, m3uUrl);
      console.log('[INIT] M3U loaded from URL successfully');
    } catch (err) {
      console.error(`[INIT] Failed to fetch M3U URL: ${err.message}`);
      console.log('[INIT] Starting with sample data');
      loadSampleData();
    }
  } else if (m3uFile) {
    try {
      console.log(`[INIT] Loading M3U from file: ${m3uFile}`);
      loadFromFile(m3uFile);
      console.log('[INIT] M3U loaded from file successfully');
    } catch (err) {
      console.error(`[INIT] Failed to load M3U file: ${err.message}`);
      loadSampleData();
    }
  } else {
    console.log('[INIT] No M3U source configured, loading sample data');
    loadSampleData();
  }
}

function loadSampleData() {
  const sampleM3U = `#EXTM3U
#EXTINF:-1 tvg-id="1" tvg-name="CNN" tvg-logo="https://i.imgur.com/QGQZx.png" group-title="News",CNN
http://example.com/stream/cnn.ts
#EXTINF:-1 tvg-id="2" tvg-name="BBC World" tvg-logo="https://i.imgur.com/yFZxQ.png" group-title="News",BBC World
http://example.com/stream/bbc.ts
#EXTINF:-1 tvg-id="3" tvg-name="HBO" tvg-logo="https://i.imgur.com/7E7zG.png" group-title="Movies",HBO
http://example.com/stream/hbo.ts
#EXTINF:-1 tvg-id="4" tvg-name="Nat Geo" tvg-logo="https://i.imgur.com/8B8zA.png" group-title="Documentary",Nat Geo
http://example.com/stream/natgeo.ts
#EXTINF:-1 tvg-id="5" tvg-name="Discovery" tvg-logo="https://i.imgur.com/9C9zS.png" group-title="Documentary",Discovery
http://example.com/stream/discovery.ts`;

  loadFromM3U(sampleM3U);
  console.log('[INIT] Sample data loaded');
}

// ──────────────────────────────────────────
// Auth middleware
// ──────────────────────────────────────────
function requireAuth(req, res, next) {
  const { username, password } = req.query;
  if (!authenticate(username, password)) {
    // Xtream clients expect HTTP 200 with auth:0, NOT HTTP 401
    return res.status(200).json({
      user_info: { auth: 0, username: username || '' }
    });
  }
  req.xtream_user = username;
  next();
}

// Helper: convert IDs to strings for Xtream API compat
// Only stringify specific fields, NOT auth/port/timestamps
const STRING_FIELDS = ['category_id','stream_id','series_id','parent_id','episode_num','num'];

function xtreamJson(data) {
  if (Array.isArray(data)) {
    return data.map(item => xtreamJson(item));
  }
  if (data && typeof data === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
      if (STRING_FIELDS.includes(key) && typeof val === 'number') {
        result[key] = String(val);
      } else {
        result[key] = xtreamJson(val);
      }
    }
    return result;
  }
  return data;
}

// ──────────────────────────────────────────
// Xtream API Endpoints
// ──────────────────────────────────────────

// GET /player_api.php — main endpoint
app.get('/player_api.php', requireAuth, (req, res) => {
  const { action, category_id, series_id, stream_id } = req.query;
  const user = req.xtream_user;

  // If no action, return user info + available categories
  if (!action) {
    return res.json(xtreamJson({
      user_info: getUserInfo(user),
      server_info: getServerInfo()
    }));
  }

  switch (action) {
    // ── Live TV ──
    case 'get_live_categories':
      return res.json(xtreamJson(getCategories()));

    case 'get_live_streams': {
      const channels = category_id
        ? getChannelsByCategory(category_id)
        : getChannels();
      // Return proxied URLs so headers (UA, Referrer) are sent
      const serverInfo = getServerInfo();
      const baseUrl = serverInfo.url;
      const proxied = channels.map(ch => ({
        ...ch,
        // Standard Xtream format: /live/{username}/{password}/{id}.m3u8
        stream_url: `${baseUrl}/live/${req.query.username}/${req.query.password}/${ch.stream_id}.m3u8`,
        // Also include raw URL for players that prefer direct CDN access
        raw_url: `${baseUrl}/live/raw/${ch.stream_id}?username=${req.query.username}&password=${req.query.password}`
      }));
      return res.json(xtreamJson(proxied));
    }

    case 'get_live_info': {
      if (!stream_id) return res.json({ error: 'Missing stream_id' });
      const ch = getChannelById(stream_id);
      return res.json(xtreamJson(ch || { error: 'Stream not found' }));
    }

    // ── VOD / Movies ──
    case 'get_vod_categories':
      return res.json(xtreamJson(getCategories()));

    case 'get_vod_streams': {
      const channels = category_id
        ? getChannelsByCategory(category_id)
        : getChannels();
      return res.json(xtreamJson(channels));
    }

    // ── Series ──
    case 'get_series_categories':
      return res.json(xtreamJson(getCategories()));

    case 'get_series': {
      const channels = category_id
        ? getChannelsByCategory(category_id)
        : getChannels();
      return res.json(xtreamJson(channels));
    }

    case 'get_series_info': {
      if (!series_id) return res.json({ error: 'Missing series_id' });
      const ch = getChannelById(series_id);
      return res.json(xtreamJson({
        seasons: [{ season_number: 1, episode_count: 10 }],
        episodes: {
          '1': Array.from({ length: 10 }, (_, i) => ({
            id: `${series_id}_s1e${i + 1}`,
            episode_num: i + 1,
            title: `${ch?.name || 'Episode'} ${i + 1}`,
            container_extension: 'mp4',
            info: { release_date: new Date().toISOString().split('T')[0] }
          }))
        },
        info: ch || { name: `Series ${series_id}` }
      }));
    }

    // ── EPG ──
    case 'get_short_epg': {
      if (!stream_id) return res.json([]);
      const limit = parseInt(req.query.limit) || 4;
      return res.json(xtreamJson(getEpg(stream_id, limit)));
    }

    case 'get_simple_data_table': {
      const streamId = req.query.stream_id;
      if (!streamId) return res.json({});
      return res.json(xtreamJson({
        epg_listings: getEpg(streamId, 8)
      }));
    }

    default:
      return res.json({ error: `Unknown action: ${action}` });
  }
});

// GET /get.php — M3U playlist export
app.get('/get.php', requireAuth, (req, res) => {
  const { type, output } = req.query;
  const channelList = getChannels();
  const m3u = generateM3U(channelList);

  if (type === 'm3u_plus' || type === 'm3u') {
    res.set('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="playlist.m3u"');
    return res.send(m3u);
  }

  // Default: XML format (enigma2)
  res.set('Content-Type', 'application/xml');
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n<channels>\n';
  for (const ch of channelList) {
    xml += `  <channel id="${ch.stream_id}">\n`;
    xml += `    <name>${ch.name}</name>\n`;
    xml += `    <url>${ch.stream_url}</url>\n`;
    xml += `    <icon>${ch.stream_icon}</icon>\n`;
    xml += `    <category>${ch.category_name}</category>\n`;
    xml += `  </channel>\n`;
  }
  xml += '</channels>';
  res.send(xml);
});

// ──────────────────────────────────────────
// Stream Proxy — forwards with stored headers
// ──────────────────────────────────────────

// URL map: short hash keys → original URLs. Saved to disk for crash survival.
const urlMap = new Map();
const MAP_FILE = './urlmap.json';
let urlSeq = 0;

// Simple hash: deterministic short string from URL
function hashUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return (hash >>> 0).toString(36); // positive, short
}

// Save map to disk every 30 seconds
function saveMapToDisk() {
  try {
    const obj = {};
    for (const [k, v] of urlMap) obj[k] = { url: v.url, ts: v.timestamp };
    fs.writeFileSync(MAP_FILE, JSON.stringify(obj));
  } catch(e) {
    console.error(`[MAP] Save error: ${e.message}`);
  }
}
setInterval(saveMapToDisk, 30_000);

// Load map from disk on startup
function loadMapFromDisk() {
  try {
    const data = fs.readFileSync(MAP_FILE, 'utf-8');
    const obj = JSON.parse(data);
    for (const [k, v] of Object.entries(obj)) {
      urlMap.set(k, { url: v.url, timestamp: v.ts || Date.now() });
    }
    console.log(`[MAP] Loaded ${urlMap.size} entries from disk`);
  } catch(e) { /* file doesn't exist yet */ }
}
loadMapFromDisk();

// Clean old map entries every 5 minutes
setInterval(() => {
  const threshold = Date.now() - 300_000;
  for (const [key, entry] of urlMap) {
    if (entry.timestamp < threshold) urlMap.delete(key);
  }
}, 300_000);

function storeUrl(originalUrl) {
  // Use hash as key (deterministic) — survives restarts
  const key = hashUrl(originalUrl);
  urlMap.set(key, { url: originalUrl, timestamp: Date.now() });
  return key;
}

// Resolve a segment key to its original URL
function resolveKey(key) {
  // 1. Try hash lookup
  if (urlMap.has(key)) return urlMap.get(key).url;
  // 2. Try numeric (backward compat with old map)
  const numKey = parseInt(key);
  if (!isNaN(numKey) && urlMap.has(numKey)) return urlMap.get(numKey).url;
  // 3. Fallback: try base64 decode
  try {
    const decoded = Buffer.from(key, 'base64url').toString('utf-8');
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
  } catch(e) {}
  return null;
}

// Helper: fetch URL with custom headers and pipe response
function fetchWithHeaders(targetUrl, headers, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      return reject(new Error('Too many redirects'));
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${targetUrl}`));
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers
    };

    const req = client.request(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).href;
        console.log(`[PROXY] Redirect ${redirects + 1} → ${redirectUrl}`);
        res.resume(); // Drain response
        fetchWithHeaders(redirectUrl, headers, redirects + 1).then(resolve, reject);
        return;
      }
      resolve({ response: res, finalUrl: targetUrl });
    });

    req.on('error', reject);
    req.end();
  });
}

function proxyStream(req, res) {
  const { username, password } = req.query;
  if (!authenticate(username, password)) {
    return res.status(401).send('Unauthorized');
  }

  const channel = getChannelById(req.params.id);
  if (!channel || !channel.stream_url) {
    return res.status(404).send('Stream not found');
  }

  // Build target URL
  const baseStreamUrl = channel.stream_url;
  const segmentPath = req.params[0];

  let targetUrl;
  if (segmentPath) {
    // Resolve via hash, numeric, or base64 fallback
    targetUrl = resolveKey(segmentPath);
    if (!targetUrl) {
      // Ultimate fallback: treat as filename + baseDir
      const baseDir = baseStreamUrl.substring(0, baseStreamUrl.lastIndexOf('/') + 1);
      targetUrl = baseDir + segmentPath;
    }
  } else {
    targetUrl = baseStreamUrl;
  }

  const headers = {
    'User-Agent': channel.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': channel.referrer || ''
  };

  console.log(`[PROXY] ${channel.name} → ${targetUrl}`);

  fetchWithHeaders(targetUrl, headers)
    .then(({ response: upstreamRes, finalUrl }) => {
      const contentType = upstreamRes.headers['content-type'] || '';
      const authStr = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

      // For HLS playlists, rewrite all URLs to go through our proxy
      if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl') || targetUrl.match(/\.m3u8?$/i)) {
        let body = '';
        upstreamRes.on('data', chunk => body += chunk.toString());
        upstreamRes.on('end', () => {
          const newBaseDir = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
          const rewritten = body.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            // Resolve relative URLs against the playlist URL
            let resolvedUrl;
            if (trimmed.match(/^https?:\/\//i)) {
              resolvedUrl = trimmed;
            } else {
              resolvedUrl = new URL(trimmed, finalUrl).href;
            }
            // Store URL in map and use short numeric key
            const key = storeUrl(resolvedUrl);
            return `/live/${channel.stream_id}/${key}?${authStr}`;
          }).join('\n');
          res.set('Content-Type', 'application/vnd.apple.mpegurl');
          res.send(rewritten);
        });
        return;
      }

      // For everything else (TS, M4S, key files, etc.), pipe directly
      const respHeaders = { ...upstreamRes.headers };
      delete respHeaders['transfer-encoding'];
      delete respHeaders['access-control-allow-origin'];
      res.set('Access-Control-Allow-Origin', '*');
      res.writeHead(upstreamRes.statusCode, respHeaders);
      upstreamRes.pipe(res);
    })
    .catch((err) => {
      console.error(`[PROXY] Error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).send(`Proxy error: ${err.message}`);
      }
    });
}

// GET /live/raw/:id — pass-through stream (no URL rewriting)
// For players that prefer direct CDN URLs (MUST be before /live/:id/*)
app.get('/live/raw/:id', (req, res) => {
  const { username, password } = req.query;
  if (!authenticate(username, password)) {
    return res.status(200).json({ user_info: { auth: 0, username: username || '' } });
  }
  const channel = getChannelById(req.params.id);
  if (!channel || !channel.stream_url) {
    return res.status(404).send('Stream not found');
  }
  const headers = {
    'User-Agent': channel.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': channel.referrer || ''
  };
  console.log(`[RAW] ${channel.name} → ${channel.stream_url}`);
  fetchWithHeaders(channel.stream_url, headers)
    .then(({ response: upstreamRes, finalUrl }) => {
      const contentType = upstreamRes.headers['content-type'] || '';
      // For HLS playlists, rewrite relative URLs to ABSOLUTE CDN URLs
      if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl') || finalUrl.match(/\.m3u8?$/i)) {
        let body = '';
        upstreamRes.on('data', chunk => body += chunk.toString());
        upstreamRes.on('end', () => {
          const baseDir = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
          const absolute = body.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.match(/^https?:\/\//i)) return line;
            // Resolve relative URL against CDN base
            return new URL(trimmed, baseDir).href;
          }).join('\n');
          res.set('Content-Type', 'application/vnd.apple.mpegurl');
          res.set('Access-Control-Allow-Origin', '*');
          res.send(absolute);
        });
        return;
      }
      // Non-HLS: pipe directly
      upstreamRes.headers['access-control-allow-origin'] = '*';
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    })
    .catch((err) => {
      console.error(`[RAW] Error: ${err.message}`);
      res.status(502).send(`Proxy error: ${err.message}`);
    });
});

// GET /live/:username/:password/:channelId — Standard Xtream live URL format
// IPTX Desktop & other clients use: /live/{user}/{pass}/{channel_id}.m3u8
app.get('/live/:username/:password/:channelId', (req, res) => {
  const { username, password, channelId } = req.params;
  if (!authenticate(username, password)) {
    return res.status(200).json({ user_info: { auth: 0, username: username || '' } });
  }

  // Strip .m3u8 extension if present
  const id = channelId.replace(/\.m3u8?$/i, '');

  const channel = getChannelById(id);
  if (!channel || !channel.stream_url) {
    return res.status(404).send('Stream not found');
  }

  const headers = {
    'User-Agent': channel.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': channel.referrer || ''
  };

  console.log(`[LIVE] ${channel.name} → ${channel.stream_url}`);

  fetchWithHeaders(channel.stream_url, headers)
    .then(({ response: upstreamRes, finalUrl }) => {
      const contentType = upstreamRes.headers['content-type'] || '';
      const authStr = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

      // For HLS playlists, rewrite URLs through our proxy
      if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl') || finalUrl.match(/\.m3u8?$/i)) {
        let body = '';
        upstreamRes.on('data', chunk => body += chunk.toString());
        upstreamRes.on('end', () => {
          const newBaseDir = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
          const rewritten = body.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            let resolvedUrl;
            if (trimmed.match(/^https?:\/\//i)) {
              resolvedUrl = trimmed;
            } else {
              resolvedUrl = new URL(trimmed, finalUrl).href;
            }
            const key = storeUrl(resolvedUrl);
            return `/live/${channel.stream_id}/${key}?${authStr}`;
          }).join('\n');
          res.set('Content-Type', 'application/vnd.apple.mpegurl');
          res.set('Access-Control-Allow-Origin', '*');
          res.send(rewritten);
        });
        return;
      }

      // Non-HLS: pipe directly
      const respHeaders = { ...upstreamRes.headers };
      delete respHeaders['transfer-encoding'];
      res.set('Access-Control-Allow-Origin', '*');
      res.writeHead(upstreamRes.statusCode, respHeaders);
      upstreamRes.pipe(res);
    })
    .catch((err) => {
      console.error(`[LIVE] Error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).send(`Proxy error: ${err.message}`);
      }
    });
});

// GET /live/:id — proxy live stream playlist (rewritten)
// GET /live/:id/* — proxy segments
app.get('/live/:id', proxyStream);
app.get('/live/:id/*', proxyStream);

// GET / — status page
app.get('/', (req, res) => {
  const channels = getChannels();
  const cats = getCategories();
  
  res.json({
    server: 'IPTX Server',
    version: '1.0.0',
    status: 'running',
    channels: channels.length,
    categories: cats.length,
    endpoints: {
      player_api: '/player_api.php?username=USER&password=PASS',
      get_playlist: '/get.php?username=USER&password=PASS&type=m3u_plus',
      docs: 'https://github.com/zloy42/iptx-server'
    }
  });
});

// ──────────────────────────────────────────
// Start
// ──────────────────────────────────────────
async function start() {
  await initM3U();
  
  app.listen(PORT, () => {
    console.log(`\n╔═══════════════════════════════════════╗`);
    console.log(`║   IPTX Server — Xtream API          ║`);
    console.log(`║   Port: ${PORT}                        ║`);
    console.log(`║   Channels: ${getChannels().length}                      ║`);
    console.log(`║   Categories: ${getCategories().length}                   ║`);
    console.log(`╠═══════════════════════════════════════╣`);
    console.log(`║   Test:                              ║`);
    console.log(`║   http://localhost:${PORT}/player_api.php?username=admin&password=admin123 ║`);
    console.log(`╚═══════════════════════════════════════╝\n`);
  });
}

start();
