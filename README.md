# 🌟 OOU Awards Night 2025

A complete voting platform for the OOU Awards Night - built with a Node.js backend and vanilla HTML/CSS/JS frontend.

## Features

- ✅ **Voting System** - Users can vote for nominees with ₦200 per vote via Paystack
- ✅ **Admin Dashboard** - Secure backend-managed admin panel
- ✅ **JWT Authentication** - Secure admin login with token-based auth
- ✅ **Category Management** - Add/edit/delete award categories
- ✅ **Nominee Management** - Upload photos, bios, and manage nominees
- ✅ **Real-time Stats** - View total votes, revenue, and top nominees
- ✅ **Vote History** - Complete audit trail of all votes
- ✅ **Mobile Responsive** - Works perfectly on all devices
- ✅ **Paystack Integration** - Accept payments via card, bank transfer, USSD

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
# Copy the example env file
copy .env.example .env
```

Edit `.env` and add your settings:

```env
# Generate a secure JWT secret
JWT_SECRET=your-super-secret-key-here

# Get from paystack.com
PAYSTACK_PUBLIC_KEY=pk_test_your_key
PAYSTACK_SECRET_KEY=sk_test_your_key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 3. Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Start the Backend

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 5. Update Frontend Config

Edit `script.js` and update:

```javascript
const CONFIG = {
  API_URL: 'http://localhost:3001/api',
  PAYSTACK_PUBLIC_KEY: 'pk_test_your_actual_key',
  // ...
};
```

### 6. Open in Browser

- **Voting Site**: http://localhost:3000 (or open `index.html` directly)
- **Admin Panel**: http://localhost:3000/admin.html

### Default Admin Login
- **Username**: `admin`
- **Password**: `oou2025`

⚠️ **Important**: Change the password immediately after first login!

---

## Project Structure

```
project/
├── index.html          # Public voting page
├── admin.html          # Admin dashboard
├── script.js           # Frontend JavaScript
├── styles.css          # All CSS styles
├── server/
│   ├── server.js       # Express backend
│   ├── package.json    # Node.js dependencies
│   ├── .env.example    # Environment template
│   ├── .env            # Your secrets (NOT committed!)
│   ├── oou_awards.db  # SQLite database (auto-created)
│   └── uploads/        # Uploaded nominee photos
└── README.md
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/verify` | Verify JWT token |
| POST | `/api/auth/change-password` | Change admin password |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create category (auth) |
| PUT | `/api/categories/:id` | Update category (auth) |
| DELETE | `/api/categories/:id` | Delete category (auth) |

### Nominees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nominees` | List all nominees |
| GET | `/api/nominees/:id` | Get single nominee |
| POST | `/api/nominees` | Create nominee (auth) |
| PUT | `/api/nominees/:id` | Update nominee (auth) |
| DELETE | `/api/nominees/:id` | Delete nominee (auth) |

### Voting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/votes` | Record a vote |
| GET | `/api/stats` | Get statistics |
| GET | `/api/votes/history` | Vote history (auth) |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/verify` | Verify Paystack payment (auth) |

---

## Deployment Options

### Option 1: Render (Recommended - Free)

1. Create account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a **Web Service**:
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
4. Add environment variables from `.env`
5. Deploy!

### Option 2: Railway (Free Tier)

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Add environment variables
4. Railway auto-detects Node.js

### Option 3: VPS/Cloud Server

```bash
# SSH into your server
ssh user@your-server

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone your project
git clone your-repo
cd project/server

# Install and run
npm install
npm start

# Use PM2 for production
npm install -g pm2
pm2 start server.js --name oou-awards
pm2 save
pm2 startup
```

### Option 4: Local Network Access

To let others on your local network test:

1. Find your IP address:
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

2. Start server with your IP:
   ```bash
   IP=192.168.1.100 npm start
   ```

3. Update frontend `API_URL` to `http://192.168.1.100:3001/api`

---

## Mobile View Testing

### In Browser (Chrome/Firefox)
1. Open the page
2. Press `F12` to open DevTools
3. Click the mobile/responsive icon 📱
4. Select a device (iPhone, Pixel, etc.)

### On Actual Mobile
1. Ensure your computer and phone are on the **same network**
2. Start the backend with your local IP (see above)
3. Open `http://your-ip:3000` on your phone

---

## Customization Guide

### 1. Change Event Name/Date

In `index.html`:
```html
<h1 class="hero-title">
  <span class="line1">Your</span>
  <span class="line2">Awards</span>
  <span class="line3">Night <em>2025</em></span>
</h1>
```

In `script.js`:
```javascript
EVENT_DATE: "2025-06-28T18:30:00"  // Update to your event date
```

### 2. Change Vote Price

In `script.js`:
```javascript
VOTE_AMOUNT_KOBO: 20000,  // ₦200 = 20000 kobo
```

### 3. Update Paystack Keys

1. Go to [paystack.com](https://paystack.com)
2. Create account → Dashboard → Settings → API Keys
3. Copy Test/Live keys to your `.env` file

### 4. Upload Nominee Photos

**Option A**: Use URL (easiest)
- Host images on Imgur, Cloudinary, etc.
- Paste URL when adding nominee

**Option B**: Upload to server
- Photos uploaded via admin panel go to `server/uploads/`
- For production, use S3/Cloudinary instead

---

## Security Checklist

Before going live:

- [ ] Change default admin password
- [ ] Use a strong JWT_SECRET (64+ random characters)
- [ ] Switch to Paystack **Live** keys
- [ ] Enable HTTPS (free via Let's Encrypt)
- [ ] Set up proper CORS for your domain
- [ ] Backup your SQLite database regularly
- [ ] Remove `console.log` statements in production

---

## Troubleshooting

### CORS Error
```
Access-Control-Allow-Origin blocked
```
**Fix**: Update `FRONTEND_URL` in `.env` to your exact frontend URL

### Paystack Not Working
1. Check you're using **Test** keys for development
2. Verify keys are correct in `.env`
3. Check browser console for errors

### Database Locked
```
SQLITE_BUSY: database is locked
```
**Fix**: Restart the server

### Can't Login
1. Check server is running on port 3001
2. Verify `API_URL` in `script.js` matches backend
3. Check browser console for errors

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check server logs in terminal

---

## License

MIT License - Feel free to use for your awards event!
