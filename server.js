// iptx-server — Xtream Codes API server
// Serve IPTV channels from M3U playlist via standard Xtream API

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
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
    return res.status(401).json({
      user_info: { auth: 0, username: username || '' }
    });
  }
  req.xtream_user = username;
  next();
}

// Helper: convert integer IDs to strings for Xtream compat
function xtreamJson(data) {
  if (Array.isArray(data)) {
    return data.map(item => xtreamJson(item));
  }
  if (data && typeof data === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
      // Convert category_id, stream_id, series_id, parent_id, episode_num to string
      if (['category_id', 'stream_id', 'series_id', 'parent_id', 'episode_num', 'num'].includes(key) && typeof val === 'number') {
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
        stream_url: `${baseUrl}/live/${ch.stream_id}?username=${req.query.username}&password=${req.query.password}`
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
      resolve(res);
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

  const headers = {
    'User-Agent': channel.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': channel.referrer || ''
  };

  console.log(`[PROXY] ${channel.name} → ${channel.stream_url}`);

  fetchWithHeaders(channel.stream_url, headers)
    .then((upstreamRes) => {
      // Copy all headers except transfer-encoding
      const respHeaders = { ...upstreamRes.headers };
      delete respHeaders['transfer-encoding'];
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

// GET /live/:id — proxy a live stream with stored headers
app.get('/live/:id', proxyStream);

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
