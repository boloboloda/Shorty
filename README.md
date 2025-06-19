# 🔗 Shorty - 现代化短链接服务

[![GitHub license](https://img.shields.io/github/license/yourusername/shorty)](https://github.com/yourusername/shorty/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/yourusername/shorty)](https://github.com/yourusername/shorty/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/yourusername/shorty)](https://github.com/yourusername/shorty/issues)

一个基于 Cloudflare Workers 的高性能、功能丰富的短链接服务，提供完整的链接管理、详细分析和现代化管理界面。

## ✨ 主要特性

### 🚀 核心功能

- **高性能短链接生成** - 基于 Cloudflare Workers 边缘计算
- **自定义短码支持** - 用户可自定义链接后缀
- **链接过期管理** - 支持设置链接有效期
- **链接状态控制** - 启用/禁用链接功能
- **批量链接管理** - 支持批量操作和管理

### 📊 数据分析

- **详细访问统计** - IP、设备、浏览器、地理位置分析
- **实时数据监控** - 访问趋势、热门链接排行
- **数据导出功能** - 支持 JSON/CSV 格式导出
- **访问日志查询** - 完整的访问记录和筛选
- **可视化图表** - Chart.js 驱动的数据可视化

### 🎨 管理界面

- **现代化仪表板** - 响应式设计，移动端友好
- **实时数据展示** - 统计卡片、趋势图表
- **便捷链接管理** - 创建、编辑、删除、状态切换
- **优雅的用户体验** - 流畅动画、智能提示

### 🛡️ 安全特性

- **URL 验证和清理** - 防止恶意链接
- **访问频率限制** - 防止滥用
- **安全头设置** - CSP、HSTS 等安全策略
- **错误处理机制** - 优雅的错误页面

## 🏗️ 技术栈

### 后端技术

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - 边缘计算平台
- **[Hono](https://hono.dev/)** - 轻量级 Web 框架
- **[TypeScript](https://www.typescriptlang.org/)** - 类型安全的 JavaScript
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - 边缘 SQLite 数据库
- **[Zod](https://zod.dev/)** - TypeScript 优先的数据验证

### 前端技术

- **原生 HTML/CSS/JavaScript** - 无框架依赖
- **[Chart.js](https://www.chartjs.org/)** - 数据可视化
- **响应式设计** - 适配所有设备
- **现代化 UI** - CSS Grid、Flexbox、动画效果

### 开发工具

- **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** - Cloudflare 开发工具
- **[Vitest](https://vitest.dev/)** - 单元测试框架
- **ESLint + Prettier** - 代码质量保证

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- Cloudflare 账户

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/shorty.git
cd shorty
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境

创建 `.env` 文件：

```env
ENVIRONMENT=development
BASE_URL=http://localhost:8787
CORS_ORIGIN=*
DEFAULT_SHORT_LENGTH=6
MAX_URL_LENGTH=2048
RATE_LIMIT_PER_MINUTE=60
```

### 4. 创建数据库

```bash
# 创建 D1 数据库
npx wrangler d1 create shorty-db

# 执行数据库迁移
npx wrangler d1 migrations apply shorty-db --local
```

### 5. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:8787` 启动。

### 6. 访问管理界面

打开浏览器访问：

- **主页**: http://localhost:8787
- **管理仪表板**: http://localhost:8787/dashboard

## 📋 API 文档

### 链接管理 API

#### 创建短链接

```http
POST /api/links
Content-Type: application/json

{
  "originalUrl": "https://example.com",
  "customSlug": "my-link",  // 可选
  "expireDays": 365         // 可选
}
```

#### 获取链接列表

```http
GET /api/links?page=1&limit=10
```

#### 获取单个链接

```http
GET /api/links/code/{shortCode}
```

#### 更新链接

```http
PUT /api/links/code/{shortCode}
Content-Type: application/json

{
  "originalUrl": "https://new-url.com",
  "isActive": true
}
```

#### 删除链接

```http
DELETE /api/links/code/{shortCode}
```

#### 切换链接状态

```http
POST /api/links/code/{shortCode}/toggle
```

### 分析 API

#### 获取总体分析

```http
GET /api/analytics/overview
```

#### 获取链接详细统计

```http
GET /api/analytics/links/code/{shortCode}
```

#### 获取热门链接

```http
GET /api/analytics/top-links?period=week&limit=10
```

#### 获取访问日志

```http
GET /api/analytics/access-logs?shortCode={shortCode}&page=1&limit=20
```

#### 数据导出

```http
GET /api/analytics/export?format=csv&startDate=2023-01-01&endDate=2023-12-31
```

### 重定向

```http
GET /{shortCode}
# 自动重定向到原始URL
```

## 🗄️ 数据库架构

### 主要数据表

#### `links` - 链接基础信息

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

#### `access_logs` - 访问记录

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

#### `daily_stats` - 每日统计

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

## 🚀 部署指南

### Cloudflare Workers 部署

#### 1. 配置 wrangler.toml

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

#### 2. 创建生产数据库

```bash
# 创建生产数据库
npx wrangler d1 create shorty-db-prod

# 运行迁移
npx wrangler d1 migrations apply shorty-db-prod --env production
```

#### 3. 部署到 Cloudflare

```bash
npm run deploy
```

#### 4. 设置自定义域名

在 Cloudflare Workers 控制台设置自定义域名，如 `https://short.yourdomain.com`

### 环境变量配置

在 Cloudflare Workers 控制台设置以下环境变量：

```env
ENVIRONMENT=production
BASE_URL=https://short.yourdomain.com
CORS_ORIGIN=https://yourdomain.com
DEFAULT_SHORT_LENGTH=6
MAX_URL_LENGTH=2048
RATE_LIMIT_PER_MINUTE=100
```

## 🛠️ 开发指南

### 项目结构

```
shorty/
├── src/
│   ├── handlers/          # 请求处理器
│   │   ├── analytics.ts   # 分析API
│   │   ├── links.ts       # 链接管理API
│   │   └── redirect.ts    # 重定向处理
│   ├── middleware/        # 中间件
│   │   ├── cors.ts        # CORS处理
│   │   └── errorHandler.ts # 错误处理
│   ├── services/          # 业务逻辑层
│   │   ├── analyticsService.ts # 分析服务
│   │   ├── database.ts    # 数据库服务
│   │   └── linkService.ts # 链接服务
│   ├── utils/             # 工具函数
│   │   ├── analytics.ts   # 分析工具
│   │   ├── slugGenerator.ts # 短码生成
│   │   ├── urlValidator.ts # URL验证
│   │   └── validation.ts  # 通用验证
│   ├── types/             # TypeScript类型
│   │   └── index.ts
│   ├── static/            # 静态资源
│   │   └── dashboard.html # 管理界面
│   └── index.ts           # 主应用入口
├── migrations/            # 数据库迁移
├── tests/                 # 测试文件
└── wrangler.toml         # Cloudflare配置
```

### 本地开发

#### 启动开发服务器

```bash
npm run dev
```

#### 运行测试

```bash
npm run test
```

#### 类型检查

```bash
npm run type-check
```

#### 代码格式化

```bash
npm run format
```

### 数据库管理

#### 本地数据库操作

```bash
# 查看数据库
npx wrangler d1 execute shorty-db --local --command "SELECT * FROM links LIMIT 10"

# 备份数据库
npx wrangler d1 backup create shorty-db --local

# 恢复数据库
npx wrangler d1 backup restore shorty-db backup-id --local
```

#### 生产数据库操作

```bash
# 查看生产数据
npx wrangler d1 execute shorty-db --env production --command "SELECT COUNT(*) FROM links"

# 生产数据库备份
npx wrangler d1 backup create shorty-db --env production
```

## 📈 性能优化

### 缓存策略

- **CDN 缓存**: 静态资源通过 Cloudflare CDN 缓存
- **API 缓存**: 分析数据使用适当的缓存头
- **数据库优化**: 索引优化和查询性能调优

### 监控指标

- **响应时间**: 平均 < 100ms
- **可用性**: 99.9%+
- **错误率**: < 0.1%
- **缓存命中率**: > 90%

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. **Fork 项目**
2. **创建特性分支**: `git checkout -b feature/AmazingFeature`
3. **提交更改**: `git commit -m 'Add some AmazingFeature'`
4. **推送分支**: `git push origin feature/AmazingFeature`
5. **创建 Pull Request**

### 代码规范

- 使用 TypeScript 进行类型安全
- 遵循 ESLint 和 Prettier 规则
- 编写单元测试
- 更新相关文档

### Issue 报告

报告 Bug 或提出功能请求时，请提供：

- 详细的问题描述
- 复现步骤
- 期望行为
- 实际行为
- 环境信息

## 📄 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/) - 提供边缘计算平台
- [Hono](https://hono.dev/) - 优秀的 Web 框架
- [Chart.js](https://www.chartjs.org/) - 数据可视化库
- 所有贡献者和使用者

## 📞 联系方式

- **项目主页**: https://github.com/yourusername/shorty
- **问题反馈**: https://github.com/yourusername/shorty/issues
- **讨论区**: https://github.com/yourusername/shorty/discussions

---

⭐ 如果这个项目对你有帮助，请给个 Star！
