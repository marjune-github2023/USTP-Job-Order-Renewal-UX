#!/bin/sh
set -eu
# Build the URL at runtime so passwords containing URL punctuation work too.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node -e '
    const {PGHOST, PGPORT="5432", PGUSER, PGPASSWORD, PGDATABASE}=process.env;
    if (![PGHOST,PGUSER,PGPASSWORD,PGDATABASE].every(Boolean)) {
      console.error("Database connection settings are incomplete."); process.exit(1);
    }
    const url=new URL("postgresql://"+PGHOST+":"+PGPORT);
    url.username=encodeURIComponent(PGUSER); url.password=encodeURIComponent(PGPASSWORD);
    url.pathname="/"+encodeURIComponent(PGDATABASE);
    process.stdout.write(url.href);
  ')"
  export DATABASE_URL
fi
exec "$@"
