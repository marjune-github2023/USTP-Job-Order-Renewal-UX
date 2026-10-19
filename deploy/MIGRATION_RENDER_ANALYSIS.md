# Render.com Migration Compatibility Analysis

## Summary

The USTP Job Order Renewal Portal is **fully compatible** with Render.com deployment. The database migration system will work correctly on Render without any code changes to the migration logic itself.

## Why It Works

### 1. Migration Execution Model

The application uses **programmatic migrations** that run on application startup:

- **Location:** `lib/db/src/initialize.ts` → `initializeDatabase()` function
- **Execution:** Called in `artifacts/api-server/src/index.ts` before the server starts listening
- **Method:** Raw SQL with `IF NOT EXISTS` clauses (idempotent)
- **Tracking:** Uses `portal_migrations` table to prevent re-seeding initial data

This approach is ideal for Render because:
- No external migration tools required (no Prisma/Drizzle CLI needed)
- No pre-deploy hooks required
- Migrations run inside the container where database credentials are available
- Idempotent SQL safe to run on every deploy/restart

### 2. Database Connection

Render provides PostgreSQL credentials via environment variables:

- **Render provides:** `DATABASE_URL` automatically when linked to a database
- **Our code expects:** `DATABASE_URL` (set in `lib/db/src/index.ts`)
- **Fallback:** The entrypoint script (`deploy/entrypoint.sh`) can also construct `DATABASE_URL` from individual `PG*` variables

This dual compatibility ensures the connection works regardless of how Render exposes the credentials.

### 3. Docker Compatibility

The existing Dockerfile is compatible with Render's Docker runtime:

- **Platform:** `linux/amd64` - Render uses Linux x64
- **Base image:** `node:24.14.1-trixie-slim` - Compatible with Render
- **Dependencies:** All required tools (pnpm, Python, PyMuPDF) installed during build
- **Health check:** Updated to use `PORT` environment variable (Render sets this)

### 4. Changes Made for Render

#### Files Created:

1. **`render.yaml`** - Render blueprint configuration
   - Defines web service (Docker-based)
   - Defines PostgreSQL database (version 17)
   - Configures environment variables
   - Includes commented disk configuration for production

2. **`deploy/RENDER.md`** - Deployment guide
   - Step-by-step deployment instructions
   - Post-deployment configuration steps
   - Troubleshooting guide
   - Cost estimates

#### Files Modified:

1. **`Dockerfile`** - Minor compatibility updates
   - Removed hardcoded `PORT=8080` from ENV (now uses Render's PORT)
   - Updated health check to use `PORT` environment variable with fallback to 8080

These changes maintain backward compatibility with Docker Compose while enabling Render deployment.

## Migration Flow on Render

```
1. Render builds Docker image (uses Dockerfile)
   ↓
2. Render starts container with environment variables
   - DATABASE_URL (from PostgreSQL service)
   - PORT (Render's default, typically 10000)
   - EMAIL_SETTINGS_KEY, etc.
   ↓
3. Entrypoint script runs (deploy/entrypoint.sh)
   - Ensures DATABASE_URL is set (already set by Render)
   ↓
4. Application starts (artifacts/api-server/src/index.ts)
   ↓
5. initializeDatabase() runs (lib/db/src/initialize.ts)
   - Creates all tables with IF NOT EXISTS
   - Seeds initial office data (tracked by portal_migrations)
   ↓
6. Server starts listening on PORT
   ↓
7. Health check passes
   ↓
8. Application ready for requests
```

## Key Differences from Docker Compose

| Aspect | Docker Compose | Render |
|--------|---------------|--------|
| Database | Local container in same network | Managed service, connected via private network |
| Database URL | Constructed from PG* variables | Provided automatically as DATABASE_URL |
| Volume storage | Named volumes (database, recovery) | Managed database, optional disk for recovery |
| PORT | Hardcoded 8080 | Set by Render (typically 10000) |
| HTTPS | Manual with Caddy overlay | Automatic |
| Scaling | Manual | Auto-scaling (paid plans) |

## Testing Checklist

Before deploying to Render:

- [ ] Test Docker build locally: `docker build -t test .`
- [ ] Test Docker Compose locally: `docker compose up --build`
- [ ] Verify migrations run: Check logs for table creation
- [ ] Verify health check: `curl http://localhost:8080/api/healthz`
- [ ] Test HRMO account creation
- [ ] Test applicant registration
- [ ] Test application submission
- [ ] Test PDF generation

After deploying to Render:

- [ ] Check Render build logs for errors
- [ ] Check Render service logs for migration messages
- [ ] Verify health check passes in Render dashboard
- [ ] Test homepage loads at Render URL
- [ ] Create HRMO account via Render shell
- [ ] Test full application workflow
- [ ] Verify email sending (if configured)

## Known Limitations

### Free Tier
- Database is free for 90 days, then $7/month
- Web service has resource limits (512 MB RAM, 0.1 CPU)
- No persistent disk storage (recovery directory uses ephemeral storage)
- Database backups are manual (no point-in-time recovery on free tier)

### Production Recommendations
- Upgrade to paid plans for reliability
- Add Render Disk for persistent backup recovery copies
- Set up off-server backup strategy
- Consider multi-instance deployment with shared rate limiting
- Monitor resource usage and scale as needed

## No Migration Code Changes Required

The migration logic in `lib/db/src/initialize.ts` does **not** need any changes:

- It already uses standard PostgreSQL connection string
- It already uses idempotent SQL
- It already handles the migration tracking table
- It already runs before the server starts
- It already works with environment variables

The only changes needed were:
1. Create `render.yaml` for Render configuration
2. Update Dockerfile to use `PORT` environment variable instead of hardcoded value
3. Document the deployment process

## Conclusion

The migration system is **Render-ready**. The programmatic approach to migrations (running on startup with idempotent SQL) is actually better suited for Render than traditional migration tools that require separate deploy hooks. The application will successfully initialize its database schema on first deployment and will safely skip re-initialization on subsequent deployments.
