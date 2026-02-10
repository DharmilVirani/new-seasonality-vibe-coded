/**
 * Passport Configuration for Google OAuth
 */
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');

// Configure Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                logger.info('Google OAuth callback received', { profileId: profile.id });

                const email = profile.emails[0].value;
                const name = profile.displayName;
                const googleId = profile.id;

                // Check if user exists
                let user = await prisma.user.findUnique({
                    where: { email: email.toLowerCase() },
                });

                if (user) {
                    // Update Google ID if not set
                    if (!user.googleId) {
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: { googleId },
                        });
                    }
                    logger.info('Existing user logged in via Google', { userId: user.id });
                } else {
                    // Create new user
                    user = await prisma.user.create({
                        data: {
                            email: email.toLowerCase(),
                            name,
                            googleId,
                            role: 'user',
                            subscriptionTier: 'trial',
                            subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day trial
                            isActive: true,
                            // No password needed for OAuth users
                        },
                    });

                    // Create default user preferences
                    await prisma.userPreferences.create({
                        data: {
                            userId: user.id,
                            defaultSymbols: ['NIFTY', 'BANKNIFTY'],
                            defaultFilters: {},
                        },
                    }).catch(err => logger.error('Failed to create user preferences:', err));

                    logger.info('New user created via Google OAuth', { userId: user.id });
                }

                return done(null, user);
            } catch (error) {
                logger.error('Google OAuth error', { error: error.message });
                return done(error, null);
            }
        }
    )
);

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id },
        });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
