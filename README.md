# Softsmith — Netlify

## Deploy in 2 minutes
1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect the GitHub repo: `muradabbaszade098-cloud/softsmith`
3. Leave build settings as-is (`netlify.toml` already configures them):
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions`
4. Click **Deploy site**

Or with the CLI:
```bash
npm install
npx netlify login
npx netlify init
npx netlify deploy --prod
```

## Preorder emails (JSON)
- Form posts to `/api/preorder` (Netlify Function)
- Production: emails are stored as JSON in **Netlify Blobs** (`preorders.json`)
- Local `netlify dev`: also written to `data/preorders.json`
- View the list: `https://YOUR-SITE.netlify.app/api/preorders`
