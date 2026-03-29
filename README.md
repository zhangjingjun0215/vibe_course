# Minimal Next.js + Supabase Demo

This worktree contains a minimal message board built with:

- Next.js 16 App Router
- Tailwind CSS 4
- Supabase PostgreSQL
- A single Route Handler at `src/app/api/messages/route.ts`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in your Supabase values in `.env.local`:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

4. Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor.

5. Start the development server:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Supabase Notes

- The app reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- It also accepts `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for compatibility.
- The Route Handler uses a low-privilege key, so the included SQL enables read and insert policies for the `anon` role.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## Deployment To Vercel

This project is deployable now. The guestbook API and database writes are working against Supabase.

### Option A: Git-based deployment

Vercel automatically detects Next.js projects when you import a repository.

1. Push this worktree to a Git provider such as GitHub.
2. In the Vercel dashboard, create a new Project and import that repository.
3. Keep the detected framework as Next.js.
4. Add these Environment Variables for Production, Preview, and Development:

```bash
SUPABASE_URL=https://zupeqwilhojgbynexvtd.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

5. Deploy the project.

### Option B: CLI deployment

If you do not want to push to Git yet, you can deploy directly from the project root:

```bash
npm i -g vercel
vercel
vercel --prod
```

### Current repository note

This worktree is on the `project1-fullstack` branch and currently has no Git remote configured.
If you want Vercel to redeploy on every push, connect it to a remote repository first.

### After deployment

After the first successful deployment:

1. Open the generated `vercel.app` URL.
2. Submit a test message from the deployed site.
3. Confirm the new row appears in the Supabase `messages` table.

### Custom domain

Once the site is live, add your domain from the Vercel project Settings, then open Domains and follow the DNS instructions shown there.
