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
  id: number;
  original_url: string;
  short_code: string;
  created_at: string;
  access_count: number;
  expires_at: string | null;
}

// 创建链接请求
export interface CreateLinkRequest {
  originalUrl: string; // 原始URL
  customSlug?: string; // 自定义短码
  expiresAt?: string; // 过期时间
  expireDays?: number; // 过期天数
}

// 创建链接响应
export interface CreateLinkResponse {
  success: boolean;
  link?: {
    id: number;
    originalUrl: string;
    shortCode: string;
    shortUrl: string;
    createdAt: string;
    expiresAt: string | null;
    accessCount: number;
  };
  error?: string;
  details?: string[];
}

// 获取链接响应
export interface GetLinkResponse {
  success: boolean;
  link?: {
    id: number;
    originalUrl: string;
    shortCode: string;
    shortUrl: string;
    createdAt: string;
    expiresAt: string | null;
    accessCount: number;
  };
  error?: string;
}

// 更新链接请求
export interface UpdateLinkRequest {
  originalUrl?: string;
  expiresAt?: string | null;
}

// 更新链接响应
export interface UpdateLinkResponse {
  success: boolean;
  link?: {
    id: number;
    originalUrl: string;
    shortCode: string;
    shortUrl: string;
    createdAt: string;
    expiresAt: string | null;
    accessCount: number;
  };
  error?: string;
  details?: string[];
}

// 链接统计
export interface LinkStats {
  id: number;
  shortCode: string;
  originalUrl: string;
  accessCount: number;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
}

// 链接统计响应
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
