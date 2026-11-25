# Feel It — your AI travel agent for India

Feel It plans trips the way a good human travel planner does. You say where you'd like to go; the agent asks what it needs to know (budget, dates, who's coming, food, pace, interests), checks live data, and hands you a trip brief to confirm. It then builds a day-by-day plan with real places, a map, the weather and a budget in rupees, and you can change any part of it by hand or by asking the agent.

```
backend/    FastAPI (Python) API and the AI agent — deploys to FastAPI Cloud
frontend/   React + Vite + Tailwind web app — deploys to Vercel
```

## Features

| Area | What it does |
|---|---|
| **Planning chat** | A conversational agent. It asks its questions as tappable cards (or you type), uses live tools, shows which sources it used, and ends with an editable **trip brief** ("boarding pass"). Answers any other travel question too. |
| **Agent tools** | Live web search, a 16-day weather forecast with air quality, and destination look-ups. Each step is shown as it runs. |
| **Trip builder** | Builds the plan from the confirmed brief using trending places, the weather for your dates, festivals and events, and real map positions. Days are full (4–9 places depending on pace, plus meals), stops are ordered to avoid zig-zagging, every stop starts after the previous one ends plus travel time, and trips from another city start with the outbound journey and end with the return home. |
| **Trip layouts** | Every trip page picks one of six designs from the trip itself: **Cinematic** (nature trips: full-bleed photos, each day told as a chapter), **Map explorer** (city and adventure trips: a big map that follows you as you scroll), **Bento board** (budget trips: numbers first), **Scrapbook** (friends' trips: polaroids, tickets, notes and a receipt budget), **Minimal luxury** (luxury trips: ivory paper, light serif type) and **Night timeline** (the classic view). Colours follow the destination (coast, hills, desert, snow, heritage). "Style" switches layouts; the choice is remembered per trip on that device. Every layout shows the same live data: day plan, travel time between stops, map, weather, budget, journeys, food, stay, events, warnings, packing and tips. |
| **Trip editor** | Edit the name, dates, travellers, style, budget limit and every budget line. Add, edit, reorder, move between days or delete any stop; add or remove days. New or renamed places get map pins and photos when you save. |
| **Trip assistant** | Inside a trip: "make day 2 cheaper", "rain-proof this day", "re-plan this day", or any question. Changes are saved and shown immediately. |
| **My trips** | Upcoming and past trips with countdowns, plus edit and delete on every card. |
| **Explore** | Search any place in India or use your location. Live guides cover trending spots, food, shopping, stays by budget tier, how to get there, and tips. |
| **Trending** | Trending destinations from the web (refreshed daily) and where Feel It travellers are heading this month. |
| **Trip extras** | Weather outlook with rain warnings, budget vs. your limit, festivals during the trip, packing checklist, booking links (IRCTC, redBus, flights, hotels), calendar export (.ics), print / save as PDF, public share link, WhatsApp share. |
| **Trip reminders** | One email per trip, the evening before it starts (from 8 PM India time; catches up until noon on day 1 if a run was missed): day 1 plan with times, the forecast with what to pack for it, packing list, tips and a button to the full plan. Sent with Brevo. Each trip is claimed in the database before sending, so it can never get two. Travellers can switch reminders off in Profile. |
| **Mobile** | Built for phones first: a bottom dock that steps aside while you type, iPhone safe areas, no zoom-on-focus, full-screen trip assistant, one-finger page scrolling over maps, 40px tap targets. Installable to the home screen ("Add to Home screen") with its own app icon. Tablets and laptops get the top navigation. |
| **Accounts** | Email/password (typed twice on sign-up) or Google sign-in. Change your password in Profile after confirming the current one; Google accounts can set a password to sign in with email too. Your profile (home city, style, food preference) becomes the agent's defaults. Guests can chat; saving a trip needs an account, and a guest's brief builds automatically after sign-in. |

## Services (all free tiers)

| Service | Used for | Key |
|---|---|---|
| Google Gemini (Flash-Lite, Flash) | The agent, itineraries and guides | `GEMINI_API_KEY` |
| Groq (`gpt-oss`) | Fast parsing, and fallback when Gemini is busy | `GROQ_API_KEY` |
| Geoapify (OpenStreetMap) | Place search, coordinates, nearby places | `GEOAPIFY_API_KEY` |
| Tavily | Live web search | `TAVILY_API_KEY` |
| Unsplash | Destination cover photos | `UNSPLASH_ACCESS_KEY` |
| Wikipedia / Wikimedia Commons | Photos of individual places | none |
| Open-Meteo | Weather and air quality (non-commercial use) | none |
| OpenStreetMap tiles | The trip map | none |
| Brevo | Trip reminder emails | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` |
| Firebase Authentication | "Continue with Google" | `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_*` |
| MongoDB Atlas (M0) | Users, trips, and the response cache | `MONGODB_URI` |

If one AI provider fails or is overloaded, the request moves to the next one (Gemini Flash-Lite → Groq 120B → Gemini Flash → Groq 20B). Outside data is cached in MongoDB: guides for 7 days, web searches for 1 day, weather for 1 hour, photo links for 30 days. Only links are stored, never images. The cache is what keeps the app fast and inside the free limits.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/agent` | One turn of the planning chat (streams steps, then the message) |
| POST | `/api/trips/plan` | Build a trip from a brief (streams steps, then the trip id) |
| GET / PATCH / DELETE | `/api/trips/{id}` | Read, edit, delete a trip |
| POST | `/api/trips/{id}/chat` | Trip assistant (streams steps, then the updated trip) |
| POST | `/api/trips/{id}/share` | Make a trip public or private |
| GET | `/api/trips`, `/api/trips/shared/{share_id}` | My trips; a shared trip |
| GET | `/api/discover/trending`, `/guide`, `/nearby`, `/weather`, `/autocomplete` | Live discovery |
| POST | `/api/auth/register`, `/login`, `/google`; GET/PATCH `/api/auth/me` | Accounts and profile |
| POST | `/api/auth/password/check`, `/api/auth/password` | Confirm the current password; change it (or set a first one on a Google account) |

AI endpoints are rate limited per hour: `AI_RATE_LIMIT_PER_HOUR` (default 30) for signed-in users and 12 per IP address for guests. Sign-in, sign-up and password checks allow 20 attempts per hour per IP address.

Passwords need 8+ characters with a letter and a number (at most 72 bytes, bcrypt's limit). Changing a password signs out every other session.

## Run locally

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install "fastapi[standard]" pymongo pydantic-settings httpx bcrypt "pyjwt[crypto]" pytest ruff
copy .env.example .env            # then fill in the keys
fastapi dev                       # http://localhost:8000  (API docs at /docs)
pytest                            # unit tests
ruff check app tests              # lint
```

Frontend (Node 18+):

```bash
cd frontend
npm install
copy .env.example .env            # then fill in the values
npm run dev                       # http://localhost:8080
npm run build                     # type-check and production build
```

## Deploy

You need: the code in a Git repository (GitHub, GitLab or Bitbucket) for Vercel, a FastAPI Cloud account, and the keys in `backend/.env`. Never commit `.env` files; the root `.gitignore` already excludes them.

### 1. MongoDB Atlas

Network Access → Add IP address → `0.0.0.0/0` (FastAPI Cloud has no fixed IP). The database user in `MONGODB_URI` needs read/write access to the `feelit` database.

### 2. Backend → FastAPI Cloud

```bash
cd backend
fastapi login
fastapi deploy                                         # first deploy creates the app and prints its URL
python scripts/push_env.py https://<your-app>.vercel.app
fastapi deploy                                         # deploy again with the variables
```

`scripts/push_env.py` copies every value from `backend/.env` to FastAPI Cloud through stdin (keys never appear in your shell history). It marks keys, passwords and the database URI as secrets, and sets `ENVIRONMENT=production` and `CORS_ORIGINS` to your frontend address. You can also set variables by hand: `fastapi cloud env set --secret --no-redeploy NAME`, with the value piped in, or through the FastAPI Cloud dashboard.

Optional: `CORS_ORIGIN_REGEX=https://<your-app>-.*\.vercel\.app` lets Vercel preview deployments call the API too.

In production the app refuses to start if `JWT_SECRET` is shorter than 32 characters or `CORS_ORIGINS` is not an `https://` address. The error is shown in `fastapi cloud logs`. API docs (`/docs`) are switched off in production.

Check it: `https://<your-backend>/health` returns `{"status":"ok"}`.

### 3. Frontend → Vercel

1. Import the repository in Vercel and set **Root Directory** to `frontend` (framework: Vite, detected automatically).
2. Environment variables (Production and Preview):

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-backend>/api` (required; the build stops without an `https://` value) |
   | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | from `frontend/.env` |

3. Deploy. `vercel.json` adds the SPA rewrite, security headers and long caching for hashed assets.
4. If the Vercel address differs from the one you gave `push_env.py`, update `CORS_ORIGINS` (`fastapi cloud env set CORS_ORIGINS https://...`) — it redeploys the backend.

### 4. Trip reminders (Brevo + a free scheduler)

1. In Brevo → Senders, Domains & Dedicated IPs, make sure `BREVO_SENDER_EMAIL` is a verified sender. For the best inbox placement, authenticate your own domain there (SPF/DKIM) and send from it; mail sent "from" a Gmail address may land in Spam or Promotions.
2. While the backend is awake it checks for due reminders every 30 minutes by itself. Because the free FastAPI Cloud plan sleeps when idle, also enable the included GitHub Actions workflow (`.github/workflows/trip-reminders.yml`): in the repository → Settings → Secrets and variables → Actions, add `BACKEND_URL` (your backend address, without `/api`) and `CRON_SECRET` (same value as the backend's). It calls `POST /api/internal/reminders` at 8, 9, 10 and 11 PM India time (most reminders arrive around 8 PM; trips planned later that evening are caught by the next run) and at 8 AM to catch trips planned after 11 PM. That is 5 runs a day, about 150 GitHub Actions minutes a month. Any other scheduler (e.g. cron-job.org) can call the same URL with the `X-Cron-Secret` header.
3. Without `BREVO_API_KEY`, reminders are simply off; everything else works.

### 5. Firebase (Google sign-in)

Firebase console → Authentication → Settings → **Authorized domains** → add your Vercel domain (and any custom domain). Google sign-in is refused on unlisted domains.

### Launch checklist

- [ ] `https://<backend>/health` is ok and `https://<backend>/docs` is 404.
- [ ] The site loads, Trending shows places, and Explore → a place shows its guide.
- [ ] Sign up with email, sign out, sign in again; Continue with Google works.
- [ ] Plan a trip with the agent and build it; it appears in My Trips; edit and delete work.
- [ ] Profile → Change password works; your other devices are signed out.
- [ ] Plan a trip starting tomorrow with your own email: the reminder arrives after 8 PM India time (or run the "Trip reminders" workflow by hand).
- [ ] On a phone: add to home screen, the dock hides while typing, maps scroll with one finger.

## Good to know

- **Free-tier limits.** Tavily's free plan (1,000 searches a month) is the tightest. A new destination costs about 3 searches, then it is cached for a week; building a trip adds one search for festivals and events, and the agent may search when you ask about prices or timings.
- **Cold starts.** FastAPI Cloud's free plan sleeps when idle, so the first request after a pause is slower.
- **Prices are estimates.** No free API offers live Indian train, flight or hotel fares. The app shows AI estimates from web sources and links to IRCTC, redBus, Google Flights and hotel search for real prices.
- **"Influencer" picks** come from web articles and blogs about trending places, not from Instagram itself.
- **Map pins.** A stop gets a pin only when the map service finds that exact place nearby. Small cafés are often missing; their "Open in Maps" link always works.
- **Secrets.** `backend/.env` and `frontend/.env` are git-ignored and excluded from deploys. Never commit them. If a key was ever shared or committed, rotate it at the provider.
- **After each frontend deploy**, open tabs pick up the new version by themselves (a missing page file triggers one automatic reload).
- **Errors.** Unexpected server errors return a JSON message the app can show, and are logged with their stack trace (`fastapi cloud logs`).
