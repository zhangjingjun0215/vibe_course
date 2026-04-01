# Field Notes Guestbook

This worktree now ships a simpler moderation model:

- anyone can read and post anonymously
- only the admin session can delete messages
- the admin dashboard lives at `/admin`
- rate limits are enforced by a server-side request fingerprint

The app no longer depends on Supabase Auth or email magic links.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in the required values:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
ADMIN_PASSWORD=choose-a-long-random-password
SUPABASE_SECRET_KEY=your-server-side-supabase-secret
```

`SUPABASE_SECRET_KEY` can also be provided as `SUPABASE_SERVICE_ROLE_KEY`.
Keep this key server-only. Do not expose it in the browser or commit it to Git.

4. Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor.

This upgrade is required even if you already created an earlier `messages` table. The new SQL:

- adds `updated_at`
- adds `author_key`
- keeps public reads enabled
- allows anonymous inserts
- removes public update and delete permissions

5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Runtime model

- The public board uses the low-privilege Supabase publishable key.
- The moderator dashboard and delete actions use a server-only Supabase secret key.
- Entering admin mode sets an HttpOnly cookie after the password is verified by the server.
- No email delivery or Supabase Auth configuration is required.

## API summary

- `GET /api/messages`
  returns the public feed and the current viewer mode
- `POST /api/messages`
  creates an anonymous message and applies the posting limits
- `DELETE /api/messages/[messageId]`
  deletes a message when the admin session is active
- `POST /api/admin/session`
  enables admin mode with the configured password
- `DELETE /api/admin/session`
  clears the admin session
- `GET /api/admin/messages`
  returns moderation data for the admin dashboard

## Anti-spam defaults

The app currently enforces:

- one post every 20 seconds per request fingerprint
- at most 8 posts in a rolling hour

These checks happen in the route handler and rely on the `author_key` column added by the SQL migration.

## Verification

The current codebase passes:

```bash
npm run lint
npm run build
```

If this project was already migrated to the previous email-auth version, rerun `supabase/schema.sql` so the public insert policy and `author_key` column match the current runtime.
