const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

module.exports = (passport, User) => {
    // Serialize User to Session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize User from Session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findByPk(id);
            done(null, user);
        } catch (err) {
            console.error("Deserialize Error:", err);
            done(err, null);
        }
    });

    // =====================================
    // GOOGLE STRATEGY
    // =====================================
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/api/auth/google/callback"
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // 1. Check if user exists with this Google ID
                const existingUser = await User.findOne({ where: { google_id: profile.id } });
                if (existingUser) {
                    return done(null, existingUser);
                }

                // 2. Check if user exists with this Email (Link Account)
                if (profile.emails && profile.emails.length > 0) {
                    const emailUser = await User.findOne({ where: { email: profile.emails[0].value } });
                    if (emailUser) {
                        emailUser.google_id = profile.id;
                        await emailUser.save();
                        return done(null, emailUser);
                    }
                }

                // 3. Create New User
                const newUser = await User.create({
                    full_name: profile.displayName,
                    email: profile.emails[0].value,
                    google_id: profile.id,
                    role: 'job_seeker', // Default role for social login
                    password_hash: null // No password
                });
                return done(null, newUser);

            } catch (err) {
                console.error("Google Auth Error:", err);
                return done(err, null);
            }
        }));
    } else {
        console.warn("⚠️ Google Auth keys missing. Google Login disabled.");
    }

    // =====================================
    // FACEBOOK STRATEGY
    // =====================================
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
        passport.use(new FacebookStrategy({
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: "/api/auth/facebook/callback",
            profileFields: ['id', 'emails', 'name', 'displayName'] // Request fields
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // 1. Check if user exists with this Facebook ID
                const existingUser = await User.findOne({ where: { facebook_id: profile.id } });
                if (existingUser) {
                    return done(null, existingUser);
                }

                // 2. Check if user exists with this Email (Link Account)
                const email = (profile.emails && profile.emails.length > 0) ? profile.emails[0].value : null;
                
                if (email) {
                    const emailUser = await User.findOne({ where: { email: email } });
                    if (emailUser) {
                        emailUser.facebook_id = profile.id;
                        await emailUser.save();
                        return done(null, emailUser);
                    }
                }

                // 3. Create New User
                const userEmail = email || `${profile.id}@facebook.com`;

                const newUser = await User.create({
                    full_name: profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`,
                    email: userEmail,
                    facebook_id: profile.id,
                    role: 'job_seeker',
                    password_hash: null
                });
                return done(null, newUser);

            } catch (err) {
                console.error("Facebook Auth Error:", err);
                return done(err, null);
            }
        }));
    } else {
        console.warn("⚠️ Facebook Auth keys missing. Facebook Login disabled.");
    }
};
