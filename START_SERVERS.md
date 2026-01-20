# 🚀 How to Start the Servers

## The Issue You're Seeing

The "Failed to load special days" error happens because the **backend server is not running**.

## Solution: Start Both Servers

### Terminal 1 - Start Backend

```bash
cd apps/backend
npm run dev
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Seasonality SaaS API Server                          ║
║                                                           ║
║   Port: 5000                                              ║
║   Environment: development                                ║
║   API Docs: http://localhost:5000/api                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Terminal 2 - Start Frontend

```bash
cd apps/frontend
npm run dev
```

**Expected output:**
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000

 ✓ Ready in 2.5s
```

## Verify Backend is Running

Open browser and go to: http://localhost:5000/api/health

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T...",
  "uptime": 123.45,
  "database": "connected"
}
```

## Test Special Days API

Go to: http://localhost:5000/api/special-days

You should see:
```json
{
  "success": true,
  "data": [
    {
      "name": "DIWALI",
      "category": "FESTIVAL",
      "country": "INDIA"
    },
    ...
  ],
  "count": 29
}
```

## Now Use the Filter

1. Go to http://localhost:3000
2. Navigate to Weekly Analysis
3. Open Filter Console (left sidebar)
4. Scroll to "Advanced Filters"
5. Expand to see "Special Days Filter"
6. The filter should now load successfully! ✅

## Troubleshooting

### Backend won't start?
- Check if port 5000 is already in use: `lsof -i :5000`
- Check `.env` file exists in `apps/backend/`
- Check database is running (Docker)

### Frontend won't start?
- Check if port 3000 is already in use: `lsof -i :3000`
- Check `.env.local` file exists in `apps/frontend/`

### Still seeing "Failed to load"?
- Make sure backend is running first
- Check browser console for errors (F12)
- Verify API URL in frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:5000`

---

**That's it! Both servers need to be running for the filter to work.** 🎉
