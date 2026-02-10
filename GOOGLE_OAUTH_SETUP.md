# Google OAuth Setup Guide

## Overview
Google OAuth has been integrated into your login and signup pages. Follow these steps to enable it.

## What's Been Done
✅ Installed `passport` and `passport-google-oauth20` packages
✅ Created Google OAuth configuration (`apps/backend/src/config/passport.js`)
✅ Added Google OAuth routes to backend (`/api/auth/google` and `/api/auth/google/callback`)
✅ Updated AuthService with `googleAuth()` method
✅ Created frontend callback page (`apps/frontend/src/app/auth/callback/page.tsx`)
✅ Updated login and register pages with functional Google OAuth buttons
✅ Added environment variables to `.env` file

## Setup Steps (When You're Ready)

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen if prompted
6. For Application type, select "Web application"
7. Add authorized redirect URIs:
   - Development: `http://localhost:3001/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
8. Copy the Client ID and Client Secret

### Step 2: Update Environment Variables

Update `apps/backend/.env`:
```env
GOOGLE_CLIENT_ID=your_actual_google_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

For production, update these URLs accordingly.

### Step 3: Run Database Migration

**IMPORTANT:** This will NOT delete your data. It only adds new fields.

```bash
cd apps/backend
npx prisma migrate dev --name add_google_oauth
```

This adds:
- `googleId` field to User table (optional, unique)
- Makes `password` field optional (for OAuth-only users)

### Step 4: Restart Backend Server

```bash
cd apps/backend
npm run dev
```

### Step 5: Test Google OAuth

1. Go to login page: `http://localhost:3000/login`
2. Click "Log in with Google" button
3. You'll be redirected to Google's consent screen
4. After approval, you'll be redirected back and logged in

## How It Works

1. User clicks "Log in with Google" or "Sign up with Google"
2. Frontend redirects to: `http://localhost:3001/api/auth/google`
3. Backend redirects to Google's OAuth consent screen
4. User approves access
5. Google redirects back to: `http://localhost:3001/api/auth/google/callback`
6. Backend creates/updates user and generates JWT tokens
7. Backend redirects to: `http://localhost:3000/auth/callback?token=...&refreshToken=...`
8. Frontend callback page stores tokens and fetches user profile
9. User is redirected to dashboard

## Database Changes

The migration adds these fields to the `User` table:

```prisma
model User {
  // ... existing fields
  password  String?  // Changed from String to String? (optional)
  googleId  String?  @unique  // New field for Google OAuth ID
  // ... rest of fields
}
```

## Security Notes

- OAuth users don't have passwords (password field is null)
- If an OAuth user tries to login with password, they'll get: "Please sign in with Google"
- If a password user exists with same email, their account is linked to Google on first OAuth login
- JWT tokens are still used for session management (same as password login)

## Rollback (If Needed)

If you want to remove Google OAuth later:

1. Remove the migration:
   ```bash
   cd apps/backend
   npx prisma migrate resolve --rolled-back add_google_oauth
   ```

2. Revert schema changes in `apps/backend/prisma/schema.prisma`

3. Remove Google OAuth routes from `apps/backend/src/routes/authRoutes.js`

## Testing Without Real Google Credentials

You can test the UI flow without setting up Google OAuth:
- The buttons are functional but will fail at the OAuth step
- You'll see an error redirect to `/login?error=oauth_failed`
- Regular email/password login still works normally

## Need Help?

- Check backend logs for OAuth errors
- Verify redirect URIs match exactly in Google Console
- Make sure FRONTEND_URL and GOOGLE_CALLBACK_URL are correct
- Test with incognito/private window to avoid cookie issues
