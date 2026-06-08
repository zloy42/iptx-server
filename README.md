# IPTX Server

Lightweight Xtream Codes API server — serve IPTV channels from an M3U playlist via standard Xtream API.

Works with: **IPTX Desktop**, TiviMate, IPTV Smarters, and any Xtream-compatible player.

## Quick Start

```bash
# Install dependencies
npm install

# Copy and edit config
cp .env.example .env

# Start server
npm start
```

## Configuration (.env)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | 3000 |
| `SERVER_URL` | Public URL of this server | http://localhost:3000 |
| `USERS` | Username:password pairs, comma-separated | admin:admin123 |
| `M3U_URL` | URL to remote M3U playlist (optional) | — |
| `M3U_FILE` | Path to local M3U file (optional) | — |

> Note: If neither `M3U_URL` nor `M3U_FILE` is set, the server starts with sample channels for testing.

## Endpoints

### Xtream Player API

```
/player_api.php?username=admin&password=admin123
```

Returns user info and available actions. Use `&action=` parameter:

| Action | Description |
|---|---|
| `get_live_categories` | Live TV categories |
| `get_live_streams` | All live channels (add `&category_id=N` to filter) |
| `get_vod_categories` | VOD categories |
| `get_vod_streams` | All VOD streams |
| `get_series_categories` | Series categories |
| `get_series` | All series |
| `get_series_info&series_id=N` | Series details + episodes |
| `get_short_epg&stream_id=N` | EPG data for a channel |

### M3U Playlist Export

```
/get.php?username=admin&password=admin123&type=m3u_plus
```

## Deploy to Render.com (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables (from `.env`)
6. Deploy

Your Xtream API URL will be: `https://your-app.onrender.com/player_api.php`
