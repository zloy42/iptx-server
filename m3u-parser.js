// m3u-parser.js — Parse M3U/M3U8 playlist into channel data
import fs from 'fs';
import https from 'https';
import http from 'http';

let channels = [];
let categories = [];
let seriesList = [];
let epgData = {};

function parseM3U(content, sourceUrl = '') {
  const lines = content.split('\n');
  const result = [];
  let currentExtinf = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      const nameMatch = trimmed.match(/,(.+)$/);
      const tvgIdMatch = trimmed.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = trimmed.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = trimmed.match(/tvg-logo="([^"]*)"/);
      const groupMatch = trimmed.match(/group-title="([^"]*)"/);

      currentExtinf = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown',
        stream_id: parseInt(tvgIdMatch?.[1]) || result.length + 1,
        tvg_name: tvgNameMatch ? tvgNameMatch[1] : '',
        stream_icon: tvgLogoMatch ? tvgLogoMatch[1] : '',
        category_name: groupMatch ? groupMatch[1] : 'General',
        category_id: null,
        stream_url: '',
        added: Math.floor(Date.now() / 1000)
      };
    } else if (trimmed && currentExtinf) {
      // Skip EXTVLCOPT, KODIPROP, and empty lines between EXTINF and URL
      if (trimmed.startsWith('#EXTVLCOPT:') || trimmed.startsWith('#KODIPROP:')) {
        // Store user-agent and referrer if present
        if (trimmed.startsWith('#EXTVLCOPT:http-user-agent=')) {
          currentExtinf.user_agent = trimmed.split('=').slice(1).join('=');
        }
        if (trimmed.startsWith('#EXTVLCOPT:http-referrer=')) {
          currentExtinf.referrer = trimmed.split('=').slice(1).join('=');
        }
        continue;
      }
      // Skip commented-out channels (###)
      if (trimmed.startsWith('###') || trimmed.startsWith('#')) {
        continue;
      }
      // This is the stream URL
      currentExtinf.stream_url = trimmed;
      // Assign category_id based on category_name
      const catIndex = categories.findIndex(
        c => c.category_name === currentExtinf.category_name
      );
      if (catIndex >= 0) {
        currentExtinf.category_id = categories[catIndex].category_id;
      }
      result.push({ ...currentExtinf });
      currentExtinf = null;
    }
  }

  return result;
}

function extractCategories(streams) {
  const seen = new Set();
  const cats = [];
  let catId = 1;

  for (const s of streams) {
    if (!seen.has(s.category_name)) {
      seen.add(s.category_name);
      const cat = {
        category_id: catId,
        category_name: s.category_name,
        parent_id: 0
      };
      cats.push(cat);
      s.category_id = catId;
      catId++;
    } else {
      const existing = cats.find(c => c.category_name === s.category_name);
      if (existing) s.category_id = existing.category_id;
    }
  }

  return cats;
}

export function loadFromM3U(content, sourceUrl = '') {
  channels = parseM3U(content, sourceUrl);
  categories = extractCategories(channels);
  console.log(`[M3U] Loaded ${channels.length} channels in ${categories.length} categories`);
  return { channels, categories };
}

// Fetch M3U from URL
export async function fetchM3U(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'IPTX-Server/1.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching M3U`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Load M3U from file
export function loadFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return loadFromM3U(content, filePath);
}

export function getChannels() {
  return channels;
}

export function getCategories() {
  return categories;
}

export function getChannelById(id) {
  return channels.find(c => c.stream_id == id);
}

export function getChannelsByCategory(categoryId) {
  return channels.filter(c => c.category_id == categoryId);
}

// EPG (simplified - returns dummy 24h guide)
export function getEpg(streamId, limit = 4) {
  const channel = getChannelById(streamId);
  if (!channel) return [];
  
  const now = Math.floor(Date.now() / 1000);
  const epg = [];
  
  for (let i = -3; i < limit - 3; i++) {
    const start = now + (i * 7200);
    const end = start + 7200;
    epg.push({
      id: `epg_${streamId}_${i}`,
      epg_id: `epg_${streamId}_${i}`,
      title: `${channel.name} - Program ${i + 4}`,
      lang: 'en',
      start: new Date(start * 1000).toISOString().replace(/[TZ]/g, ' ').trim(),
      end: new Date(end * 1000).toISOString().replace(/[TZ]/g, ' ').trim(),
      start_timestamp: start,
      end_timestamp: end,
      description: `${channel.name} scheduled programming`,
      channel_id: streamId
    });
  }
  
  return epg;
}

// Generate M3U playlist content from channels
export function generateM3U(channelList = null) {
  const list = channelList || channels;
  let output = '#EXTM3U\n';
  
  for (const ch of list) {
    output += `#EXTINF:-1 tvg-id="${ch.stream_id}" tvg-name="${ch.name}" tvg-logo="${ch.stream_icon}" group-title="${ch.category_name}",${ch.name}\n`;
    output += `${ch.stream_url}\n`;
  }
  
  return output;
}
