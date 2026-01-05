# How to View Debug Logs

## Problem
When the dev server runs in the background, console.log statements are not visible in your terminal.

## Solutions

### Option 1: Run Server in Visible Terminal (Recommended)
Stop the background server and run it in a visible terminal window:

```bash
# Stop background servers
pkill -f "next dev"

# Start in visible terminal (you'll see all logs)
cd /Users/foo/projects/financial-categorization-as-a-service
npm run dev
```

### Option 2: View Log File
Logs are now being written to `.logs/server.log`:

```bash
# View recent logs
tail -f apps/portal/.logs/server.log

# Or view all logs
cat apps/portal/.logs/server.log
```

### Option 3: Check Background Process Output
If you know the process ID, you can check its output:

```bash
# Find the process
ps aux | grep "next dev"

# The logs are going to stdout/stderr of that process
# You'll need to restart in a visible terminal to see them
```

### Option 4: Use Debug API Endpoint
Test if logging is working:

```bash
# This will execute logs and show you if they're working
curl http://localhost:3002/api/debug-logs
```

## Current Status
✅ Logging is working - logs are being written
⚠️ Logs are going to background process stdout/stderr (not visible)
✅ Log file writer added - check `.logs/server.log`

## Next Steps
1. Restart the dev server in a visible terminal to see real-time logs
2. Or check the log file: `tail -f apps/portal/.logs/server.log`


