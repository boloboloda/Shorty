/**
 * 项目类型定义
 */

// 引用生成的 Cloudflare Workers 类型
/// <reference types="../../worker-configuration" />

// 使用生成的 Cloudflare 环境类型
export type Env = CloudflareBindings;

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
