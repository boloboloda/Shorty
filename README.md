# 🔗 Shorty - Modern URL Shortener Service

[![GitHub license](https://img.shields.io/github/license/yourusername/shorty)](https://github.com/yourusername/shorty/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/yourusername/shorty)](https://github.com/yourusername/shorty/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/yourusername/shorty)](https://github.com/yourusername/shorty/issues)

> [中文文档](README_zh.md) | English

A high-performance, feature-rich URL shortener service built on Cloudflare Workers, providing comprehensive link management, detailed analytics, and a modern management dashboard.

## ✨ Key Features

### 🚀 Core Functionality

- **High-Performance Link Shortening** - Powered by Cloudflare Workers edge computing
- **Custom Short Code Support** - Users can customize link suffixes
- **Link Expiration Management** - Support for setting link validity periods
- **Link Status Control** - Enable/disable links functionality
- **Batch Link Management** - Support for bulk operations and management

### 📊 Analytics & Insights

- **Detailed Access Statistics** - IP, device, browser, geographic location analysis
- **Real-time Data Monitoring** - Access trends, popular links ranking
- **Data Export Features** - Support for JSON/CSV format exports
- **Access Log Queries** - Complete access records with filtering
- **Visual Charts** - Chart.js powered data visualization

### 🎨 Management Interface

- **Modern Dashboard** - Responsive design, mobile-friendly
- **Real-time Data Display** - Statistics cards, trend charts
- **Convenient Link Management** - Create, edit, delete, toggle status
- **Elegant User Experience** - Smooth animations, smart notifications

### 🛡️ Security Features

- **URL Validation & Sanitization** - Prevent malicious links
- **Rate Limiting** - Prevent abuse
- **Security Headers** - CSP, HSTS security policies
- **Error Handling** - Graceful error pages

## 🏗️ Tech Stack

### Backend Technologies

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Edge computing platform
- **[Hono](https://hono.dev/)** - Lightweight web framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Edge SQLite database
- **[Zod](https://zod.dev/)** - TypeScript-first data validation

### Frontend Technologies

- **Native HTML/CSS/JavaScript** - No framework dependencies
- **[Chart.js](https://www.chartjs.org/)** - Data visualization
- **Responsive Design** - Supports all devices
- **Modern UI** - CSS Grid, Flexbox, animations

### Development Tools

- **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** - Cloudflare development tool
- **[Vitest](https://vitest.dev/)** - Unit testing framework
- **ESLint + Prettier** - Code quality assurance

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/shorty.git
cd shorty
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file:

```env
ENVIRONMENT=development
BASE_URL=http://localhost:8787
CORS_ORIGIN=*
DEFAULT_SHORT_LENGTH=6
MAX_URL_LENGTH=2048
RATE_LIMIT_PER_MINUTE=60
```

### 4. Create Database

```bash
# Create D1 database
npx wrangler d1 create shorty-db

# Run database migrations
npx wrangler d1 migrations apply shorty-db --local
```

### 5. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:8787`.

### 6. Access Management Interface

Open your browser and visit:

- **Homepage**: http://localhost:8787
- **Management Dashboard**: http://localhost:8787/dashboard

## 📋 API Documentation

### Link Management API

#### Create Short Link

```http
POST /api/links
Content-Type: application/json

{
  "originalUrl": "https://example.com",
  "customSlug": "my-link",  // Optional
  "expireDays": 365         // Optional
}
```

#### Get Links List

```http
GET /api/links?page=1&limit=10
```

#### Get Single Link

```http
GET /api/links/code/{shortCode}
```

#### Update Link

```http
PUT /api/links/code/{shortCode}
Content-Type: application/json

{
  "originalUrl": "https://new-url.com",
  "isActive": true
}
```

#### Delete Link

```http
DELETE /api/links/code/{shortCode}
```

#### Toggle Link Status

```http
POST /api/links/code/{shortCode}/toggle
```

### Analytics API

#### Get Overview Analytics

```http
GET /api/analytics/overview
```

#### Get Link Detailed Statistics

```http
GET /api/analytics/links/code/{shortCode}
```

#### Get Top Links

```http
GET /api/analytics/top-links?period=week&limit=10
```

#### Get Access Logs

```http
GET /api/analytics/access-logs?shortCode={shortCode}&page=1&limit=20
```

#### Data Export

```http
GET /api/analytics/export?format=csv&startDate=2023-01-01&endDate=2023-12-31
```

### Redirect

```http
GET /{shortCode}
# Automatically redirects to original URL
```

## 🗄️ Database Schema

### Main Tables

#### `links` - Link Basic Information

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_url TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  access_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  last_accessed_at DATETIME
);
```

#### `access_logs` - Access Records

```sql
CREATE TABLE access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  short_code TEXT NOT NULL,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  response_time_ms INTEGER
);
```

#### `daily_stats` - Daily Statistics

```sql
CREATE TABLE daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  short_code TEXT NOT NULL,
  date TEXT NOT NULL,
  total_visits INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  mobile_visits INTEGER DEFAULT 0,
  desktop_visits INTEGER DEFAULT 0,
  tablet_visits INTEGER DEFAULT 0,
  bot_visits INTEGER DEFAULT 0,
  top_countries TEXT,
  top_cities TEXT,
  top_referers TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Deployment Guide

### Cloudflare Workers Deployment

#### 1. Configure wrangler.toml

```toml
name = "shorty"
main = "src/index.ts"
compatibility_date = "2024-01-15"
compatibility_flags = ["nodejs_compat"]

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "shorty-db"
database_id = "your-database-id"
```

#### 2. Create Production Database

```bash
# Create production database
npx wrangler d1 create shorty-db-prod

# Run migrations
npx wrangler d1 migrations apply shorty-db-prod --env production
```

#### 3. Deploy to Cloudflare

```bash
npm run deploy
```

#### 4. Set Custom Domain

Configure a custom domain in the Cloudflare Workers console, such as `https://short.yourdomain.com`

### Environment Variables Configuration

Set the following environment variables in the Cloudflare Workers console:

```env
ENVIRONMENT=production
BASE_URL=https://short.yourdomain.com
CORS_ORIGIN=https://yourdomain.com
DEFAULT_SHORT_LENGTH=6
MAX_URL_LENGTH=2048
RATE_LIMIT_PER_MINUTE=100
```

## 🛠️ Development Guide

### Project Structure

```
shorty/
├── src/
│   ├── handlers/          # Request handlers
│   │   ├── analytics.ts   # Analytics API
│   │   ├── links.ts       # Link management API
│   │   └── redirect.ts    # Redirect handling
│   ├── middleware/        # Middleware
│   │   ├── cors.ts        # CORS handling
│   │   └── errorHandler.ts # Error handling
│   ├── services/          # Business logic layer
│   │   ├── analyticsService.ts # Analytics service
│   │   ├── database.ts    # Database service
│   │   └── linkService.ts # Link service
│   ├── utils/             # Utility functions
│   │   ├── analytics.ts   # Analytics utilities
│   │   ├── slugGenerator.ts # Short code generation
│   │   ├── urlValidator.ts # URL validation
│   │   └── validation.ts  # General validation
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   ├── static/            # Static assets
│   │   └── dashboard.html # Management interface
│   └── index.ts           # Main application entry
├── migrations/            # Database migrations
├── tests/                 # Test files
└── wrangler.toml         # Cloudflare configuration
```

### Local Development

#### Start Development Server

```bash
npm run dev
```

#### Run Tests

```bash
npm run test
```

#### Type Checking

```bash
npm run type-check
```

#### Code Formatting

```bash
npm run format
```

### Database Management

#### Local Database Operations

```bash
# View database
npx wrangler d1 execute shorty-db --local --command "SELECT * FROM links LIMIT 10"

# Backup database
npx wrangler d1 backup create shorty-db --local

# Restore database
npx wrangler d1 backup restore shorty-db backup-id --local
```

#### Production Database Operations

```bash
# View production data
npx wrangler d1 execute shorty-db --env production --command "SELECT COUNT(*) FROM links"

# Production database backup
npx wrangler d1 backup create shorty-db --env production
```

## 📈 Performance Optimization

### Caching Strategy

- **CDN Caching**: Static assets cached through Cloudflare CDN
- **API Caching**: Analytics data with appropriate cache headers
- **Database Optimization**: Index optimization and query performance tuning

### Monitoring Metrics

- **Response Time**: Average < 100ms
- **Availability**: 99.9%+
- **Error Rate**: < 0.1%
- **Cache Hit Rate**: > 90%

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the Project**
2. **Create Feature Branch**: `git checkout -b feature/AmazingFeature`
3. **Commit Changes**: `git commit -m 'Add some AmazingFeature'`
4. **Push to Branch**: `git push origin feature/AmazingFeature`
5. **Create Pull Request**

### Code Standards

- Use TypeScript for type safety
- Follow ESLint and Prettier rules
- Write unit tests
- Update relevant documentation

### Issue Reporting

When reporting bugs or requesting features, please provide:

- Detailed problem description
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment information

For detailed contribution guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) - Providing edge computing platform
- [Hono](https://hono.dev/) - Excellent web framework
- [Chart.js](https://www.chartjs.org/) - Data visualization library
- All contributors and users

## 📞 Contact

- **Project Homepage**: https://github.com/yourusername/shorty
- **Issue Reports**: https://github.com/yourusername/shorty/issues
- **Discussions**: https://github.com/yourusername/shorty/discussions

---

⭐ If this project helps you, please give it a Star!
