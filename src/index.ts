/**
 * Shorty - 短链接服务主应用
 * 基于 Cloudflare Workers 和 Hono 框架
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { timing } from "hono/timing";

// 导入类型和配置
import { Env, AppConfig, ApiResponse } from "./types/index.js";

// 导入中间件
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// 导入服务
import { DatabaseService } from "./services/database.js";
import { createLinksHandler } from "./handlers/links.js";
import { handleRedirect } from "./handlers/redirect.js";

// 创建应用实例
const app = new Hono<{ Bindings: Env }>();

// 获取应用配置
function getAppConfig(env: Env): AppConfig {
  return {
    environment: env.ENVIRONMENT || "development",
    baseUrl: env.BASE_URL || "http://localhost:8787",
    corsOrigin: env.CORS_ORIGIN || "*",
    defaultShortLength: parseInt(env.DEFAULT_SHORT_LENGTH || "6"),
    maxUrlLength: parseInt(env.MAX_URL_LENGTH || "2048"),
    rateLimitPerMinute: parseInt(env.RATE_LIMIT_PER_MINUTE || "60"),
  };
}

// 全局中间件设置
app.use("*", errorHandler());
app.use("*", logger());
app.use("*", timing());
app.use("*", prettyJSON());

// CORS 中间件（基于环境配置）
app.use("*", async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

// 健康检查端点
app.get("/health", async (c) => {
  const config = getAppConfig(c.env);

  try {
    // 简单的数据库连接测试
    const db = new DatabaseService(c.env.DB);
    await db.getStats();

    const response: ApiResponse = {
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: config.environment,
        version: "1.0.0",
      },
    };

    return c.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: "服务不可用",
      data: {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        environment: config.environment,
      },
    };

    c.status(503);
    return c.json(response);
  }
});

// API 信息端点
app.get("/api/info", async (c) => {
  const config = getAppConfig(c.env);

  const response: ApiResponse = {
    success: true,
    data: {
      name: "Shorty API",
      version: "1.0.0",
      description: "URL 短链接服务",
      environment: config.environment,
      endpoints: {
        health: "/health",
        info: "/api/info",
        stats: "/api/stats",
        create: "POST /api/links",
        redirect: "GET /:shortCode",
        links: "GET /api/links",
      },
      limits: {
        maxUrlLength: config.maxUrlLength,
        defaultShortLength: config.defaultShortLength,
        rateLimitPerMinute: config.rateLimitPerMinute,
      },
    },
  };

  return c.json(response);
});

// 统计信息端点
app.get("/api/stats", async (c) => {
  try {
    const db = new DatabaseService(c.env.DB);
    const stats = await db.getStats();

    const response: ApiResponse = {
      success: true,
      data: {
        totalLinks: stats.totalLinks,
        totalAccesses: stats.totalAccesses,
        recentLinks: stats.recentLinks,
        timestamp: new Date().toISOString(),
      },
    };

    return c.json(response);
  } catch (error) {
    throw error; // 让错误处理中间件处理
  }
});

// 挂载处理器
app.route("/api/links", createLinksHandler());

// 基础路由组 - API v1
const apiV1 = new Hono<{ Bindings: Env }>();

// API 版本信息
apiV1.get("/", (c) => {
  const response: ApiResponse = {
    success: true,
    data: {
      version: "v1",
      message: "Shorty API v1 - URL 短链接服务",
      documentation: "https://github.com/your-repo/shorty#api-documentation",
    },
  };

  return c.json(response);
});

// 挂载 API 路由
app.route("/api/v1", apiV1);

// 重定向路由 - 必须在最后添加，确保不会覆盖 API 路由
app.get("/:shortCode", async (c) => {
  const shortCode = c.req.param("shortCode");

  // 过滤掉明显的 API 路由和静态资源
  if (
    shortCode.startsWith("api") ||
    shortCode.startsWith("health") ||
    shortCode.startsWith("static") ||
    shortCode.includes(".") || // 包含点的可能是文件
    shortCode.length < 3 // 短码最小长度为3
  ) {
    const response: ApiResponse = {
      success: false,
      error: "路由不存在",
      message: "请求的路径不存在",
    };

    c.status(404);
    return c.json(response);
  }

  // 调用重定向处理器
  return handleRedirect(c, {
    redirectType: "temporary", // 使用302临时重定向
    enableAnalytics: true, // 启用访问统计
    enableCaching: false, // 禁用缓存以确保统计准确性
  });
});

// 根路径 - 欢迎页面
app.get("/", (c) => {
  const config = getAppConfig(c.env);

  const welcomeHtml = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shorty - URL 短链接服务</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                line-height: 1.6;
                color: #333;
            }
            .header {
                text-align: center;
                margin-bottom: 3rem;
            }
            .logo {
                font-size: 3rem;
                font-weight: bold;
                color: #0066cc;
                margin-bottom: 0.5rem;
            }
            .subtitle {
                font-size: 1.2rem;
                color: #666;
            }
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 2rem;
                margin: 3rem 0;
            }
            .feature-card {
                padding: 1.5rem;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background: #f9f9f9;
            }
            .feature-title {
                font-weight: bold;
                color: #0066cc;
                margin-bottom: 0.5rem;
            }
            .api-info {
                background: #e8f4fd;
                padding: 1.5rem;
                border-radius: 8px;
                margin: 2rem 0;
            }
            .endpoint {
                font-family: 'Monaco', 'Menlo', monospace;
                background: #333;
                color: #fff;
                padding: 0.5rem;
                border-radius: 4px;
                margin: 0.5rem 0;
            }
            .status {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.875rem;
                font-weight: bold;
            }
            .status.healthy {
                background: #d4edda;
                color: #155724;
            }
            .footer {
                text-align: center;
                margin-top: 3rem;
                padding-top: 2rem;
                border-top: 1px solid #e0e0e0;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🔗 Shorty</div>
            <div class="subtitle">现代化的 URL 短链接服务</div>
            <div class="status healthy">服务状态：运行中</div>
        </div>

        <div class="feature-grid">
            <div class="feature-card">
                <div class="feature-title">⚡ 高性能</div>
                <div>基于 Cloudflare Workers 边缘计算，全球加速访问</div>
            </div>
            <div class="feature-card">
                <div class="feature-title">🛡️ 安全可靠</div>
                <div>企业级安全防护，支持访问统计和过期设置</div>
            </div>
            <div class="feature-card">
                <div class="feature-title">🔧 易于使用</div>
                <div>RESTful API 设计，支持自定义短码和批量操作</div>
            </div>
            <div class="feature-card">
                <div class="feature-title">📊 数据洞察</div>
                <div>详细的访问统计和数据分析，助力业务决策</div>
            </div>
        </div>

        <div class="api-info">
            <h3>🚀 API 快速开始</h3>
            <div>基础信息：</div>
            <div class="endpoint">GET ${config.baseUrl}/api/info</div>
            
            <div>健康检查：</div>
            <div class="endpoint">GET ${config.baseUrl}/health</div>
            
            <div>统计信息：</div>
            <div class="endpoint">GET ${config.baseUrl}/api/stats</div>
            
            <div>API 文档：</div>
            <div class="endpoint">GET ${config.baseUrl}/api/v1</div>
        </div>

        <div class="footer">
            <div>Shorty URL Shortener Service</div>
            <div>环境：${config.environment} | 版本：1.0.0</div>
        </div>
    </body>
    </html>
  `;

  return c.html(welcomeHtml);
});

// 404 处理
app.notFound(notFoundHandler());

// 导出默认应用
export default app;
