# Quick Start: Localhost Deployment

## 🚀 One-Command Start

```bash
npm run dev:localhost
```

Or use the script directly:

```bash
./scripts/start-localhost.sh
```

## 📋 Prerequisites Checklist

- [ ] Docker Desktop installed and running
- [ ] Supabase CLI installed (`brew install supabase/tap/supabase`)
- [ ] Node.js 20+ and npm 10+ installed

## 🔧 Manual Steps (if needed)

### 1. Start Supabase (Docker)
```bash
supabase start
```

### 2. Configure Environment
Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get-from-supabase-status>
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-status>
```

### 3. Start Next.js
```bash
npm run dev
```

## 🌐 Access URLs

- **App**: http://localhost:3000
- **Supabase Studio**: http://localhost:54323
- **API**: http://localhost:54321
- **Email Testing**: http://localhost:54324

## 📚 Full Documentation

See [DEPLOY_LOCALHOST.md](./DEPLOY_LOCALHOST.md) for complete guide.

## 🛑 Stop Services

```bash
supabase stop  # Stops Docker containers
```



