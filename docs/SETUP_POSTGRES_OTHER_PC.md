# PostgreSQL Setup — Running the App on Another PC

Use this guide when moving the ChecksheetsApp (SPHAiRPlatform) to a new machine. It covers database configuration and how to run the app against a local PostgreSQL instance.

---

## 1. Current Database Configuration

The app expects these **environment variables** (set in `server/.env`):

| Variable       | Current value (this PC) | Description                |
|----------------|-------------------------|----------------------------|
| `DB_HOST`      | `localhost`             | PostgreSQL server host     |
| `DB_PORT`      | `5432`                  | PostgreSQL port            |
| `DB_NAME`      | `solar_om_db`           | Database name              |
| `DB_USER`      | `postgres`              | PostgreSQL user            |
| `DB_PASSWORD`  | *(your password)*       | PostgreSQL user password   |

Optional (have defaults in code):

- `DB_MAX_CONNECTIONS` (default: 20)
- `DB_MIN_CONNECTIONS` (default: 2)
- `DB_IDLE_TIMEOUT` (default: 30000 ms)
- `DB_CONNECTION_TIMEOUT` (default: 2000 ms)

The application code (e.g. `server/index.js`) defaults to:

- **Database name:** `solar_om_db`
- **User:** `postgres`
- **Host:** `localhost`
- **Port:** `5432`

So on the other PC you can use the same DB name and user, and only need to set the password (and override host/port if PostgreSQL is not on localhost).

---

## 2. Install PostgreSQL on the Other PC

1. **Download PostgreSQL**
   - https://www.postgresql.org/download/windows/ (Windows)
   - Or use the installer from the official site for your OS.

2. **Run the installer**
   - Install PostgreSQL (v12 or higher).
   - Note the **port** (default `5432`).
   - Set and remember the **postgres user password**; you will use it as `DB_PASSWORD` in `server/.env`.

3. **Ensure the service is running**
   - Windows: Services → find "PostgreSQL" → ensure it’s running.
   - macOS/Linux: e.g. `sudo service postgresql status` or `brew services list` (if installed via Homebrew).

---

## 3. Get the Code on the Other PC

From the machine where you have the repo (or from GitHub after you push):

- **Option A — Clone from GitHub**
  ```bash
  git clone https://github.com/YOUR_USERNAME/ChecksheetsApp.git
  cd ChecksheetsApp
  ```
- **Option B — Copy the project folder** (e.g. USB, network share), then open it in your editor/terminal.

---

## 4. Create `server/.env` on the Other PC

The repo does **not** include `server/.env` (it’s in `.gitignore`). Create it from the example and set the DB password:

1. Copy the example file:
   ```bash
   cd server
   copy .env.example .env
   ```
   (On macOS/Linux: `cp .env.example .env`.)

2. Edit `server/.env` and set at least:

   ```env
   # Database (required)
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=solar_om_db
   DB_USER=postgres
   DB_PASSWORD=YOUR_POSTGRES_PASSWORD

   # Server
   NODE_ENV=development
   PORT=3001
   ```

   Replace `YOUR_POSTGRES_PASSWORD` with the password you set for the `postgres` user during PostgreSQL installation.

3. Optional: add `JWT_SECRET` and `SESSION_SECRET` if you use auth (you can copy from this PC’s `server/.env` or generate new ones).

---

## 5. Install Dependencies and Create the Database

From the **project root** (e.g. `d:\PJs\ChecksheetsApp` or `~/ChecksheetsApp`):

```bash
# Install all dependencies (root, server, client)
npm run install-all
```

Then create the database and run schema + migrations:

```bash
npm run setup-db
```

This will:

- Connect to PostgreSQL as `DB_USER` (e.g. `postgres`) using `DB_PASSWORD`.
- Create the database `solar_om_db` if it doesn’t exist.
- Apply `server/db/schema.sql` and the migrations in `server/db/migrations/`.
- Seed initial data (default org, users, templates, etc.).

If you see “Database setup completed!” you’re good. If you see errors, check that:

- PostgreSQL is running.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` in `server/.env` are correct.
- The user has permission to create databases (default `postgres` user does).

---

## 6. Run the Application

From the project root:

```bash
npm run dev
```

This starts:

- **Backend:** http://localhost:3001  
- **Frontend:** http://localhost:3000  

Or run separately:

```bash
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend
npm run client
```

---

## 7. Quick Reference — Commands on the Other PC

```bash
# 1. Clone or copy project, then:
cd ChecksheetsApp

# 2. Environment
cd server && copy .env.example .env
# Edit .env: set DB_PASSWORD (and DB_NAME if you use a different one)

# 3. Install and DB setup
cd ..
npm run install-all
npm run setup-db

# 4. Run
npm run dev
```

---

## 8. If You Need to Move Data from This PC

- **Option A — Dump/restore**
  - On this PC: `pg_dump -U postgres -d solar_om_db -F c -f solar_om_db.backup`
  - Copy `solar_om_db.backup` to the other PC.
  - On the other PC (after creating an empty `solar_om_db` or dropping it and recreating):  
    `pg_restore -U postgres -d solar_om_db solar_om_db.backup`

- **Option B — Fresh setup**
  - On the other PC, use only `npm run setup-db` (no dump). You get a clean DB with seed data; no data from this PC.

Use Option A when you need to keep existing organizations, users, and tasks. Use Option B for a clean dev/test copy.
