/**
 * 项目类型定义
 */

// 引用生成的 Cloudflare Workers 类型
/// <reference types="../../worker-configuration" />

// 扩展环境变量类型
export interface Env extends CloudflareBindings {
  // 数据库绑定
  DB: D1Database;

  // 环境变量
  ENVIRONMENT: "development" | "production";
  BASE_URL: string;
  CORS_ORIGIN: string;
  DEFAULT_SHORT_LENGTH: string;
  MAX_URL_LENGTH: string;
  RATE_LIMIT_PER_MINUTE: string;
}

// 应用配置类型
export interface AppConfig {
  environment: string;
  baseUrl: string;
  corsOrigin: string;
  defaultShortLength: number;
  maxUrlLength: number;
  rateLimitPerMinute: number;
}

// 链接相关类型
export interface Link {
  id?: number;
  original_url: string;
  short_code: string;
  created_at?: string;
  access_count?: number;
  expires_at?: string | null;
}

export interface CreateLinkRequest {
  url: string;
  customCode?: string;
  expiresAt?: string;
}

export interface CreateLinkResponse {
  success: boolean;
  data?: {
    id: number;
    shortCode: string;
    originalUrl: string;
    shortUrl: string;
    expiresAt?: string;
  };
  error?: string;
}

export interface LinkStatsResponse {
  success: boolean;
  data?: {
    totalLinks: number;
    totalAccesses: number;
    recentLinks: number;
  };
  error?: string;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 验证错误类型
export interface ValidationError {
  field: string;
  message: string;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// 链接列表响应
export interface LinksListResponse {
  success: boolean;
  data?: {
    links: Link[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

// HTTP 方法类型
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS";

// CORS 配置类型
export interface CorsOptions {
  origin: string | string[];
  methods: HttpMethod[];
  allowedHeaders: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}
