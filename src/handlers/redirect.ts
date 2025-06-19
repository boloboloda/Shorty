/**
 * 重定向处理器 - 处理短链接访问和重定向
 */

import { Context } from "hono";
import { DatabaseService } from "../services/database.js";
import {
  createLinkService,
  type LinkServiceConfig,
} from "../services/linkService.js";
import { AnalyticsService } from "../services/analyticsService.js";
import type { Env, ApiResponse } from "../types/index.js";

// 重定向配置
export interface RedirectConfig {
  redirectType: "temporary" | "permanent"; // 302 临时 或 301 永久重定向
  enableAnalytics: boolean; // 是否启用访问分析
  enableCaching: boolean; // 是否启用缓存头
  customNotFoundPage?: string; // 自定义404页面URL
  redirectDelay?: number; // 重定向延迟（毫秒）
}

// 默认重定向配置
const DEFAULT_REDIRECT_CONFIG: RedirectConfig = {
  redirectType: "temporary",
  enableAnalytics: true,
  enableCaching: false,
  redirectDelay: 0,
};

/**
 * 获取应用配置
 */
function getLinkServiceConfig(env: Env): LinkServiceConfig {
  return {
    baseUrl: env.BASE_URL || "https://shorty.dev",
    defaultExpireDays: 365,
    enableCustomSlug: true,
    enableExpiration: true,
    maxSlugLength: 16,
    minSlugLength: 4,
    enableRateLimit: true,
    enableAnalytics: true,
  };
}

/**
 * 验证短码格式
 * @param shortCode - 要验证的短码
 * @returns 是否为有效格式
 */
function isValidShortCodeFormat(shortCode: string): boolean {
  // 基础格式检查
  if (!shortCode || typeof shortCode !== "string") {
    return false;
  }

  // 长度检查 (3-16个字符)
  if (shortCode.length < 3 || shortCode.length > 16) {
    return false;
  }

  // 字符检查 (只允许字母数字)
  const validCharPattern = /^[a-zA-Z0-9]+$/;
  if (!validCharPattern.test(shortCode)) {
    return false;
  }

  // 排除纯数字（可能与ID冲突）
  if (/^\d+$/.test(shortCode)) {
    return false;
  }

  return true;
}

/**
 * 创建404错误页面HTML
 * @param shortCode - 不存在的短码
 * @param baseUrl - 基础URL
 * @returns HTML内容
 */
function createNotFoundPage(shortCode: string, baseUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>链接不存在 - Shorty</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 2rem;
                text-align: center;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .container {
                background: white;
                padding: 3rem;
                border-radius: 16px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .error-code {
                font-size: 6rem;
                font-weight: bold;
                color: #ff6b6b;
                margin-bottom: 1rem;
                line-height: 1;
            }
            .error-title {
                font-size: 1.5rem;
                font-weight: bold;
                margin-bottom: 1rem;
                color: #2c3e50;
            }
            .error-message {
                font-size: 1.1rem;
                margin-bottom: 2rem;
                color: #666;
                line-height: 1.6;
            }
            .short-code {
                font-family: 'Monaco', 'Menlo', monospace;
                background: #f8f9fa;
                padding: 0.5rem 1rem;
                border-radius: 8px;
                color: #e74c3c;
                font-weight: bold;
            }
            .home-button {
                display: inline-block;
                padding: 0.75rem 2rem;
                background: #3498db;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                transition: background 0.3s ease;
                margin-top: 1rem;
            }
            .home-button:hover {
                background: #2980b9;
            }
            .suggestions {
                margin-top: 2rem;
                padding: 1.5rem;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #3498db;
            }
            .suggestions h3 {
                margin-top: 0;
                color: #2c3e50;
            }
            .suggestions ul {
                text-align: left;
                margin: 1rem 0;
            }
            .suggestions li {
                margin: 0.5rem 0;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-code">404</div>
            <div class="error-title">链接不存在</div>
            <div class="error-message">
                很抱歉，短码 <span class="short-code">${shortCode}</span> 对应的链接不存在或已被删除。
            </div>
            
            <div class="suggestions">
                <h3>🤔 可能的原因：</h3>
                <ul>
                    <li>链接已过期或被删除</li>
                    <li>短码输入错误（请检查大小写）</li>
                    <li>链接从未创建过</li>
                </ul>
            </div>
            
            <a href="${baseUrl}" class="home-button">
                🏠 返回首页
            </a>
        </div>
    </body>
    </html>
  `;
}

/**
 * 创建过期链接页面HTML
 * @param shortCode - 过期的短码
 * @param expiresAt - 过期时间
 * @param baseUrl - 基础URL
 * @returns HTML内容
 */
function createExpiredPage(
  shortCode: string,
  expiresAt: string,
  baseUrl: string
): string {
  const expiredDate = new Date(expiresAt).toLocaleDateString("zh-CN");

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>链接已过期 - Shorty</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 2rem;
                text-align: center;
                color: #333;
                background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .container {
                background: white;
                padding: 3rem;
                border-radius: 16px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .warning-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            .error-title {
                font-size: 1.5rem;
                font-weight: bold;
                margin-bottom: 1rem;
                color: #e17055;
            }
            .error-message {
                font-size: 1.1rem;
                margin-bottom: 2rem;
                color: #666;
                line-height: 1.6;
            }
            .short-code {
                font-family: 'Monaco', 'Menlo', monospace;
                background: #f8f9fa;
                padding: 0.5rem 1rem;
                border-radius: 8px;
                color: #e17055;
                font-weight: bold;
            }
            .expired-date {
                color: #e74c3c;
                font-weight: bold;
            }
            .home-button {
                display: inline-block;
                padding: 0.75rem 2rem;
                background: #e17055;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                transition: background 0.3s ease;
                margin-top: 1rem;
            }
            .home-button:hover {
                background: #d63031;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="warning-icon">⏰</div>
            <div class="error-title">链接已过期</div>
            <div class="error-message">
                短码 <span class="short-code">${shortCode}</span> 对应的链接已于 
                <span class="expired-date">${expiredDate}</span> 过期。
            </div>
            
            <a href="${baseUrl}" class="home-button">
                🏠 返回首页
            </a>
        </div>
    </body>
    </html>
  `;
}

/**
 * 处理短链接重定向的主函数
 * @param c - Hono 上下文
 * @param config - 重定向配置
 * @returns HTTP 响应
 */
export async function handleRedirect(
  c: Context<{ Bindings: Env }>,
  config: Partial<RedirectConfig> = {}
) {
  const finalConfig = { ...DEFAULT_REDIRECT_CONFIG, ...config };
  const shortCode = c.req.param("shortCode");

  try {
    // 1. 验证短码格式
    if (!isValidShortCodeFormat(shortCode)) {
      console.log(`无效的短码格式: ${shortCode}`);

      const html = createNotFoundPage(
        shortCode,
        getLinkServiceConfig(c.env).baseUrl
      );
      c.status(404);
      return c.html(html);
    }

    // 2. 创建服务实例
    const db = new DatabaseService(c.env.DB);
    const linkService = createLinkService(db, getLinkServiceConfig(c.env));
    const analyticsService = new AnalyticsService(db);

    // 3. 查找链接 (with analytics tracking if enabled)
    const linkResult = await linkService.getLink(
      shortCode,
      finalConfig.enableAnalytics
    );

    if (!linkResult.success) {
      console.log(`链接查找失败: ${shortCode} - ${linkResult.error}`);

      // 检查是否是过期链接
      if (linkResult.error?.includes("已过期")) {
        // 尝试获取链接信息用于显示过期页面
        const expiredLinkResult = await linkService.getLinkByShortCodeRaw(
          shortCode
        );

        if (expiredLinkResult.success && expiredLinkResult.link?.expiresAt) {
          const html = createExpiredPage(
            shortCode,
            expiredLinkResult.link.expiresAt,
            getLinkServiceConfig(c.env).baseUrl
          );
          c.status(410); // 410 Gone - 资源曾经存在但现在不存在
          return c.html(html);
        }
      }

      // 其他情况返回404
      const html = createNotFoundPage(
        shortCode,
        getLinkServiceConfig(c.env).baseUrl
      );
      c.status(404);
      return c.html(html);
    }

    const link = linkResult.link!;
    const originalUrl = link.originalUrl;

    // 4. 记录访问日志
    console.log(
      `重定向访问: ${shortCode} -> ${originalUrl} (访问次数: ${link.accessCount})`
    );

    // 5. 记录详细的访问分析（如果启用）
    if (finalConfig.enableAnalytics) {
      try {
        const startTime = Date.now();
        await analyticsService.recordVisit(
          {
            id: link.id,
            original_url: originalUrl,
            short_code: shortCode,
            created_at: link.createdAt,
            access_count: link.accessCount,
            expires_at: link.expiresAt,
          },
          c.req.raw
        );
        const recordTime = Date.now() - startTime;
        console.log(`分析记录完成，耗时: ${recordTime}ms`);
      } catch (analyticsError) {
        console.warn(`访问分析记录失败: ${analyticsError}`);
        // 不阻塞重定向，继续处理
      }
    }

    // 6. 添加重定向延迟（如果配置了）
    if (finalConfig.redirectDelay && finalConfig.redirectDelay > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, finalConfig.redirectDelay)
      );
    }

    // 7. 设置缓存头（如果启用）
    if (finalConfig.enableCaching) {
      c.header("Cache-Control", "public, max-age=300"); // 5分钟缓存
    } else {
      c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    }

    // 8. 设置安全头
    c.header("X-Robots-Tag", "noindex, nofollow"); // 防止搜索引擎索引重定向

    // 9. 执行重定向
    const statusCode = finalConfig.redirectType === "permanent" ? 301 : 302;
    c.status(statusCode);

    // 设置 Location 头并重定向
    return c.redirect(originalUrl);
  } catch (error) {
    // 异常处理
    console.error(`重定向处理异常: ${shortCode}`, error);

    // 返回通用错误页面
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>服务错误 - Shorty</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 2rem;
                  text-align: center;
                  color: #333;
                  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .container {
                  background: white;
                  padding: 3rem;
                  border-radius: 16px;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              }
              .error-code {
                  font-size: 6rem;
                  font-weight: bold;
                  color: #e74c3c;
                  margin-bottom: 1rem;
                  line-height: 1;
              }
              .error-title {
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-bottom: 1rem;
                  color: #2c3e50;
              }
              .error-message {
                  font-size: 1.1rem;
                  margin-bottom: 2rem;
                  color: #666;
                  line-height: 1.6;
              }
              .home-button {
                  display: inline-block;
                  padding: 0.75rem 2rem;
                  background: #e74c3c;
                  color: white;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: bold;
                  transition: background 0.3s ease;
              }
              .home-button:hover {
                  background: #c0392b;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="error-code">500</div>
              <div class="error-title">服务暂时不可用</div>
              <div class="error-message">
                  很抱歉，处理您的请求时发生了错误。请稍后再试。
              </div>
              
              <a href="${
                getLinkServiceConfig(c.env).baseUrl
              }" class="home-button">
                  🏠 返回首页
              </a>
          </div>
      </body>
      </html>
    `;

    c.status(500);
    return c.html(errorHtml);
  }
}

/**
 * 创建重定向处理器的工厂函数
 * @param config - 重定向配置
 * @returns 重定向处理函数
 */
export function createRedirectHandler(config: Partial<RedirectConfig> = {}) {
  return (c: Context<{ Bindings: Env }>) => handleRedirect(c, config);
}

// 默认导出
export default handleRedirect;
