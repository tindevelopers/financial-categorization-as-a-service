# Deploy to Localhost with Docker-based Supabase

This guide will help you deploy the application to localhost using Docker to run Supabase locally.

## Prerequisites

1. **Docker Desktop** - [Download and install](https://www.docker.com/products/docker-desktop/)
2. **Supabase CLI** - Install via Homebrew:
   ```bash
   brew install supabase/tap/supabase
   ```
3. **Node.js** (v20+) and npm (v10+) - Already installed if you're working on this project

## Quick Start

### Option 1: Automated Script (Recommended)

Run the automated startup script:

```bash
./scripts/start-localhost.sh
```

This script will:
- ✅ Check if Docker is running
- ✅ Start Supabase services (using Docker containers)
- ✅ Extract and configure environment variables automatically
- ✅ Optionally start the Next.js development server

### Option 2: Manual Setup

#### Step 1: Start Docker Desktop

Make sure Docker Desktop is running before proceeding.

#### Step 2: Start Supabase (Docker containers)

```bash
supabase start
```

This command:
- Starts all Supabase services in Docker containers automatically
- Runs database migrations
- Displays your local credentials

**Expected output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Step 3: Configure Environment Variables

Create or update `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-from-supabase-start>
```

**Get the actual keys:**
```bash
supabase status
```

Or use the default local Supabase keys:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

#### Step 4: Start Next.js Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

## Service URLs

Once Supabase is running, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **Next.js App** | http://localhost:3000 | Your application |
| **Supabase API** | http://localhost:54321 | REST API endpoint |
| **Supabase Studio** | http://localhost:54323 | Database management UI |
| **Inbucket** | http://localhost:54324 | Email testing (catches all emails) |
| **Database** | localhost:54322 | PostgreSQL database |

## Docker Containers

Supabase CLI automatically manages Docker containers. To see what's running:

```bash
# View Supabase containers
docker ps | grep supabase

# View all containers
docker ps

# View Supabase logs
supabase logs

# View specific service logs
docker logs supabase_db_tinadmin-saas-base
```

## Daily Workflow

### Start Development

```bash
# 1. Start Docker Desktop (if not already running)

# 2. Start Supabase (uses Docker)
supabase start

# 3. Start Next.js (in another terminal)
npm run dev
```

### Stop Services

```bash
# Stop Supabase (stops Docker containers)
supabase stop

# Stop Next.js
# Press Ctrl+C in the terminal running npm run dev
```

### Reset Database

```bash
# Reset database and re-run migrations
supabase db reset
```

## Verify Setup

1. **Check Supabase Studio:**
   - Open http://localhost:54323
   - You should see your database tables

2. **Check Docker Containers:**
   ```bash
   docker ps
   ```
   You should see containers like:
   - `supabase_db_tinadmin-saas-base`
   - `supabase_studio_tinadmin-saas-base`
   - `supabase_auth_tinadmin-saas-base`
   - etc.

3. **Test Your App:**
   - Visit http://localhost:3000
   - Navigate to admin pages
   - Check browser console for errors

## Troubleshooting

### Docker Not Running

**Error:** `Cannot connect to the Docker daemon`

**Solution:**
1. Start Docker Desktop
2. Wait for it to fully start (Docker icon in menu bar)
3. Try again: `supabase start`

### Port Conflicts

**Error:** `Port 54321 is already in use`

**Solution:**
```bash
# Check what's using the port
lsof -i :54321

# Stop Supabase
supabase stop

# Or kill the process using the port
kill -9 <PID>
```

### Supabase Won't Start

**Error:** `Failed to start Supabase`

**Solution:**
```bash
# Check Docker status
docker ps

# Check Supabase logs
supabase logs

# Reset Supabase
supabase stop
supabase start
```

### Environment Variables Not Working

**Error:** `NEXT_PUBLIC_SUPABASE_URL is not set`

**Solution:**
1. Make sure `.env.local` exists in project root
2. Check file has correct values:
   ```bash
   cat .env.local
   ```
3. Restart Next.js dev server after updating `.env.local`

### Database Migrations Not Applied

**Solution:**
```bash
# Reset and re-run all migrations
supabase db reset
```

### Can't Connect to Database

**Solution:**
1. Verify Supabase is running: `supabase status`
2. Check Docker containers: `docker ps | grep supabase`
3. Verify `.env.local` has correct database URL

## Advanced: Using Docker Compose Directly

If you prefer to use Docker Compose directly (without Supabase CLI), you can use the provided `docker-compose.yml`:

```bash
# Start PostgreSQL only (not full Supabase stack)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Note:** This only provides PostgreSQL, not the full Supabase stack (Auth, Storage, etc.). The Supabase CLI approach is recommended.

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | `http://localhost:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key | Get from `supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) | Get from `supabase status` |

## Next Steps

Once localhost deployment is working:

1. ✅ Test all features locally
2. ✅ Verify database migrations
3. ✅ Test authentication flows
4. ✅ Check email functionality (via Inbucket)
5. ✅ When ready, deploy to production

## Additional Resources

- [Supabase Local Development Docs](https://supabase.com/docs/guides/cli/local-development)
- [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)



