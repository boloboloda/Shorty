/**
 * CORS 中间件
 * 处理跨域请求和安全头设置
 */

import { Context, Next } from "hono";
import { CorsOptions, Env, HttpMethod } from "../types/index.js";

// 默认 CORS 配置
const DEFAULT_CORS_OPTIONS: CorsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["X-Total-Count"],
  credentials: false,
  maxAge: 86400, // 24 hours
};

/**
 * 创建 CORS 中间件
 */
export function corsMiddleware(options?: Partial<CorsOptions>) {
  const corsOptions = { ...DEFAULT_CORS_OPTIONS, ...options };

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const origin = c.req.header("Origin");
    const method = c.req.method as HttpMethod;

    // 检查是否允许该源
    const isOriginAllowed = checkOrigin(origin, corsOptions.origin);

    // 设置 CORS 头
    if (isOriginAllowed) {
      c.header("Access-Control-Allow-Origin", origin || "*");
    }

    // 设置其他 CORS 头
    c.header("Access-Control-Allow-Methods", corsOptions.methods.join(", "));
    c.header(
      "Access-Control-Allow-Headers",
      corsOptions.allowedHeaders.join(", ")
    );

    if (corsOptions.exposedHeaders && corsOptions.exposedHeaders.length > 0) {
      c.header(
        "Access-Control-Expose-Headers",
        corsOptions.exposedHeaders.join(", ")
      );
    }

    if (corsOptions.credentials) {
      c.header("Access-Control-Allow-Credentials", "true");
    }

    if (corsOptions.maxAge) {
      c.header("Access-Control-Max-Age", corsOptions.maxAge.toString());
    }

    // 处理预检请求
    if (method === "OPTIONS") {
      c.status(204);
      return c.body(null);
    }

    // 添加安全头
    addSecurityHeaders(c);

    await next();
  };
}

/**
 * 检查源是否被允许
 */
function checkOrigin(
  origin: string | undefined,
  allowedOrigin: string | string[]
): boolean {
  if (!origin) return true; // 同源请求

  if (allowedOrigin === "*") return true;

  if (typeof allowedOrigin === "string") {
    return origin === allowedOrigin;
  }

  return allowedOrigin.includes(origin);
}

/**
 * 添加安全头
 */
function addSecurityHeaders(c: Context) {
  // 防止 XSS 攻击
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");

  // 严格的传输安全
  c.header(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // 内容安全策略
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none';"
  );

  // 推荐政策
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // 权限政策
  c.header(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()"
  );
}

/**
 * 环境特定的 CORS 中间件
 */
export function createCorsMiddleware(env: Env) {
  const corsOrigin = env.CORS_ORIGIN || "*";

  return corsMiddleware({
    origin: corsOrigin,
    credentials: corsOrigin !== "*", // 只有在非通配符时允许凭据
  });
}

/**
 * 开发环境 CORS 中间件（更宽松）
 */
export const devCorsMiddleware = corsMiddleware({
  origin: "*",
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
});

/**
 * 生产环境 CORS 中间件（更严格）
 */
export function prodCorsMiddleware(allowedOrigins: string[]) {
  return corsMiddleware({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
}
