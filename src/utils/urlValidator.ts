/**
 * URL 验证工具
 * 提供 URL 格式验证、安全检查和标准化功能
 */

import { z } from "zod";

// URL 验证的 Zod Schema
export const urlSchema = z
  .string()
  .min(1, "URL 不能为空")
  .max(2048, "URL 长度不能超过 2048 字符")
  .url("URL 格式无效");

// 自定义 URL 验证 Schema（支持更多协议）
export const customUrlSchema = z
  .string()
  .min(1, "URL 不能为空")
  .max(2048, "URL 长度不能超过 2048 字符")
  .refine((url) => isValidUrl(url), {
    message: "URL 格式无效或协议不受支持",
  });

// 支持的协议列表
const ALLOWED_PROTOCOLS = ["http:", "https:", "ftp:", "ftps:"];

// 内网 IP 地址范围
const PRIVATE_IP_RANGES = [
  /^127\./, // 127.0.0.0/8 (localhost)
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // 169.254.0.0/16 (link-local)
  /^::1$/, // IPv6 localhost
  /^fc00:/, // IPv6 unique local addresses
  /^fe80:/, // IPv6 link-local addresses
];

// 危险域名黑名单（示例）
const DANGEROUS_DOMAINS = [
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  // 可以根据需要添加更多危险域名
];

/**
 * 检查 URL 格式是否有效
 * @param url - 要验证的 URL 字符串
 * @returns 是否为有效的 URL 格式
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // 检查协议是否被允许
    if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return false;
    }

    // 检查主机名是否存在
    if (!urlObj.hostname) {
      return false;
    }

    // 检查 URL 长度
    if (url.length > 2048) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 检查 URL 是否安全（非内网地址、非恶意域名）
 * @param url - 要检查的 URL 字符串
 * @returns 是否为安全的 URL
 */
export function isSafeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // 检查是否在危险域名黑名单中
    if (DANGEROUS_DOMAINS.includes(hostname)) {
      return false;
    }

    // 检查是否为内网 IP 地址
    if (isPrivateIpAddress(hostname)) {
      return false;
    }

    // 检查端口是否为常见危险端口
    if (isDangerousPort(urlObj.port)) {
      return false;
    }

    // 检查是否包含可疑的用户信息
    if (urlObj.username || urlObj.password) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 检查主机名是否为内网 IP 地址
 * @param hostname - 主机名或 IP 地址
 * @returns 是否为内网地址
 */
function isPrivateIpAddress(hostname: string): boolean {
  // 检查 IPv4 内网地址
  for (const range of PRIVATE_IP_RANGES) {
    if (range.test(hostname)) {
      return true;
    }
  }

  // 检查是否为纯数字 IP（简单检查）
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    const parts = hostname.split(".").map(Number);

    // 检查是否为保留地址
    if (parts[0] === 0 || parts[0] === 255) {
      return true;
    }

    // 检查组播地址 224.0.0.0/4
    if (parts[0] >= 224 && parts[0] <= 239) {
      return true;
    }
  }

  return false;
}

/**
 * 检查端口是否为危险端口
 * @param port - 端口号字符串
 * @returns 是否为危险端口
 */
function isDangerousPort(port: string): boolean {
  if (!port) return false;

  const portNum = parseInt(port, 10);

  // 危险端口列表（系统端口和常见服务端口）
  const dangerousPorts = [
    22, // SSH
    23, // Telnet
    25, // SMTP
    53, // DNS
    110, // POP3
    143, // IMAP
    993, // IMAPS
    995, // POP3S
    1433, // SQL Server
    3306, // MySQL
    5432, // PostgreSQL
    6379, // Redis
  ];

  return dangerousPorts.includes(portNum);
}

/**
 * 标准化 URL 格式
 * @param url - 要标准化的 URL 字符串
 * @returns 标准化后的 URL 字符串
 */
export function normalizeUrl(url: string): string {
  try {
    let normalizedUrl = url.trim();

    // 如果没有协议前缀，默认添加 https://
    // 但要确保看起来像是一个有效的域名
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      // 简单检查是否包含域名特征（至少有一个点或者是已知的顶级域名）
      if (
        !/\.|localhost/i.test(normalizedUrl) &&
        normalizedUrl !== "localhost"
      ) {
        throw new Error("Invalid domain format");
      }
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const urlObj = new URL(normalizedUrl);

    // 标准化主机名（转为小写）
    urlObj.hostname = urlObj.hostname.toLowerCase();

    // 移除默认端口
    if (
      (urlObj.protocol === "http:" && urlObj.port === "80") ||
      (urlObj.protocol === "https:" && urlObj.port === "443")
    ) {
      urlObj.port = "";
    }

    // 标准化路径（移除末尾的斜杠，除非是根路径）
    if (urlObj.pathname !== "/" && urlObj.pathname.endsWith("/")) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    // 如果路径为空，设置为根路径
    if (!urlObj.pathname) {
      urlObj.pathname = "/";
    }

    return urlObj.toString();
  } catch {
    // 如果标准化失败，返回原始 URL
    return url;
  }
}

/**
 * 检查 URL 长度是否在限制范围内
 * @param url - 要检查的 URL 字符串
 * @param maxLength - 最大长度限制（默认 2048）
 * @returns 是否在长度限制内
 */
export function isValidUrlLength(
  url: string,
  maxLength: number = 2048
): boolean {
  return url.length <= maxLength && url.length > 0;
}

/**
 * 完整的 URL 验证函数
 * 组合格式验证、安全检查和长度检查
 * @param url - 要验证的 URL 字符串
 * @param options - 验证选项
 * @returns 验证结果对象
 */
export function validateUrl(
  url: string,
  options: {
    maxLength?: number;
    allowUnsafe?: boolean;
    normalize?: boolean;
  } = {}
): {
  isValid: boolean;
  normalizedUrl?: string;
  errors: string[];
} {
  const { maxLength = 2048, allowUnsafe = false, normalize = true } = options;
  const errors: string[] = [];

  // 基础格式检查
  if (!url || typeof url !== "string") {
    errors.push("URL 不能为空");
    return { isValid: false, errors };
  }

  // 长度检查
  if (!isValidUrlLength(url, maxLength)) {
    errors.push(`URL 长度不能超过 ${maxLength} 字符`);
    return { isValid: false, errors };
  }

  // 先标准化 URL（如果需要）
  let normalizedUrl = url;
  if (normalize) {
    normalizedUrl = normalizeUrl(url);
  }

  // 格式验证（使用标准化后的 URL）
  if (!isValidUrl(normalizedUrl)) {
    errors.push("URL 格式无效或协议不受支持");
    return { isValid: false, errors };
  }

  // 安全检查（使用标准化后的 URL）
  if (!allowUnsafe && !isSafeUrl(normalizedUrl)) {
    errors.push("URL 不安全：不允许内网地址或危险域名");
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    normalizedUrl,
    errors: [],
  };
}

/**
 * 使用 Zod Schema 验证 URL
 * @param url - 要验证的 URL 字符串
 * @returns Zod 验证结果
 */
export function validateUrlWithZod(url: string) {
  return customUrlSchema.safeParse(url);
}

/**
 * 提取 URL 的域名
 * @param url - URL 字符串
 * @returns 域名字符串，失败返回 null
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * 检查两个 URL 是否指向同一个资源（忽略片段和查询参数）
 * @param url1 - 第一个 URL
 * @param url2 - 第二个 URL
 * @returns 是否为相同资源
 */
export function isSameResource(url1: string, url2: string): boolean {
  try {
    const normalizedUrl1 = normalizeUrl(url1);
    const normalizedUrl2 = normalizeUrl(url2);

    const urlObj1 = new URL(normalizedUrl1);
    const urlObj2 = new URL(normalizedUrl2);

    // 比较协议、主机名、端口和路径
    return (
      urlObj1.protocol === urlObj2.protocol &&
      urlObj1.hostname === urlObj2.hostname &&
      urlObj1.port === urlObj2.port &&
      urlObj1.pathname === urlObj2.pathname
    );
  } catch {
    return false;
  }
}
