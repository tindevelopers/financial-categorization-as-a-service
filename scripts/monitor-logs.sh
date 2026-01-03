#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
monitor-logs.sh — tail logs in real time (local / Vercel / Supabase)

Usage:
  ./scripts/monitor-logs.sh vercel [project] [environment]
  ./scripts/monitor-logs.sh supabase
  ./scripts/monitor-logs.sh local <logfile>

Examples:
  # Vercel (requires: vercel CLI installed + authenticated)
  ./scripts/monitor-logs.sh vercel financial-categorization-as-a-service production

  # Supabase (requires: supabase CLI installed + logged in; run from repo root)
  ./scripts/monitor-logs.sh supabase

  # Local log file (tails a file, great for pm2/docker/app logs)
  ./scripts/monitor-logs.sh local /var/log/my-app.log

Notes:
  - For Vercel, if your CLI expects a deployment URL instead of a project name,
    pass the deployment URL as the first argument.
  - For Supabase, you may need to run `supabase link` once in this repo.
EOF
}

cmd="${1:-}"
shift || true

case "$cmd" in
  vercel)
    project="${1:-}"
    env="${2:-production}"

    if ! command -v vercel >/dev/null 2>&1; then
      echo "vercel CLI not found. Install it with: npm i -g vercel" >&2
      exit 1
    fi

    if [[ -z "$project" ]]; then
      echo "Missing project/deployment argument." >&2
      echo "" >&2
      usage
      exit 1
    fi

    echo "Tailing Vercel logs (target: $project, env: $env) ..."
    # Common vercel CLI patterns:
    # - vercel logs <deployment-url> --follow
    # - vercel logs <project> --environment production --follow
    # We try the environment-aware variant first; if it fails, fall back.
    set +e
    vercel logs "$project" --environment "$env" --follow
    status=$?
    set -e
    if [[ $status -ne 0 ]]; then
      echo "Falling back to: vercel logs <target> --follow" >&2
      vercel logs "$project" --follow
    fi
    ;;

  supabase)
    if ! command -v supabase >/dev/null 2>&1; then
      echo "supabase CLI not found. Install it with: brew install supabase/tap/supabase" >&2
      exit 1
    fi

    echo "Tailing Supabase logs ..."
    # Will tail the linked project's logs. If not linked, supabase will prompt.
    supabase logs --follow
    ;;

  local)
    logfile="${1:-}"
    if [[ -z "$logfile" ]]; then
      echo "Missing logfile path." >&2
      echo "" >&2
      usage
      exit 1
    fi
    if [[ ! -f "$logfile" ]]; then
      echo "Log file not found: $logfile" >&2
      exit 1
    fi
    echo "Tailing local logfile: $logfile"
    tail -n 200 -F "$logfile"
    ;;

  -h|--help|help|"")
    usage
    ;;

  *)
    echo "Unknown command: $cmd" >&2
    echo "" >&2
    usage
    exit 1
    ;;
esac



