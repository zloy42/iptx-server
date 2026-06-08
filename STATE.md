# IPTX Server — STATE

> **Last updated:** 8 Juni 2026
> **Repo:** https://github.com/zloy42/iptx-server
> **Branch:** main (latest commit: cf6743a)

---

## Ringkasan Status

✅ **Server berjalan di localhost:3000**
✅ **IPTX Desktop bisa sync & login**
✅ **Login bug fixed** — `auth` sekarang number (bukan string), auth failure return HTTP 200 (bukan 401)
⚠️ **Streaming masih buffering** — proxy sudah benar, tapi perlu debug lebih lanjut

---

## Apa yang Sudah Berfungsi

| Komponen | Status | Keterangan |
|---|---|---|
| Express server | ✅ | Port 3000, CORS enabled |
| M3U parser | ✅ | Handle EXTVLCOPT, KODIPROP, group-title |
| Xtream API - player_api.php | ✅ | All endpoints (get_live_categories, get_live_streams, dll) |
| Xtream API - get.php | ✅ | M3U export |
| Auth (username/password) | ✅ | Multiple users via .env |
| JSON format (string IDs) | ✅ | xtreamJson() converts all numbers to strings |
| Stream proxy (playlist) | ✅ | Fetches HLS playlist with User-Agent & Referrer |
| Stream proxy (segments) | ✅ | Rewrites segment URLs through proxy with headers |
| Redirect following | ✅ | Up to 5 redirects |
| CORS headers | ✅ | Access-Control-Allow-Origin: * |
| Dockerfile | ✅ | node:20-alpine |
| GitHub repo | ✅ | zloy42/iptx-server |

## Yang Belum / Bermasalah

| Issue | Status | Detail |
|---|---|---|
| Streaming buffering | 🟡 | Proxy berfungsi (tested), tapi IPTX Desktop (hls.js) mungkin ada issue dengan live HLS dari beberapa CDN |
| ANTV (Vision+) | ❌ | DRM Widevine — tidak bisa diputar tanpa license |
| CNN Indonesia | ❌ | HTTP 502 — stream mungkin sudah mati |
| MENTARI TV | ❌ | DASH/MPD — hls.js tidak support |
| Live TV (channel LIVE) | ❓ | URL aneh, kemungkinan stream tidak stabil |
| Deploy ke Render.com | ⏳ | Belum dicoba |

## Environment Saat Ini

```
PORT=3000
SERVER_URL=http://localhost:3000
USERS=admin:admin123
M3U_FILE=C:\Users\KEN\Desktop\IPTV\nasional.m3u
```

**M3U Playlist:** `C:\Users\KEN\Desktop\IPTV\nasional.m3u`
- 30 channel, 5 kategori (NASIONAL, LOKAL, HIBURAN, BERITA, LIVE)
- Sumber: detik.com (Trans TV/7), rctiplus (MNCTV/RCTI/GTV/iNews), dens.tv (SCTV/Indosiar/Moji/RTV/Kompas/tvOne), TVRI, Metro TV, CNN/CNBC Indonesia, dll

## Channel Test

| ID | Nama | Status | Sumber |
|---|---|---|---|
| 1 | MNCTV | ✅ | rctiplus |
| 2 | RCTI | ✅ | rctiplus |
| 3 | GTV | ✅ | rctiplus |
| 4 | SCTV | ✅ | dens.tv |
| 5 | INDOSIAR | ✅ | dens.tv |
| 6 | ANTV | ❌ | Vision+ DRM |
| 7 | MOJI TV | ✅ | dens.tv |
| 8 | MENTARI TV | ❌ | MPD/DASH |
| 9 | TRANS TV | ❌ | detik.com (URL mati) |
| 10 | TRANS 7 | ❌ | detik.com (URL mati) |
| 11 | MAGNA CH | 🟡 | medcom.id |
| 12 | MDTV | ✅ | dens.tv |
| 13 | RTV | ✅ | dens.tv |
| 14 | Nusantara TV | 🟡 | siar.us |
| 15 | Hanacaraka TV | ✅ | dens.tv |
| 16 | TVRI Nasional | ✅ | tvri.go.id |
| 17 | TVRI SPORT | ✅ | tvri.go.id |
| 18 | TVRI World | ✅ | tvri.go.id |
| 19 | Metro TV | 🟡 | medcom.id |
| 20 | iNews | ✅ | rctiplus |
| 21 | CNN Indonesia | ❌ | 502 |
| 22 | CNBC Indonesia | 🟡 | cnbcindonesia.com |
| 23 | Kompas TV | 🟡 | dens.tv |
| 24 | tvOne | 🟡 | dens.tv |
| 25 | Beritasatu | ✅ | dens.tv |

## Todo ke Depan

- [ ] Deploy ke Render.com gratis
- [ ] Fix streaming (debug hls.js + proxy)
- [ ] Coba channel satu-satu, catat mana yang jalan
- [ ] Tambah auto-reload M3U periodik (tanpa restart)
- [ ] Tambah multiple playlist support
