/**
 * 短码生成器测试
 */

import { describe, it, expect } from "vitest";
import {
  generateRandomSlug,
  numberToBase62,
  base62ToNumber,
  generateTimestampSlug,
  isValidSlugFormat,
  isSafeSlug,
  generateSlug,
  validateCustomSlug,
  generateSlugSuggestions,
  calculatePossibleCombinations,
  estimateCollisionProbability,
} from "../../utils/slugGenerator.js";

describe("短码生成器测试", () => {
  describe("generateRandomSlug", () => {
    it("应该生成指定长度的随机短码", () => {
      const slug = generateRandomSlug(6);
      expect(slug).toHaveLength(6);
      expect(typeof slug).toBe("string");
    });

    it("应该生成不同的随机短码", () => {
      const slug1 = generateRandomSlug(8);
      const slug2 = generateRandomSlug(8);
      expect(slug1).not.toBe(slug2); // 虽然理论上可能相同，但概率极小
    });

    it("应该只包含 Base62 字符", () => {
      const slug = generateRandomSlug(20);
      const base62Pattern = /^[a-zA-Z0-9]+$/;
      expect(base62Pattern.test(slug)).toBe(true);
    });
  });

  describe("Base62 编码转换", () => {
    describe("numberToBase62", () => {
      it("应该正确转换数字为 Base62", () => {
        expect(numberToBase62(0)).toBe("a");
        expect(numberToBase62(61)).toBe("9");
        expect(numberToBase62(62)).toBe("ba");
        expect(numberToBase62(123456)).toHaveLength(4);
      });

      it("应该处理大数字", () => {
        const bigNumber = Date.now();
        const encoded = numberToBase62(bigNumber);
        expect(encoded).toBeTruthy();
        expect(typeof encoded).toBe("string");
      });
    });

    describe("base62ToNumber", () => {
      it("应该正确将 Base62 转换为数字", () => {
        expect(base62ToNumber("a")).toBe(0);
        expect(base62ToNumber("9")).toBe(61);
        expect(base62ToNumber("ba")).toBe(62);
      });

      it("应该与 numberToBase62 互为逆操作", () => {
        const testNumbers = [0, 1, 61, 62, 123, 456789];
        for (const num of testNumbers) {
          const encoded = numberToBase62(num);
          const decoded = base62ToNumber(encoded);
          expect(decoded).toBe(num);
        }
      });

      it("应该处理无效字符时抛出错误", () => {
        expect(() => base62ToNumber("invalid!")).toThrow();
      });
    });
  });

  describe("generateTimestampSlug", () => {
    it("应该生成指定长度的时间戳短码", () => {
      const slug = generateTimestampSlug(8);
      expect(slug).toHaveLength(8);
    });

    it("应该生成不同的时间戳短码", () => {
      const slug1 = generateTimestampSlug(6);
      const slug2 = generateTimestampSlug(6);
      // 应该不同（包含随机成分）
      expect(slug1).not.toBe(slug2);
    });
  });

  describe("isValidSlugFormat", () => {
    it("应该验证有效的短码格式", () => {
      expect(isValidSlugFormat("abcDEF123")).toBe(true);
      expect(isValidSlugFormat("test")).toBe(true);
      expect(isValidSlugFormat("Test123")).toBe(true);
    });

    it("应该拒绝无效的短码格式", () => {
      expect(isValidSlugFormat("")).toBe(false);
      expect(isValidSlugFormat("ab")).toBe(false); // 太短
      expect(isValidSlugFormat("a".repeat(20))).toBe(false); // 太长
      expect(isValidSlugFormat("test!")).toBe(false); // 无效字符
      expect(isValidSlugFormat("test-123")).toBe(false); // 包含连字符
    });

    it("应该支持自定义配置", () => {
      const config = { minLength: 2, maxLength: 10 };
      expect(isValidSlugFormat("ab", config)).toBe(true);
      expect(isValidSlugFormat("a", config)).toBe(false);
    });
  });

  describe("isSafeSlug", () => {
    it("应该允许安全的短码", () => {
      expect(isSafeSlug("abcDEF")).toBe(true);
      expect(isSafeSlug("random123")).toBe(true);
      expect(isSafeSlug("myLink")).toBe(true);
    });

    it("应该拒绝包含敏感词的短码", () => {
      expect(isSafeSlug("admin")).toBe(false);
      expect(isSafeSlug("testapi")).toBe(false);
      expect(isSafeSlug("admintest")).toBe(false);
    });

    it("应该拒绝纯数字短码", () => {
      expect(isSafeSlug("123456")).toBe(false);
      expect(isSafeSlug("000")).toBe(false);
    });

    it("应该拒绝容易混淆的字符组合", () => {
      expect(isSafeSlug("0000")).toBe(false);
      expect(isSafeSlug("OOOO")).toBe(false);
      expect(isSafeSlug("1111")).toBe(false);
      expect(isSafeSlug("llll")).toBe(false);
    });
  });

  describe("generateSlug", () => {
    it("应该成功生成短码", async () => {
      const result = await generateSlug();
      expect(result.success).toBe(true);
      expect(result.slug).toBeTruthy();
      expect(result.attempts).toBeGreaterThan(0);
    });

    it("应该支持自定义配置", async () => {
      const config = { length: 8, maxRetries: 5 };
      const result = await generateSlug(config);

      if (result.success) {
        expect(result.slug).toHaveLength(8);
      }
      expect(result.attempts).toBeLessThanOrEqual(5);
    });

    it("应该检测重复短码", async () => {
      const existingSlug = "testSlug";

      // 模拟存在性检查函数
      const existsChecker = async (slug: string) => {
        return slug === existingSlug;
      };

      const result = await generateSlug({ length: 8 }, existsChecker);

      if (result.success) {
        expect(result.slug).not.toBe(existingSlug);
      }
    });

    it("应该在超过重试次数后失败", async () => {
      // 模拟所有短码都存在的情况
      const existsChecker = async () => true;

      const result = await generateSlug({ maxRetries: 3 }, existsChecker);

      expect(result.success).toBe(false);
      expect(result.error).toContain("超过最大重试次数");
      expect(result.attempts).toBe(3);
    });
  });

  describe("validateCustomSlug", () => {
    it("应该验证有效的自定义短码", () => {
      const result = validateCustomSlug("myLink123");
      expect(result.isValid).toBe(true);
      expect(result.slug).toBe("myLink123");
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝无效的自定义短码", () => {
      const result = validateCustomSlug("invalid!");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("应该拒绝包含敏感词的自定义短码", () => {
      const result = validateCustomSlug("admin123");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("短码包含敏感词汇或不安全的字符组合");
    });

    it("应该处理空值", () => {
      const result1 = validateCustomSlug("");
      const result2 = validateCustomSlug("   ");

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });

    it("应该标准化短码（去除空格）", () => {
      const result = validateCustomSlug("  testSlug  ");
      if (result.isValid) {
        expect(result.slug).toBe("testSlug");
      }
    });
  });

  describe("generateSlugSuggestions", () => {
    it("应该生成指定数量的建议", async () => {
      const suggestions = await generateSlugSuggestions(undefined, 5);
      expect(suggestions).toHaveLength(5);
      expect(suggestions.every((slug) => typeof slug === "string")).toBe(true);
    });

    it("应该基于基础短码生成变体", async () => {
      const baseSlug = "test";
      const suggestions = await generateSlugSuggestions(baseSlug, 3);

      expect(suggestions).toHaveLength(3);
      // 至少应该有一些建议包含基础短码
      const hasVariants = suggestions.some((slug) => slug.includes(baseSlug));
      expect(hasVariants).toBe(true);
    });

    it("应该生成唯一的建议", async () => {
      const suggestions = await generateSlugSuggestions(undefined, 10);
      const uniqueSuggestions = new Set(suggestions);
      expect(uniqueSuggestions.size).toBe(suggestions.length);
    });
  });

  describe("calculatePossibleCombinations", () => {
    it("应该正确计算可能的组合数", () => {
      expect(calculatePossibleCombinations(1)).toBe(62);
      expect(calculatePossibleCombinations(2)).toBe(62 * 62);
      expect(calculatePossibleCombinations(3)).toBe(62 * 62 * 62);
    });

    it("应该支持自定义字符集", () => {
      const customCharset = "abc";
      expect(calculatePossibleCombinations(2, customCharset)).toBe(9);
    });
  });

  describe("estimateCollisionProbability", () => {
    it("应该返回合理的冲突概率", () => {
      expect(estimateCollisionProbability(0, 6)).toBe(0);
      expect(estimateCollisionProbability(1, 6)).toBe(0);

      const prob = estimateCollisionProbability(1000, 6);
      expect(prob).toBeGreaterThan(0);
      expect(prob).toBeLessThan(1);
    });

    it("应该在达到总组合数时返回 1", () => {
      const totalCombinations = calculatePossibleCombinations(2);
      const prob = estimateCollisionProbability(totalCombinations, 2);
      expect(prob).toBe(1);
    });
  });
});
