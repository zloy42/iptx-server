# IPTX Server — PRD

## 1. Ringkasan

IPTX Server adalah implementasi **Xtream Codes API** yang ringan (lightweight) untuk menyajikan channel IPTV dari playlist M3U ke aplikasi IPTV player yang kompatibel dengan Xtream API (seperti IPTX Desktop, TiviMate, IPTV Smarters).

## 2. Tujuan

- Membuat Xtream API server sendiri dengan username/password
- Bisa serve channel dari file M3U lokal atau URL remote
- Bisa di-deploy di hosting gratis (Render.com, Railway, Fly.io)
- Kode sumber terbuka di GitHub

## 3. Fitur Utama

| Fitur | Status |
|---|---|
| Xtream API endpoint (`player_api.php`) | ✅ |
| M3U playlist parser | ✅ |
| Username/password auth | ✅ |
| Multiple users | ✅ |
| Stream proxy dengan User-Agent & Referrer | ✅ |
| HLS segment proxy (header forwarding) | ✅ |
| HLS URL rewriting (relative → proxy) | ✅ |
| M3U playlist export (`get.php`) | ✅ |
| EPG data (dummy 24h) | ✅ |
| Live TV, VOD, Series categories | ✅ |
| Docker support | ✅ |
| Deploy ke Render.com | 🟡 Perlu testing |

## 4. Arsitektur

```
┌──────────────┐      ┌──────────────┐      ┌────────────┐
│ IPTX Desktop │─────▶│ IPTX Server  │─────▶│ CDN / Source│
│ (hls.js)     │◀─────│ (Node.js)    │◀─────│ (detik/dens)│
└──────────────┘      └──────────────┘      └────────────┘
      │                       │
      │    Request playlist   │    Fetch dengan User-Agent
      │    & segments         │    & Referrer headers
      └───────────────────────┘
```

**Alur request channel:**
1. IPTX Desktop login → `player_api.php?username=admin&password=admin123`
2. IPTX Desktop minta daftar channel → `?action=get_live_streams`
3. IPTX Desktop buka channel → request `GET /live/1?username=admin&password=admin123`
4. Server ambil playlist dari CDN dengan **User-Agent & Referrer**
5. Server rewrite URL segment di playlist → proxy URL
6. IPTX Desktop (hls.js) request segment → `GET /live/1/media_123.ts?username=...`
7. Server ambil segment dari CDN dengan **User-Agent & Referrer**
8. Server stream segment ke IPTX Desktop

## 5. Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Parser:** Custom M3U parser (tanpa dependensi eksternal)
- **Dependencies:** express, cors, dotenv (minimalis)
- **Container:** Docker (node:20-alpine)

## 6. Konfigurasi (.env)

| Variable | Default | Deskripsi |
|---|---|---|
| `PORT` | 3000 | Port server |
| `SERVER_URL` | http://localhost:3000 | URL publik server |
| `USERS` | admin:admin123 | User:password pairs |
| `M3U_URL` | — | URL remote M3U playlist |
| `M3U_FILE` | — | Path lokal M3U file |

## 7. Endpoint Xtream API

### `player_api.php`
- `?username=X&password=Y` → user info + server info
- `&action=get_live_categories` → kategori live TV
- `&action=get_live_streams` → daftar channel live
- `&action=get_short_epg&stream_id=N` → EPG channel
- `&action=get_vod_categories` → kategori VOD
- `&action=get_vod_streams` → daftar VOD
- `&action=get_series_categories` → kategori series
- `&action=get_series` → daftar series

### `get.php`
- `?username=X&password=Y&type=m3u_plus` → export M3U playlist

## 8. Catalan Penting

- Beberapa channel (detik.com, dens TV) butuh User-Agent & Referrer spesifik
- ANTV dari Vision+ pakai DRM Widewide — tidak bisa diputar
- CNN Indonesia (502) — stream mungkin sudah mati
- MENTARI TV pakai DASH/MPD — butuh player khusus
