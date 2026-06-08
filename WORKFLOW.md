# IPTX Server — WORKFLOW

## 1. Development Workflow

### 1.1 Local Development

```bash
# Clone & install
git clone https://github.com/zloy42/iptx-server
cd iptx-server
npm install

# Setup config
cp .env.example .env
# Edit .env: set M3U_FILE atau M3U_URL

# Run
npm start
# Server: http://localhost:3000
# Test: curl http://localhost:3000/player_api.php?username=admin&password=admin123
```

### 1.2 Git Workflow

```
main ← push langsung (single developer)
  ├── feat/*    → fitur baru
  ├── fix/*     → bugfix
  └── chore/*   → maintenance
```

Semua commit langsung ke `main`. Gunakan conventional commit:
- `feat: ...` untuk fitur baru
- `fix: ...` untuk bugfix
- `chore: ...` untuk maintenance

### 1.3 Testing

```bash
# Cek server status
curl http://localhost:3000/

# Test auth
curl "http://localhost:3000/player_api.php?username=admin&password=admin123"

# Test live categories
curl "http://localhost:3000/player_api.php?username=admin&password=admin123&action=get_live_categories"

# Test live streams
curl "http://localhost:3000/player_api.php?username=admin&password=admin123&action=get_live_streams"

# Test proxy playlist
curl "http://localhost:3000/live/1?username=admin&password=admin123"

# Test proxy segment
curl -I "http://localhost:3000/live/1/segment.ts?username=admin&password=admin123"
```

## 2. Deploy Workflow

### 2.1 Deploy ke Render.com (Gratis)

1. Push kode ke GitHub
2. Buka [render.com](https://render.com) → **New Web Service**
3. Connect repo `zloy42/iptx-server`
4. Set:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add Environment Variables dari `.env.example`
6. **Deploy**

URL: `https://iptx-server.onrender.com`

### 2.2 Deploy dengan Docker

```bash
docker build -t iptx-server .
docker run -d -p 3000:3000 -e M3U_URL=https://... iptx-server
```

Atau via docker-compose untuk production:
```yaml
version: '3'
services:
  iptx-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - USERS=admin:admin123
      - M3U_URL=https://your-playlist-url.m3u
```

## 3. Mengganti Playlist

### Opsi A: File Lokal
```env
M3U_FILE=C:\Users\KEN\Desktop\IPTV\nasional.m3u
```

### Opsi B: URL Remote
```env
M3U_URL=https://raw.githubusercontent.com/.../playlist.m3u
```

> **Note:** Setelah ganti M3U, **restart server** dan **clear cache IPTX Desktop** di:
> `C:\Users\KEN\AppData\Roaming\iptx-desktop\api_cache`

## 4. Troubleshooting

### 4.1 Sync Failed - Authentication failed
- Cek `.env` → pastikan `USERS=admin:admin123`
- Restart server
- Clear cache IPTX Desktop

### 4.2 Sync Failed - invalid args meta
- Semua ID (stream_id, category_id, dll) harus **string**
- Cek dengan: `curl http://localhost:3000/player_api.php?username=admin&password=admin123&action=get_live_categories | jq '.[0].category_id | type'`

### 4.3 Channel buffering terus
1. Cek apakah channel butuh proxy → coba akses lewat VLC langsung dari M3U
2. Kalau di VLC jalan → masalah proxy (User-Agent/Referrer tidak sampai ke segment)
3. Kalau di VLC juga gak jalan → stream CDN mati

### 4.4 Port 3000 already in use
```bash
# Cari PID
netstat -ano | grep :3000
# Kill
taskkill /F /PID <PID>
```

## 5. Menambah User Baru

Edit `.env`:
```env
USERS=admin:admin123,tamu:tamu123,user:pass
```
Format: `user1:pass1,user2:pass2`
