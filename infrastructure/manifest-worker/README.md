# EHA Manifest Worker

This directory contains the Cloudflare Worker that provides a live manifest endpoint for the CPR Trainer Pro app. It lists the contents of the `eha-cpr-media` R2 bucket.

## Deployment Paths

There are two ways to deploy this Worker:

### 1. Dashboard Quick Deploy
1. Log in to the Cloudflare Dashboard.
2. Go to **Workers & Pages** -> **Create application** -> **Create Worker**.
3. Name it `eha-manifest` and deploy the default Hello World.
4. Click **Edit code**, paste the contents of `worker.js`, and click **Deploy**.
5. Go to the Worker's **Settings** -> **Bindings** -> **Add Binding** -> **R2 Bucket**.
6. Set the Variable name to `MEDIA_BUCKET` and select the `eha-cpr-media` bucket. Save and deploy.

### 2. Wrangler Deploy
If you have Node.js and Wrangler CLI installed and authenticated:
1. Open a terminal in this directory (`infrastructure/manifest-worker/`).
2. Run `npx wrangler deploy`.

## Routing Options

After deployment, the Worker needs to be routed to handle requests. There are two options:

### Preferred: Workers Route
Configure a Workers Route on the zone `media.ehacademy.com` to intercept the `/api/*` path.
- **Route**: `media.ehacademy.com/api/*`
- **Worker**: `eha-manifest`

### Fallback: Custom Domain
If the Workers route does not work or intercept properly, configure a Custom Domain for the Worker.
- **Custom Domain**: `api.ehacademy.com`

## Verification Tests

Run these curl commands to decide which routing option was successful and that media serving is untouched.

1. Test the manifest endpoint (expect JSON):
   ```bash
   curl -i https://media.ehacademy.com/api/manifest
   ```
2. Test that media serving is untouched (expect 206 Partial Content):
   ```bash
   curl -i -r 0-0 https://media.ehacademy.com/instructor_manual.pdf
   ```

If the first test fails to return the JSON manifest, fall back to the Custom Domain routing option.
