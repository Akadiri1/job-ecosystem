# Job Ecosystem Backend

A full-stack job platform with real-time chat, voice/video calls, and task management.

## Tech Stack

- Node.js + Express
- PostgreSQL + Sequelize
- Socket.io (Real-time chat & calls)
- EJS Templates
- JWT Authentication

## Local Development

```bash
# Install dependencies
npm install

# Create .env file (see .env.example)

# Run development server
npm run dev
```

## Environment Variables

Create a `.env` file with:

```
# Database
DATABASE_URL=postgres://user:password@host:5432/dbname

# Auth
JWT_SECRET=your_super_secret_key_here
SESSION_SECRET=another_secret_key

# Email (Optional)
EMAIL_USER=your@gmail.com
EMAIL_PASS=app_password

# Social Login (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# Server
PORT=5000
NODE_ENV=development
```

## Deployment on Render.com

1. Push to GitHub
2. Create new Web Service on Render
3. Connect your repo
4. Set environment variables
5. Deploy!

Build Command: `npm install`
Start Command: `npm start`
