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

// ===================
// 新增：分析功能类型
// ===================

// 访问日志类型
export interface AccessLog {
  id: number;
  link_id: number;
  short_code: string;
  accessed_at: string;
  ip_address: string;
  user_agent: string | null;
  referer: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null; // mobile, desktop, tablet, bot
  browser: string | null;
  os: string | null;
  response_time_ms: number | null;
}

// 创建访问日志请求
export interface CreateAccessLogData {
  link_id: number;
  short_code: string;
  ip_address: string;
  user_agent?: string;
  referer?: string;
  country?: string;
  city?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  response_time_ms?: number;
}

// 每日统计类型
export interface DailyStats {
  id: number;
  link_id: number;
  short_code: string;
  date: string; // YYYY-MM-DD
  total_visits: number;
  unique_visitors: number;
  mobile_visits: number;
  desktop_visits: number;
  tablet_visits: number;
  bot_visits: number;
  top_countries: string; // JSON字符串
  top_cities: string; // JSON字符串
  top_referers: string; // JSON字符串
  created_at: string;
  updated_at: string;
}

// 每日统计更新数据
export interface UpdateDailyStatsData {
  total_visits?: number;
  unique_visitors?: number;
  mobile_visits?: number;
  desktop_visits?: number;
  tablet_visits?: number;
  bot_visits?: number;
  top_countries?: string;
  top_cities?: string;
  top_referers?: string;
}

// 链接设置类型
export interface LinkSettings {
  id: number;
  link_id: number;
  is_active: boolean;
  password: string | null;
  max_visits: number | null;
  redirect_type: string; // 301, 302, 307
  enable_preview: boolean;
  track_analytics: boolean;
  track_location: boolean;
  track_device: boolean;
  allowed_referers: string | null; // JSON字符串
  blocked_countries: string | null; // JSON字符串
  blocked_ips: string | null; // JSON字符串
  created_at: string;
  updated_at: string;
}

// 链接设置更新数据
export interface UpdateLinkSettingsData {
  is_active?: boolean;
  password?: string | null;
  max_visits?: number | null;
  redirect_type?: string;
  enable_preview?: boolean;
  track_analytics?: boolean;
  track_location?: boolean;
  track_device?: boolean;
  allowed_referers?: string | null;
  blocked_countries?: string | null;
  blocked_ips?: string | null;
}

// 系统配置类型
export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// 设备类型枚举
export type DeviceType = "mobile" | "desktop" | "tablet" | "bot" | "unknown";

// 重定向类型枚举
export type RedirectType = "301" | "302" | "307";

// ===================
// 分析 API 响应类型
// ===================

// 链接详细统计
export interface LinkDetailedStats {
  link: Link;
  settings: LinkSettings;
  todayVisits: number;
  weekVisits: number;
  monthVisits: number;
  totalVisits: number;
  uniqueVisitors: number;
  topCountries: Array<{ country: string; count: number }>;
  topCities: Array<{ city: string; count: number }>;
  topReferers: Array<{ referer: string; count: number }>;
  deviceStats: {
    mobile: number;
    desktop: number;
    tablet: number;
    bot: number;
  };
  recentVisits: AccessLog[];
}

// 链接详细统计响应
export interface LinkDetailedStatsResponse {
  success: boolean;
  data?: LinkDetailedStats;
  error?: string;
}

// 总体分析数据
export interface OverviewAnalytics {
  totalLinks: number;
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  weekVisits: number;
  monthVisits: number;

  // 趋势数据 (过去30天)
  visitsTrend: Array<{ date: string; visits: number; unique: number }>;

  // 设备分布
  deviceDistribution: {
    mobile: number;
    desktop: number;
    tablet: number;
    bot: number;
  };

  // 地理分布
  topCountries: Array<{ country: string; count: number }>;
  topCities: Array<{ city: string; count: number }>;

  // 热门链接
  topLinks: Array<{
    id: number;
    short_code: string;
    original_url: string;
    visits: number;
    unique_visitors: number;
  }>;

  // 来源分析
  topReferers: Array<{ referer: string; count: number }>;
}

// 总体分析响应
export interface OverviewAnalyticsResponse {
  success: boolean;
  data?: OverviewAnalytics;
  error?: string;
}

// 访问日志查询参数
export interface AccessLogQuery {
  linkId?: number;
  shortCode?: string;
  startDate?: string;
  endDate?: string;
  deviceType?: DeviceType;
  country?: string;
  page?: number;
  limit?: number;
}

// 访问日志列表响应
export interface AccessLogListResponse {
  success: boolean;
  data?: {
    logs: AccessLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

// 热门链接查询参数
export interface TopLinksQuery {
  period?: "today" | "week" | "month" | "all";
  limit?: number;
}

// 热门链接响应
export interface TopLinksResponse {
  success: boolean;
  data?: Array<{
    id: number;
    short_code: string;
    original_url: string;
    visits: number;
    unique_visitors: number;
    created_at: string;
  }>;
  error?: string;
}

// 访问趋势查询参数
export interface TrafficTrendQuery {
  linkId?: number;
  shortCode?: string;
  period?: "week" | "month" | "quarter" | "year";
  granularity?: "hour" | "day" | "week" | "month";
}

// 访问趋势响应
export interface TrafficTrendResponse {
  success: boolean;
  data?: Array<{
    date: string;
    visits: number;
    unique_visitors: number;
    devices: {
      mobile: number;
      desktop: number;
      tablet: number;
      bot: number;
    };
  }>;
  error?: string;
}

// 数据导出参数
export interface ExportQuery {
  linkId?: number;
  shortCode?: string;
  startDate?: string;
  endDate?: string;
  format?: "json" | "csv";
  includeHeaders?: boolean;
}

// User-Agent 解析结果
export interface ParsedUserAgent {
  device_type: DeviceType;
  browser: string;
  os: string;
  is_bot: boolean;
}

// IP 地理位置解析结果
export interface GeoLocation {
  country: string;
  city: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}
