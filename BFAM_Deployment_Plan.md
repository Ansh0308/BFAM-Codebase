# BFAM — Beta Deployment Plan (Azure track)

_Written 2026-09-26, updated the same day after the decisions in §1 and after the deployment blockers were fixed (§4).
Prices and free-tier limits were checked on the vendors' own pages or reputable 2026 comparisons (sources at the end) —
they change often, so re-check the number that matters before you commit money._

**Goal:** put backend + admin web + the app online so 10–50 testers can use it from their own phones (Android **and**
iPhone) and give feedback — for close to ₹0/month, without anyone installing the project.

---

## 1. Decisions taken

| #   | Question                 | Decision                                                                                                                           |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where to host?           | **Azure** (free account). Railway stays the documented fallback (§3).                                                              |
| 2   | Domain?                  | **None for now** — free addresses are fine (`*.cloudapp.azure.com`, `*.azurestaticapps.net`, `*.netlify.app`, `*.r2.dev`).         |
| 3   | Platforms?               | **Android + iPhone.** iPhone plan in §8.                                                                                           |
| 4   | Sign-up OTP in the beta? | **Static code** (`OTP_MODE=static`, default `123456`, nothing is sent). Replacing it with a real SMS provider is documented in §9. |
| 5   | Account owner            | **sportsbfam@gmail.com** for every account (Azure, GitHub, Cloudflare, Netlify, Expo).                                             |
| 6   | Fix blockers first?      | **Yes** — done, see §4.                                                                                                            |

---

## 2. TL;DR

| Question                                    | Answer                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the Azure $200 credit "free for months"? | **No — 30 days only.** After that the account is _disabled_ unless you upgrade to pay-as-you-go. What lasts longer are the **12-month free services**: 750 h/month of a small VM and of MySQL Flexible Server (B1ms, 32 GB). You **must upgrade before day 30** to keep them; you are then billed only for usage _beyond_ the free amounts. |
| What is **not** free on Azure?              | The **public IP address** (a Standard static IPv4 is billed by the hour — roughly $3–4/month, ≈ ₹300; not on Microsoft's free list). New Azure IPs can only be Standard/static — the cheaper dynamic "Basic" SKU was retired. Budget ~₹300/month for it after the first 30 days.                                                            |
| What must run always-on?                    | The backend only (Socket.IO live scoring, a 60-second reminder ticker, Redis presence). Serverless / scale-to-zero hosts break it.                                                                                                                                                                                                          |
| Admin web + mobile web                      | Mobile-web (static) → **Azure Static Web Apps** (always free) or Cloudflare Pages. Admin web (Next.js with dynamic routes, so it can't be a plain static export) → **Netlify free** (commercial use allowed). Vercel Hobby forbids commercial use.                                                                                          |
| Photos / documents                          | **Cloudflare R2** (10 GB free, no egress fees, S3-compatible — supported by the code now).                                                                                                                                                                                                                                                  |
| Getting the app to phones                   | **Mobile-web link** (works on iPhone and Android, zero install) + **Android APK** via Expo EAS (free). **Native iPhone app = $99/year** Apple Developer Program (TestFlight) — until then iPhone testers use the web link (§8).                                                                                                             |
| Blockers                                    | **All ten fixed and tested** (§4). What I could _not_ run here is listed honestly in §12.                                                                                                                                                                                                                                                   |

---

## 3. Options that were compared (backend + database)

| Option                                                                         | Monthly cost                                                                                            | Always-on?                   | Effort                                 | Verdict                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------- | ---------------------------------------------------- |
| **B. Azure free account** — VM (B1s / B2ats v2) + MySQL Flexible Server (B1ms) | **$0 for 12 months + ≈ $3–4 for the public IP** after the 30-day credit; then roughly $20–30 (estimate) | Yes                          | Medium (SSH, Docker — files are ready) | ✅ **Chosen**                                        |
| A. Railway (Hobby $5 plan; MySQL + Redis add-ons)                              | ~$5–10                                                                                                  | Yes                          | Low (git push)                         | Fallback if Azure signup/card fails or setup drags   |
| C. Small VPS in India (Lightsail Mumbai ~$5, DigitalOcean Bangalore ~$6)       | ~₹300–600                                                                                               | Yes                          | Medium (same files work)               | Fallback                                             |
| D. Render free + free MySQL host                                               | $0                                                                                                      | **No** — sleeps after 15 min | Low                                    | ⚠️ Demo only                                         |
| E. Oracle Always Free                                                          | $0                                                                                                      | Yes                          | High                                   | ❌ allowance halved; "out of capacity" errors common |

Rejected for good reasons: Render free (sleeps → live-scoring sockets drop, reminders stop; no MySQL), Koyeb free (0.1 vCPU, scales to zero),
Fly.io (no free tier for new accounts), Cloud Run / any serverless (kills Socket.IO + ticker), TiDB Cloud (not real MySQL — our row-lock scoring
would need a test spike), Aiven free MySQL (1 GB, powers off when idle).

### Azure caveats — read before signing up

- Credit **$200 → 30 days**. Upgrade to pay-as-you-go _before day 30_ (Cost Management → "Upgrade") or everything is disabled. Unused credit is lost after 30 days.
- 12-month free: 750 h each of B1s / B2pts v2 (Arm) / B2ats v2 (AMD) VMs; **Azure Database for MySQL Flexible Server B1ms, 32 GB storage + 32 GB backup**. Always free: Static Web Apps (100 GB bandwidth per subscription).
- Create the free resources **from the portal's "Free services" page** — resources created elsewhere don't default to the free SKU, which is the usual source of surprise bills.
- Set a **budget alert at $5** on day 1 (§11).
- Indian cards occasionally fail the international-transaction check at signup; have a second card ready.
- The B-series VMs have **1 GiB RAM**. The stack fits (Node ~150 MB, Redis 64 MB cap, Caddy ~30 MB) but add swap (step 5 below). If it feels cramped, B2ats v2 (2 vCPU) helps CPU but not RAM.

---

## 4. Deployment blockers — all fixed

Each was verified by running it, not just by reading code. Tests: backend 716, mobile 333, web 50 — all passing; `tsc --noEmit` clean in every workspace.

| #       | Severity    | Was                                                                                              | Fixed in                                                                                                                                             | Verified by                                                                                                          |
| ------- | ----------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **B1**  | 🔴 Critical | `POST /auth/dev-token` handed an **ADMIN token to anyone** in production (also `/debug-sentry`). | `7c4c462` — 404 unless `NODE_ENV` is explicitly `development`/`test`; unknown/unset `NODE_ENV` counts as production; `JWT_SECRET` required.          | Booted the compiled server with `NODE_ENV=production`: 404. Tests.                                                   |
| **B2**  | 🟠 High     | No `trust proxy` → rate limiters saw one client for every tester.                                | `58d3aa8` — opt-in `TRUST_PROXY=1` (compose sets it).                                                                                                | Tests with/without the header.                                                                                       |
| **B3**  | 🟠 High     | `next build` crashed (React 18 vs 19 mismatch in the monorepo).                                  | `e63ff00` — admin web on Next 15 / React 19; `NEXT_DIST_DIR` so a dev server and a build don't clash.                                                | `next build` succeeds; web tests pass.                                                                               |
| **B4**  | 🟠 High     | Mobile-web called `https://<page-host>:5000`.                                                    | `4b8b078` — uses `EXPO_PUBLIC_API_URL` baked in at build time. `a6b0578` adds SPA-fallback host config + `npm run export:web`.                       | Export with the variable set: the URL is inlined in the entry bundle, and both host config files land in the output. |
| **B5**  | 🟠 High     | Booking times followed the server's timezone (UTC cloud → 5.5 h off).                            | `b824344`, `df0accc` — booking instants use an explicit `+05:30`; "today" is the Indian date in every query.                                         | Tests pass under both `TZ=UTC` and the local zone.                                                                   |
| **B6**  | 🟡 Medium   | Migration history keyed by `.ts`/`.js` extension — a dev-migrated DB refused the compiled build. | `9464d13` — extension-agnostic storage.                                                                                                              | Both directions on a real MySQL.                                                                                     |
| **B7**  | 🟡 Medium   | No TLS to the database (Azure MySQL requires it).                                                | `c6c88df` — `DB_SSL=true` (+ optional `DB_SSL_CA[_BASE64]`).                                                                                         | Unit tests. **Not run against Azure MySQL itself** (§12).                                                            |
| **B8**  | 🟡 Medium   | Storage was AWS-only and staff ID documents were **public**.                                     | `8a0f3c8` — `S3_ENDPOINT` / `S3_PUBLIC_BASE_URL` (R2); IDs go to a private bucket, DB holds an `s3://` reference, owners get 15-minute signed links. | Unit tests with a mocked S3 client. **Not run against real R2** (§12).                                               |
| **B9**  | 🟡 Medium   | No Dockerfile / deploy pipeline.                                                                 | `4b40937` — `apps/backend/Dockerfile`, `.dockerignore`, `deploy/` (compose + Caddy + env template), `.github/workflows/deploy-backend.yml`.          | Emulated the image steps on a clean checkout — see below.                                                            |
| **B10** | 🟡 Medium   | Seeds had well-known passwords and fake players.                                                 | `0b1bb68` — `db:seed:beta` (2 turfs, 1 admin, 1 owner, random or supplied passwords) and demo seeds refuse to run in production.                     | Ran the **compiled** seed against an empty migrated DB; re-run skips.                                                |
| B11     | ⚪ Low      | Socket.IO accepted any origin.                                                                   | `ab5ed9b` — one `CORS_ORIGIN` allowlist for REST _and_ Socket.IO (+ boot warning if unset).                                                          | Compiled server: allowed origin gets the header, others don't.                                                       |
| —       | (beta)      | Static OTP                                                                                       | `a869958` — explicit `OTP_MODE=static`, loud boot warning.                                                                                           | Tests; boot log shows the warning.                                                                                   |

**What the Docker check actually covered (Docker isn't installed on this machine):** on a clean checkout I ran the same steps the
Dockerfile runs — `npm ci` for backend + shared packages only (877 packages, 22 s), `tsc`, a **production-only install** (203 MB;
`npm prune` had pulled the whole Expo/Next tree back in, 1.3 GB, so the Dockerfile uses a separate `npm ci --omit=dev`), bcrypt's native
binary built and loaded — then booted `dist/` with the settings from `deploy/azure.env.example` against an empty MySQL:
**30/30 migrations applied, `/health` 200, `dev-token` 404, CORS allowlist honoured, beta seed + admin login + turf list worked, and an
unreachable Redis didn't stop the boot.** The `Dockerfile` text itself, the compose file, Caddy and the GitHub workflow have **not** been executed.

---

## 5. Architecture (what runs where)

```
Testers' phones ─► Mobile-web (Azure Static Web Apps)     ─┐
   iPhone: Safari  Android APK (Expo EAS)                  ├─► https://bfam-beta.<region>.cloudapp.azure.com
   Android: APK/web Admin web (Netlify)                    ─┘        │
                                                          Azure VM (Ubuntu, Docker):
                                                            Caddy :443 ─► backend (Node + Socket.IO) ─► Redis (tiny)
                                                                                 │
                                                          Azure Database for MySQL Flexible Server (TLS, firewalled to the VM)
                                                          Cloudflare R2: bfam-public (photos) · bfam-private (staff IDs, signed links)
   Sentry (errors) · Brevo (email) · Razorpay TEST mode
```

- **HTTPS everywhere** is mandatory (Android release builds block plain HTTP). Caddy fetches its own free certificate for the `cloudapp.azure.com` name.
- **Region:** the one nearest your testers where B-series VM _and_ MySQL B1ms are both offered (try **Central India**; else South India / Southeast Asia). Keep everything in one region.
- One environment, `beta`. No staging until testers exist.
- Secrets live in `backend.env` on the VM and in GitHub Secrets — never in git.

---

## 6. Azure runbook

`[you]` = needs your login / card / a decision (I can't create accounts or enter payment or credentials for you).
`[repo]` = the file that already exists for that step.

> **One-command route (used for the first deployment, 2026-09-26):** after `az login`, run
> `powershell -ExecutionPolicy Bypass -File .\deploy\deploy-azure.ps1` from the repo root. It does the provisioning, configuration, seeding and
> mobile-web publishing below in about 10 minutes (resource group, static IP + DNS name, firewall, VM via `deploy/cloud-init.yaml`, MySQL,
> Static Web App) and is safe to re-run. It reads secrets from `%USERPROFILE%\bfam-secrets\` (outside the repo). **South India** was used
> because Central India restricts the free VM size for new subscriptions — check with `az vm list-skus` before choosing a region. Database TLS
> verification worked with the default CA store (no fallback needed). Storage (R2), the admin web and the APK are not part of that script.

### Step 0 — Accounts (all under sportsbfam@gmail.com) `[you]`

Azure free account (phone + card), Cloudflare (R2), Netlify, Expo, and the GitHub repo that holds this code. Turn on 2-step verification on each.

### Step 1 — Azure account safety `[you]`

1. Sign up at azure.microsoft.com/free.
2. Portal → **Cost Management → Budgets** → monthly budget **$5**, e-mail alert to sportsbfam@gmail.com.
3. Put a calendar reminder for **day 25**: "upgrade to pay-as-you-go or Azure disables everything on day 30."

### Step 2 — MySQL `[you]`

Portal → **Free services** → _Azure Database for MySQL Flexible Server_:

- Resource group `bfam-beta`, region as in §5, **Burstable B1ms**, **MySQL 8.0**, **32 GB**, no high availability.
- Admin user `bfamadmin` + a long random password (save in your password manager).
- Networking: _Public access_. Leave the firewall for now; step 4 adds the VM's IP.
- After creation: **Databases → Add** → `bfam` (utf8mb4). Keep `require_secure_transport = ON` (default) — the backend connects with `DB_SSL=true`.
- Backups are automatic (7 days). Do one **restore test** in week 1.

### Step 3 — Virtual machine `[you]`

Portal → **Free services** → Virtual machine:

- **Ubuntu Server 24.04 LTS**, size **B2ats v2** (or B1s) — one of the free three, same region as MySQL.
- SSH public-key login (`ssh-keygen -t ed25519`; paste the `.pub`).
- Public IP: **Standard, static** (the only choice now). In the IP's _Configuration_ set **DNS name label** `bfam-beta` → `bfam-beta.<region>.cloudapp.azure.com`.
- Network security group inbound: **22** (restrict to your own IP), **80**, **443**.
- Disk: default Standard SSD.

### Step 4 — Let the VM reach MySQL `[you]`

MySQL server → **Networking** → firewall rule: the VM's public IP only (it's static, so this is stable). Add your own IP temporarily if you want to inspect the DB.

### Step 5 — Prepare the VM `[you]`

```bash
ssh <user>@bfam-beta.<region>.cloudapp.azure.com
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER            # log out and back in afterwards
# 2 GB swap — the VM has 1 GiB RAM
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo mkdir -p /opt/bfam && sudo chown $USER /opt/bfam
```

### Step 6 — Storage `[you]`

Cloudflare → R2 → create **`bfam-public`** (enable the `r2.dev` public URL) and **`bfam-private`** (keep it non-public). Create an **API token** (Object Read & Write, both buckets). Note: account ID, access key ID, secret, the public `r2.dev` URL. (Cloudflare may ask for a card to enable R2; you're not charged inside the free limits — check at signup.)

### Step 7 — Configure the backend `[repo: deploy/azure.env.example]`

On the VM:

```bash
cd /opt/bfam
echo 'SITE_ADDRESS=bfam-beta.<region>.cloudapp.azure.com' > .env
nano backend.env      # paste deploy/azure.env.example and fill it in
```

Fill in: `DB_HOST` (`<server>.mysql.database.azure.com`), `DB_USER=bfamadmin`, `DB_PASSWORD`, `DB_NAME=bfam`, `DB_SSL=true`;
`JWT_SECRET` (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`); `CORS_ORIGIN` (the two web addresses from
steps 10–11, comma-separated, no trailing slash — fill after they exist); the R2 values (`AWS_REGION=auto`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`, bucket names, keys).
Leave `OTP_MODE=static` for the beta (§9). Optional: `SENTRY_DSN`, Razorpay **test** keys, Brevo.

### Step 8 — First deploy `[repo: .github/workflows/deploy-backend.yml, deploy/docker-compose.azure.yml]`

1. In the GitHub repo → **Settings → Secrets and variables → Actions**:
   secrets `DEPLOY_HOST` (the DNS name), `DEPLOY_USER`, `DEPLOY_SSH_KEY` (a _deploy-only_ private key — generate a separate pair and add its `.pub` to the VM's `~/.ssh/authorized_keys`), `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan -t ed25519 <DEPLOY_HOST>`); variable `DEPLOY_ENABLED = true`.
2. Push to `main` (or **Actions → Deploy backend → Run workflow**). The workflow builds the image, pushes it to GitHub Container Registry, copies the compose files, pulls, restarts, and polls `https://<DEPLOY_HOST>/health`.
3. **Manual fallback** (also how to do the very first start if you prefer): on the VM, `docker login ghcr.io` (a token with `read:packages`), copy `deploy/docker-compose.azure.yml` and `deploy/Caddyfile` to `/opt/bfam`, then
   `BACKEND_IMAGE=ghcr.io/<owner>/bfam-backend:latest docker compose -f docker-compose.azure.yml up -d`.
4. Watch it: `docker compose -f docker-compose.azure.yml logs -f backend` — expect _"Applying 30 pending migration(s)"_ on the first boot, then _"listening on port 5000"_. The `[SECURITY] OTP_MODE=static` warning is expected.
5. From your phone on mobile data open `https://<host>/health`.

### Step 9 — Beta data `[repo: apps/backend/src/seed/betaSeed.ts]`

```bash
cd /opt/bfam
docker compose -f docker-compose.azure.yml run --rm \
  -e BETA_ADMIN_PASSWORD='<choose one>' -e BETA_OWNER_PASSWORD='<choose one>' \
  backend node dist/seed/betaSeed.js
```

Creates one admin (`+919000000001`), one turf owner (`+919000000002`) and two bookable turfs; nothing else. Omit the password variables to have random
ones generated and printed **once**. Safe to re-run (it skips if the admin exists). Never run `db:seed:phase1` / `db:seed:demo` on this database.

### Step 10 — Mobile-web (also the iPhone route) `[repo: apps/mobile]`

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://bfam-beta.<region>.cloudapp.azure.com npm run export:web
```

(Use the script — it passes `--clear`; without it Metro can keep an old API address baked in.) Deploy `dist/` to **Azure Static Web Apps** (Free plan — create the app in the portal, then `npx @azure/static-web-apps-cli deploy ./dist --deployment-token <token>`, or connect the GitHub repo) —
the export already contains `staticwebapp.config.json` so deep links and refresh work — or to Cloudflare Pages (no config needed) or Netlify (`_redirects` included).
Then add the resulting `https://….azurestaticapps.net` to `CORS_ORIGIN`.

### Step 11 — Admin web `[repo: apps/web]`

Netlify → new site from the GitHub repo: base directory `apps/web`, build command `npm run build`, environment `NEXT_PUBLIC_API_URL=https://bfam-beta.<region>.cloudapp.azure.com`
(it is read at build time, so changing it means a redeploy). Add the `https://….netlify.app` address to `CORS_ORIGIN`, then on the VM `docker compose -f docker-compose.azure.yml up -d` to apply it.

### Step 12 — Smoke test `[you + me]`

From a phone on mobile data: sign up (OTP `123456`), book a turf, create a match, score it, watch it live on a second phone, upload a profile photo, log into the admin site as the seeded admin.

---

## 7. Android APK (Expo EAS) `[you + me]`

EAS free plan: ~15 Android + 15 iOS builds/month (low-priority queue), OTA updates for 1,000 MAU.
Needs: an Expo account, `eas.json` with a `preview` profile that sets `EXPO_PUBLIC_API_URL`, and (for Sentry) an auth token — **not in the repo yet; I can add it when you're ready.**
Then `eas build -p android --profile preview` → a share link testers open on their phone. JS-only fixes ship instantly with **EAS Update**, no reinstall.
Razorpay checkout, camera QR check-in, push and contacts work only in the native app, not in mobile-web.

---

## 8. iPhone

| Route                       | Cost                                                                                                               | What testers do                                          | Notes                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile-web (start here)** | $0                                                                                                                 | Open the link in **Safari → Share → Add to Home Screen** | Full booking / match / live-score flow. No native payments, camera QR check-in, push or contacts. Icon/splash on the home screen still needs a small polish pass (apple-touch-icon, safe-area `viewport-fit`) — worth doing while you're perfecting the app.                                          |
| **TestFlight (native)**     | **$99/year** Apple Developer Program — required for any real iOS build (EAS or otherwise; there is no free option) | Install via a TestFlight invite                          | Needs the Apple account (under sportsbfam@gmail.com), a bundle ID (`com.bfam.mobile` is already set), a Mac is **not** required (EAS builds in the cloud). Also unlocks Sign in with Apple, which `app.json` already enables. 1–2 days once the account is approved (Apple's approval can take days). |

Recommendation: run the first feedback round on mobile-web + Android APK; enrol in the Apple program when iPhone feedback shows the web version isn't enough.

---

## 9. Sign-up OTP: static now, real SMS later

**How the beta works.** With `OTP_MODE=static` (in `backend.env`) every OTP is the fixed `STATIC_OTP_CODE` (default **`123456`**, exactly 6 digits). Nothing is sent by SMS or email;
the API returns the code and the app shows it, so testers can finish sign-up and password reset with no provider. The server prints a `[SECURITY]` warning at every start.

> ⚠️ **Security risk you are accepting:** anyone who knows the code can verify _any_ phone number and **reset any account's password**. Use it only for an
> invite-only beta with people you know, on a URL you don't publish, with no real money and no sensitive data. Tell testers to use throwaway passwords.
> Change the code any time by editing `STATIC_OTP_CODE` and restarting.
>
> **This repository is public and the default code is written in it, so set your own private `STATIC_OTP_CODE` on the server before sharing the link**
> (edit `/opt/bfam/backend.env`, then `docker compose -f docker-compose.azure.yml up -d`). Also: an account is only as safe as its phone number is
> secret — anyone who knows a tester's (or the admin's) phone number and the code can reset that account.

### Replacing it with a real provider (MSG91, already wired in the code)

1. **DLT registration (start early — days to weeks).** India requires it for any transactional SMS. Register the business as a **Principal Entity** on your chosen telecom operator's DLT portal (Jio, Airtel, Vi or BSNL — PAN and business documents needed), then register a **sender ID / header** (6 letters, e.g. `BFAMSP`) and a **content template** for the OTP, e.g. `Your BFAM verification code is {#var#}. It is valid for 5 minutes.`
2. **MSG91:** create an account, complete KYC, add your DLT entity ID, header and template, and create a **Flow** for that template. The code sends the code in a variable named **`OTP`** (in MSG91's template: `##OTP##`), so the Flow's variable must be called that.
3. From MSG91 collect the **Auth Key**, the **Flow ID**, and the **Sender ID**.
4. On the VM edit `backend.env`: set `MSG91_AUTH_KEY`, `MSG91_FLOW_ID`, `MSG91_SENDER_ID`, and **delete the `OTP_MODE` and `STATIC_OTP_CODE` lines**.
5. Restart: `docker compose -f docker-compose.azure.yml up -d`. The `[SECURITY] OTP_MODE=static` warning disappears and `dev_otp` is no longer returned by the API.
6. Test with a real number (sign-up and forgot-password). Existing accounts and passwords are unaffected.
7. Optional: email OTP through Brevo (already supported for the profile-email flow) as a backup channel.

Code references: `apps/backend/src/config/otpMode.ts`, `services/otpService.ts`, `services/smsService.ts`.

---

## 10. Storage and third-party services

### Images & documents — Cloudflare R2

- Free: 10 GB, 1 M writes + 10 M reads/month, $0 egress; beyond that ≈ $0.015/GB-month. Profile photos are ~200 KB, so 10 GB ≈ 50 k photos.
- **Two buckets:** `bfam-public` (profile photos) and `bfam-private` (staff ID documents — never public; owners get 15-minute signed links).
- Cloudinary is the alternative if you later want automatic resizing/CDN for turf galleries; it needs a different SDK and code path.

### Per integration

| Service                    | Beta approach                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Razorpay**               | **Test-mode** keys (no KYC), webhook → `https://<host>/…` in the Razorpay dashboard. Gateway payments work **only in the native app**, not mobile-web. |
| **SMS OTP**                | Static code now (§9).                                                                                                                                  |
| **Email (Brevo)**          | Free 300/day. Verify the sender address; set `BREVO_*`.                                                                                                |
| **Sentry**                 | Free tier; set DSNs (backend, web, mobile).                                                                                                            |
| **Push (Expo)**            | Skip for beta (in-app notification list exists). Android push needs Firebase + `google-services.json` in the EAS build; iOS needs the Apple account.   |
| **Google / Apple sign-in** | Google: create OAuth client IDs. Apple: needs the paid Apple account — skip for now.                                                                   |
| **Redis**                  | Included in the compose file (tiny) for the "N watching" badge; the backend runs without it.                                                           |

---

## 11. Rollout plan and cost guardrails

| Phase                  | Work                                                                                              | Who                                                | Done when                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| **0 — Deployable**     | B1–B11, Docker, workflow, beta seed, static OTP                                                   | me — ✅ **done**                                   | tests green; compiled build boots on an empty DB (§4)                |
| **1 — Backend online** | Runbook steps 1–9                                                                                 | you (portal/keys) + me (troubleshooting from logs) | `/health` OK from a phone on mobile data; a match can be scored      |
| **2 — Web + storage**  | Steps 6, 10, 11                                                                                   | you + me                                           | Admin logs in on the public URL; photo upload works; ID docs private |
| **3 — Android APK**    | §7 (`eas.json`, first build)                                                                      | me writes config; you run the Expo login           | A tester installs and logs in unaided                                |
| **4 — Invite testers** | 10–20 people; Sentry on; weekly triage                                                            | you                                                | First feedback batch reviewed                                        |
| **5 — Decide**         | Apple $99 (TestFlight), Play internal track ($25), MSG91 live (§9), custom domain, bigger hosting | you                                                | —                                                                    |

**Cost guardrails (day 1):** Azure budget alert **$5**; check the _Free services_ grid weekly; **upgrade before day 30**; note the public-IP charge (~₹300/month) starts once the credit is gone;
`DB` backups are automatic — do one restore test; Cloudflare free-tier alerts on; keep the beta invite-only so nobody uploads junk; tell testers it's a beta and data may be reset.

**Tester onboarding page:** (a) the mobile-web link (iPhone: Safari → Add to Home Screen), (b) the APK link (Android), (c) "sign-up code is 123456", (d) how to report a bug, (e) "use a throwaway password".

---

## 12. What I have not verified — be aware

- **Docker / GitHub / Azure were not run.** No Docker on this machine, no Azure or GitHub-Actions access: the `Dockerfile`, compose file, Caddyfile and workflow are reviewed and their steps emulated, but the first real run may surface small fixes. The YAML parses; the SSH step is the likeliest to need a tweak.
- **Azure Database for MySQL** was never connected to. The TLS option is unit-tested; the migrations were run on a local MySQL 8. If a migration fails on Azure, send me the log.
- **Cloudflare R2** was never called (S3 client is mocked in tests). Expect to double-check the `S3_PUBLIC_BASE_URL` and the API-token scope.
- **Public-IP price and B-series RAM:** the ~$3–4/month figure is an estimate (Microsoft's free list doesn't include a public IP); confirm in the Azure pricing calculator.
- **Static Web Apps / Netlify** settings above are from their documentation; I haven't deployed to them.
- **`next build` for the admin web passes** with Next 15, but the deployed admin site hasn't been exercised against a remote API yet — first login is the test.
- On your own machine: **restart your running web dev server** once (Next/React upgrade), and use `npm run db:seed:beta` — not the old demo seeds — for any shared database.

---

## Sources

- Azure free account — [what's free & the 30-day credit](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/create-free-services), [free account FAQ / service list](https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account), [avoiding charges](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/avoid-charges-free-account), [MySQL Flexible Server on a free account](https://learn.microsoft.com/EN-us/azure/mysql/flexible-server/how-to-deploy-on-azure-free-account), [Basic public IP retirement](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/public-ip-addresses)
- Render — [free-tier docs](https://render.com/docs/free) · Railway — [plans](https://docs.railway.com/pricing/plans) · Koyeb — [pricing FAQ](https://www.koyeb.com/docs/faqs/pricing) · Oracle — [free-tier change](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
- Databases — [TiDB Cloud](https://docs.pingcap.com/tidbcloud/select-cluster-tier/), [Aiven free MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)
- Storage — [Cloudflare R2](https://www.cloudflare.com/products/r2/), [Cloudinary plans](https://cloudinary.com/documentation/billing_and_plans)
- Web hosting — [Netlify credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- Mobile — [Expo plans](https://docs.expo.dev/billing/plans/), [iOS builds need an Apple Developer account](https://docs.expo.dev/submit/testflight/), [Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
