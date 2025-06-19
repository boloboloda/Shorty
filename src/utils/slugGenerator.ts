/**
 * 短码生成器
 * 实现 Base62 编码的短链接代码生成，支持冲突检测和自定义短码
 */

// Base62 字符集：a-z, A-Z, 0-9
const BASE62_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BASE62_LENGTH = BASE62_CHARS.length; // 62

// 短码配置
export interface SlugConfig {
  length?: number; // 短码长度
  maxRetries?: number; // 最大重试次数
  minLength?: number; // 最小长度
  maxLength?: number; // 最大长度
  excludeChars?: string[]; // 排除的字符
  customChars?: string; // 自定义字符集
}

// 短码生成结果
export interface SlugResult {
  success: boolean;
  slug?: string;
  attempts: number;
  error?: string;
}

// 默认配置
const DEFAULT_CONFIG: Required<SlugConfig> = {
  length: 6,
  maxRetries: 10,
  minLength: 4,
  maxLength: 16,
  excludeChars: [],
  customChars: BASE62_CHARS,
};

/**
 * 生成随机 Base62 短码
 * @param length - 短码长度
 * @param charset - 字符集
 * @returns 生成的短码
 */
export function generateRandomSlug(
  length: number,
  charset: string = BASE62_CHARS
): string {
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }

  return result;
}

/**
 * 将数字转换为 Base62 编码
 * @param num - 要编码的数字
 * @param charset - 字符集
 * @returns Base62 编码字符串
 */
export function numberToBase62(
  num: number,
  charset: string = BASE62_CHARS
): string {
  if (num === 0) return charset[0];

  let result = "";
  const base = charset.length;

  while (num > 0) {
    result = charset[num % base] + result;
    num = Math.floor(num / base);
  }

  return result;
}

/**
 * 将 Base62 编码转换为数字
 * @param encoded - Base62 编码字符串
 * @param charset - 字符集
 * @returns 解码后的数字
 */
export function base62ToNumber(
  encoded: string,
  charset: string = BASE62_CHARS
): number {
  let result = 0;
  const base = charset.length;

  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const charIndex = charset.indexOf(char);

    if (charIndex === -1) {
      throw new Error(`Invalid character in Base62 string: ${char}`);
    }

    result = result * base + charIndex;
  }

  return result;
}

/**
 * 生成基于时间戳的短码
 * @param length - 目标长度
 * @param charset - 字符集
 * @returns 基于时间戳的短码
 */
export function generateTimestampSlug(
  length: number,
  charset: string = BASE62_CHARS
): string {
  // 使用当前时间戳（毫秒）
  const timestamp = Date.now();

  // 添加一些随机性以避免同一毫秒内的冲突
  const randomSuffix = Math.floor(Math.random() * 1000);
  const combined = timestamp * 1000 + randomSuffix;

  let encoded = numberToBase62(combined, charset);

  // 如果编码结果太短，在前面补随机字符
  while (encoded.length < length) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    encoded = charset[randomIndex] + encoded;
  }

  // 如果编码结果太长，截取后面的部分
  if (encoded.length > length) {
    encoded = encoded.slice(-length);
  }

  return encoded;
}

/**
 * 验证短码格式是否有效
 * @param slug - 要验证的短码
 * @param config - 配置选项
 * @returns 是否为有效的短码格式
 */
export function isValidSlugFormat(
  slug: string,
  config: Partial<SlugConfig> = {}
): boolean {
  const { minLength, maxLength, excludeChars, customChars } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // 检查长度
  if (slug.length < minLength || slug.length > maxLength) {
    return false;
  }

  // 检查字符是否在允许的字符集中
  for (const char of slug) {
    if (!customChars.includes(char)) {
      return false;
    }
  }

  // 检查是否包含排除的字符
  for (const excludeChar of excludeChars) {
    if (slug.includes(excludeChar)) {
      return false;
    }
  }

  return true;
}

/**
 * 检查短码是否安全（不包含敏感词汇）
 * @param slug - 要检查的短码
 * @returns 是否为安全的短码
 */
export function isSafeSlug(slug: string): boolean {
  // 敏感词汇黑名单（可以根据需要扩展）
  const UNSAFE_WORDS = [
    "admin",
    "api",
    "www",
    "mail",
    "ftp",
    "root",
    "test",
    "debug",
    "config",
    "login",
    "auth",
    "user",
    "pass",
    "sex",
    "fuck",
    "shit",
    "damn",
    "hell",
    "porn",
    // 可以添加更多敏感词
  ];

  const lowerSlug = slug.toLowerCase();

  // 检查是否包含敏感词
  for (const word of UNSAFE_WORDS) {
    if (lowerSlug.includes(word)) {
      return false;
    }
  }

  // 检查是否全为数字（可能与 ID 冲突）
  if (/^\d+$/.test(slug)) {
    return false;
  }

  // 检查是否包含容易混淆的字符组合
  const confusingPatterns = [
    /^(0+|O+)$/i, // 全为 0 或 O
    /^(1+|l+|I+)$/i, // 全为 1、l 或 I
  ];

  for (const pattern of confusingPatterns) {
    if (pattern.test(slug)) {
      return false;
    }
  }

  return true;
}

/**
 * 生成短码的主函数
 * @param config - 配置选项
 * @param existsChecker - 检查短码是否已存在的函数
 * @returns 短码生成结果
 */
export async function generateSlug(
  config: Partial<SlugConfig> = {},
  existsChecker?: (slug: string) => Promise<boolean>
): Promise<SlugResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let attempts = 0;

  while (attempts < finalConfig.maxRetries) {
    attempts++;

    let slug: string;

    // 根据配置生成短码
    if (attempts <= 3) {
      // 前3次尝试使用时间戳方法（更不容易冲突）
      slug = generateTimestampSlug(finalConfig.length, finalConfig.customChars);
    } else {
      // 后续尝试使用纯随机方法
      slug = generateRandomSlug(finalConfig.length, finalConfig.customChars);
    }

    // 验证格式
    if (!isValidSlugFormat(slug, finalConfig)) {
      continue;
    }

    // 验证安全性
    if (!isSafeSlug(slug)) {
      continue;
    }

    // 检查是否已存在（如果提供了检查函数）
    if (existsChecker) {
      const exists = await existsChecker(slug);
      if (exists) {
        // 如果冲突次数过多，增加长度
        if (attempts >= Math.floor(finalConfig.maxRetries / 2)) {
          finalConfig.length = Math.min(
            finalConfig.length + 1,
            finalConfig.maxLength
          );
        }
        continue;
      }
    }

    return {
      success: true,
      slug,
      attempts,
    };
  }

  return {
    success: false,
    attempts,
    error: `生成短码失败：超过最大重试次数 ${finalConfig.maxRetries}`,
  };
}

/**
 * 验证和标准化自定义短码
 * @param customSlug - 用户提供的自定义短码
 * @param config - 配置选项
 * @returns 验证结果
 */
export function validateCustomSlug(
  customSlug: string,
  config: Partial<SlugConfig> = {}
): { isValid: boolean; slug?: string; errors: string[] } {
  const errors: string[] = [];

  // 基础格式检查
  if (!customSlug || typeof customSlug !== "string") {
    errors.push("短码不能为空");
    return { isValid: false, errors };
  }

  // 移除空格并转换为合适的格式
  const normalizedSlug = customSlug.trim();

  if (!normalizedSlug) {
    errors.push("短码不能为空");
    return { isValid: false, errors };
  }

  // 格式验证
  if (!isValidSlugFormat(normalizedSlug, config)) {
    const { minLength, maxLength } = { ...DEFAULT_CONFIG, ...config };

    if (normalizedSlug.length < minLength) {
      errors.push(`短码长度不能少于 ${minLength} 个字符`);
    }

    if (normalizedSlug.length > maxLength) {
      errors.push(`短码长度不能超过 ${maxLength} 个字符`);
    }

    // 检查字符
    const invalidChars = [];
    for (const char of normalizedSlug) {
      if (!BASE62_CHARS.includes(char)) {
        invalidChars.push(char);
      }
    }

    if (invalidChars.length > 0) {
      errors.push(`短码包含无效字符: ${invalidChars.join(", ")}`);
    }
  }

  // 安全性检查
  if (!isSafeSlug(normalizedSlug)) {
    errors.push("短码包含敏感词汇或不安全的字符组合");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    slug: normalizedSlug,
    errors: [],
  };
}

/**
 * 生成短码建议列表
 * @param baseSlug - 基础短码（可选）
 * @param count - 建议数量
 * @param config - 配置选项
 * @returns 短码建议列表
 */
export async function generateSlugSuggestions(
  baseSlug?: string,
  count: number = 5,
  config: Partial<SlugConfig> = {}
): Promise<string[]> {
  const suggestions: Set<string> = new Set();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 如果提供了基础短码，生成变体
  if (baseSlug && isValidSlugFormat(baseSlug, finalConfig)) {
    // 添加数字后缀
    for (let i = 1; i <= 9 && suggestions.size < count; i++) {
      const suggestion = baseSlug + i;
      if (
        isValidSlugFormat(suggestion, finalConfig) &&
        isSafeSlug(suggestion)
      ) {
        suggestions.add(suggestion);
      }
    }

    // 添加随机后缀
    while (suggestions.size < count) {
      const randomSuffix = generateRandomSlug(2, finalConfig.customChars);
      const suggestion = baseSlug + randomSuffix;
      if (
        isValidSlugFormat(suggestion, finalConfig) &&
        isSafeSlug(suggestion)
      ) {
        suggestions.add(suggestion);
      }
    }
  }

  // 生成随机建议
  while (suggestions.size < count) {
    const randomSlug = generateRandomSlug(
      finalConfig.length,
      finalConfig.customChars
    );
    if (isSafeSlug(randomSlug)) {
      suggestions.add(randomSlug);
    }
  }

  return Array.from(suggestions);
}

/**
 * 计算短码的可能组合数
 * @param length - 短码长度
 * @param charset - 字符集
 * @returns 可能的组合数
 */
export function calculatePossibleCombinations(
  length: number,
  charset: string = BASE62_CHARS
): number {
  return Math.pow(charset.length, length);
}

/**
 * 估算短码冲突概率
 * @param existingCount - 已存在的短码数量
 * @param length - 短码长度
 * @param charset - 字符集
 * @returns 冲突概率（0-1）
 */
export function estimateCollisionProbability(
  existingCount: number,
  length: number,
  charset: string = BASE62_CHARS
): number {
  const totalCombinations = calculatePossibleCombinations(length, charset);

  // 使用生日悖论公式估算冲突概率
  if (existingCount === 0) return 0;
  if (existingCount >= totalCombinations) return 1;

  // 近似公式：1 - e^(-k(k-1)/(2n))
  // 其中 k = existingCount, n = totalCombinations
  const exponent =
    -(existingCount * (existingCount - 1)) / (2 * totalCombinations);
  return 1 - Math.exp(exponent);
}
