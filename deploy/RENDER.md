# Deploy to Render.com

This guide explains how to deploy the USTP Job Order Renewal Portal to Render.com using the provided `render.yaml` blueprint.

## Prerequisites

- A Render.com account (free tier available)
- Git repository with the code pushed to GitHub/GitLab/Bitbucket
- Basic understanding of Render.com services

## Quick Start

### 1. Connect Your Repository

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Blueprint**
3. Connect your GitHub/GitLab/Bitbucket account
4. Select the repository containing this project
5. Select the `render.yaml` file

### 2. Review and Deploy

1. Review the blueprint configuration:
   - **Web Service:** Docker-based deployment
   - **Database:** PostgreSQL 17 (free tier)
   - **Region:** Oregon (change if needed)
2. Click **Apply** to create the resources
3. Wait for the build and deployment to complete (5-10 minutes)

### 3. Configure After Deployment

#### Set EMAIL_SETTINGS_KEY

1. Go to the **ustp-portal** web service in Render dashboard
2. Click **Environment** tab
3. Find `EMAIL_SETTINGS_KEY` and note the generated value
4. **Important:** Save this value securely. It must remain the same across deployments for Google email credentials to work.
5. If you need to regenerate it, you'll need to reconnect Google OAuth in the HRMO settings.

#### Update PUBLIC_APP_URL

1. After deployment, note your Render service URL (e.g., `https://ustp-portal-xxxx.onrender.com`)
2. Go to **Environment** tab
3. Update `PUBLIC_APP_URL` to match your actual Render URL
4. Redeploy the service

#### Optional: Configure Email

Option 1: Resend (Server-configured)
1. Get a Resend API key from [resend.com](https://resend.com)
2. Set `RESEND_API_KEY` in Environment variables
3. Set `EMAIL_FROM` to your verified sender address

Option 2: Google OAuth (HRMO-configured)
1. Set up Google Cloud project and OAuth credentials (see main README)
2. Configure in HRMO Email settings after the portal is running
3. Use the Render URL for the OAuth callback

### 4. Create First HRMO Account

After deployment, use the Render shell to create the initial HRMO account:

1. Go to **ustp-portal** service → **Shell** tab
2. Run:
   ```bash
   read -r -p 'HRMO email: ' HRMO_EMAIL
   read -r -p 'HRMO display name: ' HRMO_NAME
   read -r -s -p 'HRMO password (12–128 characters): ' HRMO_PASSWORD
   printf '\n'
   export HRMO_EMAIL HRMO_NAME HRMO_PASSWORD
   node /app/api/create-hrmo.mjs
   unset HRMO_EMAIL HRMO_NAME HRMO_PASSWORD
   ```

3. Sign in with the HRMO account at your Render URL

## Migration Behavior

The application runs database migrations automatically on startup:

- **Location:** `lib/db/src/initialize.ts`
- **Timing:** Before the API server starts listening
- **Method:** Idempotent SQL with `IF NOT EXISTS` clauses
- **Tracking:** Uses `portal_migrations` table to prevent re-seeding

This approach works on Render because:
1. Render provides `DATABASE_URL` environment variable
2. The entrypoint script (`deploy/entrypoint.sh`) handles both `DATABASE_URL` and individual `PG*` variables
3. The migration runs inside the container before the web server starts
4. No external migration tools or pre-deploy hooks are required

## Verification Checklist

After deployment, verify:

- [ ] Render service shows "Available" status
- [ ] Health check endpoint responds: `https://your-url.onrender.com/api/healthz`
- [ ] Homepage loads in browser
- [ ] Can register an applicant account
- [ ] Can sign in with HRMO account
- [ ] Can submit an application
- [ ] HRMO can review applications
- [ ] PDF generation works (requires Python/PyMuPDF)
- [ ] Email sending works (if configured)

## Troubleshooting

### Build Fails

Check the build logs in Render dashboard:
- Dockerfile platform compatibility
- npm/pnpm installation issues
- Python/PyMuPDF installation

### Database Connection Errors

- Verify the database is in the same region as the web service
- Check that `DATABASE_URL` is correctly linked from the database
- Ensure PostgreSQL version 17 is used

### Migrations Not Running

- Check application logs for "database is provisioned" or initialization messages
- Verify `DATABASE_URL` is set correctly
- Ensure the entrypoint script is running

### PDF Generation Fails

- Check that `PDF_PYTHON` points to `/opt/pdf/bin/python`
- Verify PyMuPDF is installed in the Docker image
- Check application logs for Python-related errors

### Email Not Sending

- Verify `EMAIL_SETTINGS_KEY` is set
- For Resend: check API key and sender configuration
- For Google: ensure OAuth is connected in HRMO settings
- Check `PUBLIC_APP_URL` is correct for reset links

## Scaling

For production deployment:

1. **Upgrade Plans:**
   - Change web service plan from `free` to `starter` or `standard`
   - Change database plan from `free` to a paid tier for better performance

2. **Enable Features:**
   - **Disk storage for recovery directory** (currently uses ephemeral storage)
     - Add a Render Disk to the web service for persistent backup recovery copies
     - Mount path: `/var/lib/ustp/backups`
     - Size: 10 GB minimum (adjust based on expected backup volume)
   - Read replicas for database if needed
   - Automatic backups (Render includes point-in-time recovery for paid databases)

3. **Considerations:**
   - The health check uses `localhost` - may need adjustment for multi-instance deployments
   - Rate limiting is per-process - shared state needed for multiple instances
   - Database volume backups are manual - set up off-server backup strategy

## Differences from Docker Compose

| Feature | Docker Compose | Render |
|---------|---------------|--------|
| Database | Local container with volume | Managed PostgreSQL service |
| Recovery directory | Named volume | Ephemeral storage (consider disk add-on) |
| HTTPS | Optional with Caddy overlay | Automatic with HTTPS certificate |
| Environment | `.env.docker` file | Render dashboard / render.yaml |
| Scaling | Manual (docker compose scale) | Render auto-scaling (paid plans) |
| Backups | Manual pg_dump | Point-in-time recovery (paid databases) |

## Cost Estimate (Free Tier)

- **Web Service:** Free (512 MB RAM, 0.1 CPU)
- **Database:** Free (90 days, then $7/month)
- **Total:** Free for 90 days, then ~$7/month

For production, estimate:
- **Starter Web Service:** $7/month
- **Starter Database:** $7/month
- **Total:** ~$14/month (plus overages)

## Support

For issues specific to Render.com:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
- Check Render service logs in the dashboard

For application issues:
- Check application logs in Render dashboard
- Review the main README.md for configuration details
- Test locally with Docker Compose first
