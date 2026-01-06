# Usage & Deployment Dashboard

A self-hosted dashboard for tracking application deployments and usage metrics on a VPS.

## Features

- 📊 **Usage Analytics** - Track request volumes with 24h/7d charts
- 🚀 **Deployment History** - Timeline of deployments with versions and notes
- 🎨 **Modern UI** - Dark theme with gradients and smooth animations
- 🔒 **Token Auth** - Simple bearer token authentication with localStorage
- 🔄 **Auto-refresh** - Dashboard updates every 30 seconds
- 📱 **Responsive** - Works on desktop and mobile

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Infrastructure**: Ubuntu VPS, Nginx, PM2
- **Database**: PostgreSQL with optimized queries

## Setup

### Prerequisites

- Ubuntu VPS
- Node.js 18+
- PostgreSQL 14+
- Nginx
- PM2 (optional but recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/bendixon/usage-dashboard.git
cd usage-dashboard
```

2. Set up the database:
```bash
sudo -u postgres psql
CREATE DATABASE usage_dashboard;
CREATE USER usage_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE usage_dashboard TO usage_user;
\q

psql -U usage_user -d usage_dashboard -f sql/001_init.sql
```

3. Install dependencies:
```bash
cd server
npm install
```

4. Create `.env` file:
```bash
DATABASE_URL=postgres://usage_user:your_password@localhost:5432/usage_dashboard
DASHBOARD_TOKEN=your-secure-random-token
```

5. Start the server:
```bash
# Development
node index.js

# Production with PM2
pm2 start index.js --name usage-dashboard
pm2 save
```

6. Configure Nginx:
```nginx
server {
    listen 443 ssl;
    server_name dashboard.yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
        # Disable caching
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
    }
}
```

## API Endpoints

### Protected Endpoints (Require Bearer Token)

- `POST /api/apps` - Create/update an application
- `POST /api/deployments` - Record a deployment
- `POST /api/usage` - Log a usage event
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/analytics` - Get analytics data
- `GET /api/dashboard/deployments` - Get deployment history

### Public Endpoints

- `GET /health` - Health check endpoint

## Usage

### Recording a Deployment

```bash
curl -X POST https://dashboard.yourdomain.com/api/deployments \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "app_slug": "my-app",
    "environment": "prod",
    "version": "v1.2.3",
    "deployed_by": "GitHub Actions"
  }'
```

### Logging Usage Events

```bash
curl -X POST https://dashboard.yourdomain.com/api/usage \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "app_slug": "my-app",
    "kind": "request",
    "method": "GET",
    "path": "/api/users",
    "status": 200
  }'
```

## Database Schema

### Tables

- **apps** - Application registry
- **deployments** - Deployment history
- **usage_events** - Request/event logs

See `sql/001_init.sql` for the complete schema.

## License

MIT

## Author

Ben Dixon - [https://bendixon.dev](https://bendixon.dev)
