/**
 * URL 验证工具测试
 */

import { describe, it, expect } from "vitest";
import {
  isValidUrl,
  isSafeUrl,
  normalizeUrl,
  validateUrl,
  isValidUrlLength,
  extractDomain,
  isSameResource,
} from "../../utils/urlValidator.js";

describe("URL 验证工具测试", () => {
  describe("isValidUrl", () => {
    it("应该验证有效的 HTTP URL", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("https://www.example.com/path")).toBe(true);
    });

    it("应该验证有效的 FTP URL", () => {
      expect(isValidUrl("ftp://ftp.example.com")).toBe(true);
      expect(isValidUrl("ftps://ftp.example.com")).toBe(true);
    });

    it("应该拒绝无效的 URL", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("javascript:alert(1)")).toBe(false);
      expect(isValidUrl("file:///etc/passwd")).toBe(false);
    });

    it("应该拒绝过长的 URL", () => {
      const longUrl = "https://example.com/" + "a".repeat(2050);
      expect(isValidUrl(longUrl)).toBe(false);
    });
  });

  describe("isSafeUrl", () => {
    it("应该允许安全的公网 URL", () => {
      expect(isSafeUrl("https://example.com")).toBe(true);
      expect(isSafeUrl("https://google.com")).toBe(true);
    });

    it("应该拒绝内网 URL", () => {
      expect(isSafeUrl("http://localhost")).toBe(false);
      expect(isSafeUrl("http://127.0.0.1")).toBe(false);
      expect(isSafeUrl("http://192.168.1.1")).toBe(false);
      expect(isSafeUrl("http://10.0.0.1")).toBe(false);
    });

    it("应该拒绝包含用户信息的 URL", () => {
      expect(isSafeUrl("https://user:pass@example.com")).toBe(false);
    });
  });

  describe("normalizeUrl", () => {
    it("应该添加协议前缀", () => {
      expect(normalizeUrl("example.com")).toBe("https://example.com/");
    });

    it("应该标准化主机名为小写", () => {
      expect(normalizeUrl("https://EXAMPLE.COM")).toBe("https://example.com/");
    });

    it("应该移除末尾斜杠（除了根路径）", () => {
      expect(normalizeUrl("https://example.com/path/")).toBe(
        "https://example.com/path"
      );
      expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
    });

    it("应该移除默认端口", () => {
      expect(normalizeUrl("https://example.com:443")).toBe(
        "https://example.com/"
      );
      expect(normalizeUrl("http://example.com:80")).toBe("http://example.com/");
    });
  });

  describe("validateUrl", () => {
    it("应该验证有效 URL 并返回标准化结果", () => {
      const result = validateUrl("example.com");
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBe("https://example.com/");
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝无效 URL 并返回错误信息", () => {
      const result = validateUrl("not-a-url");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("应该检查 URL 长度限制", () => {
      const result = validateUrl("example.com", { maxLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("URL 长度不能超过 5 字符");
    });

    it("应该允许不安全的 URL（当设置时）", () => {
      const result = validateUrl("http://localhost", { allowUnsafe: true });
      expect(result.isValid).toBe(true);
    });
  });

  describe("extractDomain", () => {
    it("应该正确提取域名", () => {
      expect(extractDomain("https://example.com/path")).toBe("example.com");
      expect(extractDomain("http://subdomain.example.com")).toBe(
        "subdomain.example.com"
      );
    });

    it("应该处理无效 URL", () => {
      expect(extractDomain("not-a-url")).toBe(null);
    });
  });

  describe("isSameResource", () => {
    it("应该识别相同的资源", () => {
      expect(
        isSameResource(
          "https://example.com/path",
          "https://example.com/path?query=1"
        )
      ).toBe(true);

      expect(
        isSameResource("example.com/path", "https://example.com/path")
      ).toBe(true);
    });

    it("应该识别不同的资源", () => {
      expect(
        isSameResource("https://example.com/path1", "https://example.com/path2")
      ).toBe(false);
    });
  });
});
