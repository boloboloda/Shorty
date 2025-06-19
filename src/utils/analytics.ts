/**
 * 分析工具 - 处理访问分析相关功能
 */

import { DeviceType, ParsedUserAgent, GeoLocation } from "../types/index.js";

/**
 * 解析 User-Agent 字符串
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  if (!userAgent) {
    return {
      device_type: "unknown",
      browser: "Unknown",
      os: "Unknown",
      is_bot: false,
    };
  }

  const ua = userAgent.toLowerCase();

  // 检测机器人
  const botPatterns = [
    "bot",
    "crawler",
    "spider",
    "scraper",
    "parser",
    "checker",
    "monitor",
    "validator",
    "test",
    "curl",
    "wget",
    "fetch",
    "googlebot",
    "bingbot",
    "yahoo",
    "baiduspider",
    "facebookexternalhit",
    "twitterbot",
    "linkedinbot",
    "whatsapp",
    "telegrambot",
    "slackbot",
  ];

  const isBot = botPatterns.some((pattern) => ua.includes(pattern));

  if (isBot) {
    return {
      device_type: "bot",
      browser: extractBotName(userAgent),
      os: "Bot",
      is_bot: true,
    };
  }

  // 检测设备类型
  const deviceType = detectDeviceType(ua);

  // 检测浏览器
  const browser = detectBrowser(ua);

  // 检测操作系统
  const os = detectOS(ua);

  return {
    device_type: deviceType,
    browser,
    os,
    is_bot: false,
  };
}

/**
 * 检测设备类型
 */
function detectDeviceType(ua: string): DeviceType {
  // 移动设备检测
  const mobilePatterns = [
    "mobile",
    "android",
    "iphone",
    "ipod",
    "blackberry",
    "windows phone",
    "nokia",
    "samsung",
    "htc",
    "lg",
  ];

  // 平板设备检测
  const tabletPatterns = [
    "tablet",
    "ipad",
    "kindle",
    "nexus 7",
    "nexus 9",
    "nexus 10",
    "galaxy tab",
    "xoom",
    "transformer",
  ];

  if (tabletPatterns.some((pattern) => ua.includes(pattern))) {
    return "tablet";
  }

  if (mobilePatterns.some((pattern) => ua.includes(pattern))) {
    return "mobile";
  }

  return "desktop";
}

/**
 * 检测浏览器
 */
function detectBrowser(ua: string): string {
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome/")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("opera/") || ua.includes("opr/")) return "Opera";
  if (ua.includes("msie") || ua.includes("trident/"))
    return "Internet Explorer";
  if (ua.includes("ucbrowser/")) return "UC Browser";
  if (ua.includes("samsungbrowser/")) return "Samsung Browser";

  return "Unknown";
}

/**
 * 检测操作系统
 */
function detectOS(ua: string): string {
  if (ua.includes("windows nt 10.0")) return "Windows 10";
  if (ua.includes("windows nt 6.3")) return "Windows 8.1";
  if (ua.includes("windows nt 6.2")) return "Windows 8";
  if (ua.includes("windows nt 6.1")) return "Windows 7";
  if (ua.includes("windows nt")) return "Windows";

  if (ua.includes("mac os x")) {
    const match = ua.match(/mac os x ([\d_]+)/);
    if (match) {
      const version = match[1].replace(/_/g, ".");
      return `macOS ${version}`;
    }
    return "macOS";
  }

  if (ua.includes("iphone os")) {
    const match = ua.match(/iphone os ([\d_]+)/);
    if (match) {
      const version = match[1].replace(/_/g, ".");
      return `iOS ${version}`;
    }
    return "iOS";
  }

  if (ua.includes("android")) {
    const match = ua.match(/android ([\d.]+)/);
    if (match) {
      return `Android ${match[1]}`;
    }
    return "Android";
  }

  if (ua.includes("linux")) return "Linux";
  if (ua.includes("ubuntu")) return "Ubuntu";
  if (ua.includes("debian")) return "Debian";
  if (ua.includes("fedora")) return "Fedora";
  if (ua.includes("centos")) return "CentOS";

  return "Unknown";
}

/**
 * 提取机器人名称
 */
function extractBotName(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes("googlebot")) return "Googlebot";
  if (ua.includes("bingbot")) return "Bingbot";
  if (ua.includes("yahoobot")) return "Yahoo Bot";
  if (ua.includes("baiduspider")) return "Baidu Spider";
  if (ua.includes("facebookexternalhit")) return "Facebook Bot";
  if (ua.includes("twitterbot")) return "Twitter Bot";
  if (ua.includes("linkedinbot")) return "LinkedIn Bot";
  if (ua.includes("whatsapp")) return "WhatsApp Bot";
  if (ua.includes("telegrambot")) return "Telegram Bot";
  if (ua.includes("slackbot")) return "Slack Bot";
  if (ua.includes("discordbot")) return "Discord Bot";

  // 通用机器人检测
  const botMatch = userAgent.match(/(\w+bot|\w+crawler|\w+spider)/i);
  if (botMatch) {
    return botMatch[1];
  }

  return "Unknown Bot";
}

/**
 * 从 IP 地址获取地理位置信息
 * 注意：这是一个简化的实现，在生产环境中应该使用专业的 GeoIP 服务
 */
export async function getGeoLocation(
  ipAddress: string
): Promise<GeoLocation | null> {
  // 跳过内网和本地 IP
  if (isPrivateIP(ipAddress)) {
    return null;
  }

  try {
    // 这里可以集成第三方 GeoIP 服务
    // 如：ipapi.co, ipinfo.io, maxmind 等
    // 为了演示，我们使用一个免费的公共 API
    const response = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,country,city,regionName,lat,lon`
    );

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();

    if (data.status !== "success") {
      return null;
    }

    return {
      country: data.country || "Unknown",
      city: data.city || "Unknown",
      region: data.regionName,
      latitude: data.lat,
      longitude: data.lon,
    };
  } catch (error) {
    console.warn("Failed to get geo location:", error);
    return null;
  }
}

/**
 * 检测是否为内网 IP
 */
function isPrivateIP(ip: string): boolean {
  if (!ip) return true;

  // IPv4 内网地址范围
  const privateRanges = [
    /^127\./, // 127.0.0.0/8 (loopback)
    /^10\./, // 10.0.0.0/8 (private)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (private)
    /^192\.168\./, // 192.168.0.0/16 (private)
    /^169\.254\./, // 169.254.0.0/16 (link-local)
    /^::1$/, // IPv6 loopback
    /^fc00:/, // IPv6 private
    /^fe80:/, // IPv6 link-local
  ];

  return privateRanges.some((range) => range.test(ip)) || ip === "localhost";
}

/**
 * 获取客户端真实 IP 地址
 */
export function getClientIP(request: Request): string {
  // 从 Cloudflare 头部获取真实 IP
  const cfConnectingIP = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // 备选头部
  const xForwardedFor = request.headers.get("X-Forwarded-For");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIP = request.headers.get("X-Real-IP");
  if (xRealIP) {
    return xRealIP;
  }

  // 如果都没有，返回默认值
  return "127.0.0.1";
}

/**
 * 提取域名（用于 Referer 分析）
 */
export function extractDomain(url: string): string {
  if (!url) return "Direct";

  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return "Unknown";
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDateToYMD(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

/**
 * 获取日期范围
 */
export function getDateRange(
  period: "today" | "week" | "month" | "quarter" | "year"
): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = formatDateToYMD(now);

  let startDate: string;

  switch (period) {
    case "today":
      startDate = endDate;
      break;
    case "week":
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = formatDateToYMD(weekAgo);
      break;
    case "month":
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = formatDateToYMD(monthAgo);
      break;
    case "quarter":
      const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      startDate = formatDateToYMD(quarterAgo);
      break;
    case "year":
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      startDate = formatDateToYMD(yearAgo);
      break;
    default:
      startDate = endDate;
  }

  return { startDate, endDate };
}

/**
 * 聚合 JSON 数据（用于 top_countries, top_cities 等字段）
 */
export function aggregateTopItems<T extends { [key: string]: any }>(
  items: T[],
  keyField: keyof T,
  limit: number = 5
): string {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = String(item[keyField] || "Unknown");
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const sorted = Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([key, count]) => ({ [keyField]: key, count }));

  return JSON.stringify(sorted);
}

/**
 * 解析聚合的 JSON 数据
 */
export function parseTopItems(jsonStr: string): Array<{ [key: string]: any }> {
  try {
    return JSON.parse(jsonStr || "[]");
  } catch {
    return [];
  }
}

/**
 * 计算访问间隔（用于检测频率限制）
 */
export function calculateVisitInterval(
  lastVisit: Date,
  currentVisit: Date = new Date()
): number {
  return Math.floor((currentVisit.getTime() - lastVisit.getTime()) / 1000); // 返回秒数
}

/**
 * 验证访问频率限制
 */
export function checkRateLimit(
  visits: Array<{ accessed_at: string }>,
  limitPerMinute: number = 60
): boolean {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  const recentVisits = visits.filter(
    (visit) => new Date(visit.accessed_at) > oneMinuteAgo
  );

  return recentVisits.length < limitPerMinute;
}

/**
 * 生成分析摘要
 */
export function generateAnalyticsSummary(stats: {
  totalVisits: number;
  uniqueVisitors: number;
  deviceStats: Record<string, number>;
  countryStats: Array<{ country: string; count: number }>;
}): string {
  const { totalVisits, uniqueVisitors, deviceStats, countryStats } = stats;

  const topDevice = Object.entries(deviceStats).sort(
    ([, a], [, b]) => b - a
  )[0];

  const topCountry = countryStats[0];

  return (
    `总访问: ${totalVisits}, 独立访客: ${uniqueVisitors}, ` +
    `主要设备: ${topDevice?.[0] || "Unknown"} (${topDevice?.[1] || 0}), ` +
    `主要国家: ${topCountry?.country || "Unknown"} (${topCountry?.count || 0})`
  );
}
