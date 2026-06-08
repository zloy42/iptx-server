# IPTX Server — STATE

> **Last updated:** 8 Juni 2026 (update 2)
> **Repo:** https://github.com/zloy42/iptx-server
> **Branch:** main

---

## Ringkasan Status

✅ **Server berjalan di localhost:3000** (PID 2520)
✅ **IPTX Desktop bisa sync, login & play channel**
✅ **Login bug fixed** — `auth` number (bukan string), auth failure return HTTP 200 (bukan 401)
✅ **Standard Xtream URL format** — `/live/{username}/{password}/{channel_id}.m3u8`
✅ **Stream proxy bekerja** — rewrite segmen via proxy dengan User-Agent & Referrer header
✅ **Raw endpoint** — `/live/raw/:id` untuk direct CDN access
✅ **Segment key persistent** — hash deterministic + disimpan ke `urlmap.json`, survive restart
✅ **Crash protection** — global `unhandledRejection` & `uncaughtException` handler

---

## Fix Terbaru

| Fix | Detail |
|-----|--------|
| Login auth | `auth` tetap number (bukan string), failure return 200 bukan 401 — IPTX Desktop bisa login |
| Standard URL | Route `/live/:username/:password/:channelId` — format Xtream standar yg dipakai IPTX Desktop |
| Raw endpoint | `/live/raw/:id` — return playlist dgn absolute CDN URLs (player langsung akses CDN) |
| Segment persistence | Hash deterministic + disk save (`urlmap.json`) — URL segmen tetap valid meski server restart |
| Crash prevention | Global error handlers — server gak crash lagi kalau ada unhandled rejection |
| Channel streaming | Semua channel yg sumbernya hidup bisa diputar (rctiplus, dens.tv, TVRI, Beritasatu) |

---

## Apa yang Berfungsi

| Komponen | Status | Keterangan |
|----------|--------|------------|
| Express server | ✅ | Port 3000, CORS enabled, semua interface |
| M3U parser | ✅ | Handle EXTVLCOPT, KODIPROP, group-title |
| Xtream API - player_api.php | ✅ | All endpoints (categories, streams, info, epg) |
| Xtream API - get.php | ✅ | M3U export |
| Auth (username/password) | ✅ | Multi user via .env |
| Standard URL format | ✅ | `/live/{user}/{pass}/{id}.m3u8` — compatible IPTX Desktop |
| Stream proxy (playlist) | ✅ | Fetch HLS playlist with User-Agent & Referrer |
| Stream proxy (segments) | ✅ | Rewrite via hash key → proxy dengan headers |
| Raw endpoint | ✅ | `/live/raw/:id` — direct CDN playlist |
| URL persistence | ✅ | `urlmap.json` — hash keys disimpan ke disk tiap 30 detik |
| Crash handlers | ✅ | `unhandledRejection` + `uncaughtException` — server tetap jalan |
| Redirect following | ✅ | Up to 5 redirects |
| CORS headers | ✅ | Access-Control-Allow-Origin: * |
| Dockerfile | ✅ | node:20-alpine |
| GitHub repo | ✅ | zloy42/iptx-server |

## Channel Test (dari IPTX Desktop)

| ID | Nama | Status | Sumber | Catatan |
|----|------|--------|--------|---------|
| 1 | MNCTV | ✅ | rctiplus | Proxy dengan User-Agent |
| 2 | RCTI | ✅ | rctiplus | Proxy dengan User-Agent |
| 3 | GTV | ✅ | rctiplus | Proxy dengan User-Agent |
| 4 | SCTV | ✅ | dens.tv | |
| 5 | INDOSIAR | ✅ | dens.tv | |
| 6 | ANTV | ❌ | Vision+ DRM | DRM Widevine |
| 7 | MOJI TV | ✅ | dens.tv | |
| 8 | MENTARI TV | ❌ | MPD/DASH | |
| 9 | TRANS TV | ❌ | detik.com | URL mati |
| 10 | TRANS 7 | ❌ | detik.com | URL mati |
| 11 | MAGNA CH | 🟡 | medcom.id | Intermiten |
| 12 | MDTV | ✅ | dens.tv | |
| 13 | RTV | ✅ | dens.tv | |
| 14 | Nusantara TV | 🟡 | siar.us | |
| 15 | Hanacaraka TV | ✅ | dens.tv | |
| 16 | TVRI Nasional | ✅ | tvri.go.id | |
| 17 | TVRI SPORT | ✅ | tvri.go.id | |
| 18 | TVRI World | ✅ | tvri.go.id | |
| 19 | Metro TV | ❌ | medcom.id | DNS error (edge.medcom.id) |
| 20 | iNews | ✅ | rctiplus | Proxy dengan User-Agent |
| 21 | CNN Indonesia | ❌ | - | 502 |
| 22 | CNBC Indonesia | 🟡 | cnbcindonesia.com | |
| 23 | Kompas TV | 🟡 | dens.tv | |
| 24 | tvOne | 🟡 | dens.tv | |
| 25 | Beritasatu | ✅ | dens.tv | |
| 26 | BTV | 🟡 | - | |
| 27 | Jawa Pos TV | 🟡 | siar.us | |
| 28 | Elshinta TV | 🟡 | - | |
| 29 | Aniplus | 🟡 | dens.tv | |
| 30 | Surabaya TV | 🟡 | - | |

## Environment

```
PORT=3000
SERVER_URL=http://localhost:3000
USERS=admin:admin123
M3U_FILE=C:\Users\KEN\Desktop\IPTV\nasional.m3u
```

**M3U:** `C:\Users\KEN\Desktop\IPTV\nasional.m3u` — 30 channel, 5 kategori
**IP WiFi:** 192.168.0.105
**Firewall:** Rule "IPTX Server" (port 3000 TCP)

## Masalah Tersisa

| Issue | Status | Detail |
|-------|--------|--------|
| Logo channel 404 | ❌ | iili.io & jpeg.ly broken — eksternal |
| ANTV | ❌ | DRM Widevine |
| MENTARI TV | ❌ | DASH/MPD |
| Trans TV/7 | ❌ | Sumber detik.com mati |
| Metro TV | ❌ | DNS error edge.medcom.id |
| OTT Player Android | 🟡 | Butuh custom User-Agent untuk rctiplus |
| Belum ada auto-reload M3U | ⏳ | Perlu restart server saat update playlist |

## Todo

- [ ] Logo proxy — serve placeholder lokal untuk channel yg logo-nya broken
- [ ] Auto-reload M3U periodik (tanpa restart)
- [ ] Multiple playlist support
- [ ] Deploy ke Render.com (opsional)
- [ ] Cari sumber baru untuk channel mati (Trans TV/7, Metro TV)
