# Local Development Setup

## Starting Services

### Option 1: Using the Start Script

```bash
./scripts/start-local.sh
```

### Option 2: Manual Start

#### 1. Start Supabase Local Development

```bash
supabase start
```

This will:
- Start Docker containers for Supabase (PostgreSQL, PostgREST, GoTrue, etc.)
- Run all migrations
- Set up the local database

**Supabase will be available at:**
- API URL: `http://localhost:54321`
- DB URL: `postgresql://postgres:postgres@localhost:54322/postgres`
- Studio URL: `http://localhost:54323`

#### 2. Start Next.js Dev Server

```bash
npm run dev
```

**Next.js will be available at:**
- `http://localhost:3000`

## Checking Status

### Check Supabase Status

```bash
supabase status
```

### Check Docker Containers

```bash
docker ps | grep supabase
```

### Check Next.js

Visit `http://localhost:3000` in your browser.

## Stopping Services

### Stop Supabase

```bash
supabase stop
```

### Stop Next.js

Press `Ctrl+C` in the terminal running the dev server.

## Environment Variables

Make sure your `.env.local` file has the correct Supabase local URLs:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Get these values by running:
```bash
supabase status
```

### Google Document AI (OCR) Configuration

For receipt and invoice OCR processing, you need to configure Google Document AI:

```env
# Required for OCR
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your-processor-id
GOOGLE_CLOUD_LOCATION=us

# For local development - path to service account JSON file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# For Vercel/serverless - base64 encoded service account JSON
GOOGLE_APPLICATION_CREDENTIALS_JSON=<base64-encoded-service-account-json>
```

**Setting up Google Document AI:**

1. Create a Google Cloud project and enable the Document AI API
2. Create a Document AI processor (Form Parser or Invoice Parser)
3. Create a service account with Document AI User role
4. Download the service account key JSON file
5. For local development: set `GOOGLE_APPLICATION_CREDENTIALS` to the file path
6. For Vercel: base64 encode the JSON file and set `GOOGLE_APPLICATION_CREDENTIALS_JSON`:
   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```

**Note:** If OCR is not configured, receipt uploads will still work but will create placeholder transactions that require manual entry.

## Troubleshooting

### Supabase won't start

1. Check if Docker is running:
   ```bash
   docker ps
   ```

2. Check if ports are already in use:
   ```bash
   lsof -i :54321  # API port
   lsof -i :54322  # DB port
   ```

3. Reset Supabase:
   ```bash
   supabase stop
   supabase start
   ```

### Next.js won't start

1. Check if port 3000 is in use:
   ```bash
   lsof -i :3000
   ```

2. Clear Next.js cache:
   ```bash
   rm -rf .next
   npm run dev
   ```

### Database migrations not applied

```bash
supabase db reset
```

This will reset the database and apply all migrations.




