# SimpleWhitelist — Paper plugin + web panel

Two pieces sharing one SQLite file:

- **plugin/** — a Paper plugin (Java) that checks the whitelist when a player tries to
  join (`AsyncPlayerPreLoginEvent`), kicks non-whitelisted players, and logs successful connections.
- **webapp/** — a small Node/Express site to add, remove, and view whitelisted
  players and recent connections from a browser.

They never talk to each other over the network — they just read/write the same
`whitelist.db` SQLite file, so changes made in the web panel take effect immediately on the
very next login attempt.

## 1. Build the plugin

Requires Java 17+ and Maven.

```bash
cd plugin
mvn clean package
```

This produces `plugin/target/SimpleWhitelist.jar`. Drop it into your Paper
server's `plugins/` folder and start the server once so it generates:

```
plugins/SimpleWhitelist/config.yml
plugins/SimpleWhitelist/whitelist.db
```

Open `config.yml` and note the `database-path` — the server console also prints
the absolute path on startup, e.g.:

```
[SimpleWhitelist] Using whitelist database at: /home/you/server/plugins/SimpleWhitelist/whitelist.db
```

**Minecraft's own whitelist enforcement isn't required** — this plugin
does its own check independently of `whitelist.json`, so you don't need to run
`/whitelist on`. Non-whitelisted players are kicked on connect with the configurable kick message,
and all whitelisting is handled seamlessly through the web panel.


## 2. Run the web panel

Requires Node.js 18+.

```bash
cd webapp
npm install
cp .env.example .env
```

Edit `.env`:
- `DB_PATH` — point this at the **exact same file** the plugin printed above.
- `ADMIN_PASSWORD` — set a real password, this gates the whole panel.
- `PORT` — defaults to 3000.

```bash
npm start
```

Visit `http://localhost:3000` (or your server's IP:port if hosting remotely),
log in with `ADMIN_PASSWORD`, and manage the whitelist from there. Adding a
player looks up their UUID via Mojang's API, so you can add someone by
username even if they've never joined before.

## How it fits together

```
 Web panel  ──writes──▶  whitelist.db (SQLite)  ◀──reads── Paper plugin
 (Node/Express)                                            (on player login)
```

- Table `whitelist(uuid, username, added_by, added_at)` — who's allowed in.
- Table `connections(uuid, username, ip, connected_at)` — a log of joins,
  visible in the panel's "Recent connections" list.

## Notes / things you may want to change

- The web panel's auth is a single shared password (Bearer token), good enough
  for a small private server. For anything more exposed, put it behind a
  reverse proxy with real auth (or extend it — it's plain Express).
- If you run the webapp on a **different machine** than the game server,
  `DB_PATH` needs a network filesystem (e.g. mounting the server's plugin
  folder over SFTP/NFS/Samba) — SQLite itself doesn't do remote access. The
  simpler setup is running both on the same box.
- `journal_mode = WAL` is enabled on the webapp's connection so it plays nicely
  with the plugin also having the file open.
- The plugin targets Paper 1.20.4 in `pom.xml` — bump the `paper-api` version
  there to match your server if you're on a different version.

## 3. Releases & CI

- **Automated Releases**: Push a git tag (e.g. `v1.0.0`) or trigger the GitHub Actions workflow manually to generate a release with `SimpleWhitelist.jar`, `webapp-dist.zip`, and SHA256 checksums.
- **Local Packaging**:
  - Windows: run `./scripts/build-release.ps1`
  - Linux/macOS: run `./scripts/build-release.sh`
