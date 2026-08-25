# Simple Whitelist

A lightweight Minecraft (Paper) whitelist plugin with a real-time web management panel.

---

## Quick Setup

### 1. Install Plugin
1. Download **`SimpleWhitelist.jar`** from [Releases](https://github.com/xoxod33p/simple-whitelist/releases).
2. Put it into your server's **`plugins/`** folder.
3. Start the server once. It creates:
   ```
   plugins/SimpleWhitelist/whitelist.db
   ```

---

### 2. Run Web Panel
1. Open the `webapp` folder and install dependencies:
   ```bash
   cd webapp
   npm install
   ```

2. Create a `.env` file with your server details:
   ```env
   DB_PATH=/path/to/your/server/plugins/SimpleWhitelist/whitelist.db
   PORT=3000
   ADMIN_PASSWORD=your_password
   ```

3. Start the web app:
   ```bash
   npm start
   ```

4. Open **`http://localhost:3000`** in your browser and log in.

---

## Features

- **Real-Time Sync**: Players added or removed on the web panel take effect instantly without restarting or reloading the server.
- **Recently Kicked / Blocked List**: View blocked connection attempts and whitelist players with a single click (`+ allow connection`).
- **Online & Offline Mode Support**: Works seamlessly with official Mojang accounts, offline/cracked servers, and proxy networks (Velocity/BungeeCord).
- **Mobile Friendly**: Clean, touch-optimized responsive design.
- **Persistent Session**: Stay logged in even after page refreshes.
- **No In-Game Commands Needed**: Pure web-based management.

---

## Build from Source

- **Plugin**: `cd plugin && mvn clean package`
- **Release Assets**: `./scripts/build-release.sh` (Linux/macOS) or `./scripts/build-release.ps1` (Windows)

