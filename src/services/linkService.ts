/**
 * 链接服务层
 * 整合短码生成、URL验证和数据库操作的业务逻辑
 */

import { Database } from "./database.js";
import { validateUrl } from "../utils/urlValidator.js";
import {
  generateSlug,
  validateCustomSlug,
  type SlugConfig,
} from "../utils/slugGenerator.js";
import type {
  Link,
  CreateLinkRequest,
  CreateLinkResponse,
  GetLinkResponse,
  UpdateLinkRequest,
  UpdateLinkResponse,
  LinkStats,
} from "../types/index.js";

// 链接服务配置
export interface LinkServiceConfig {
  baseUrl: string; // 短链接基础URL
  defaultExpireDays?: number; // 默认过期天数
  enableCustomSlug?: boolean; // 是否允许自定义短码
  enableExpiration?: boolean; // 是否启用过期功能
  maxSlugLength?: number; // 最大短码长度
  minSlugLength?: number; // 最小短码长度
  enableRateLimit?: boolean; // 是否启用速率限制
  enableAnalytics?: boolean; // 是否启用访问统计
}

// 默认配置
const DEFAULT_CONFIG: Required<LinkServiceConfig> = {
  baseUrl: "https://shorty.dev",
  defaultExpireDays: 365,
  enableCustomSlug: true,
  enableExpiration: true,
  maxSlugLength: 16,
  minSlugLength: 4,
  enableRateLimit: true,
  enableAnalytics: true,
};

/**
 * 链接服务类
 */
export class LinkService {
  private db: Database;
  private config: Required<LinkServiceConfig>;

  constructor(db: Database, config: Partial<LinkServiceConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 创建短链接
   * @param request - 创建链接请求
   * @returns 创建链接响应
   */
  async createLink(request: CreateLinkRequest): Promise<CreateLinkResponse> {
    try {
      // 1. 验证原始URL
      const urlValidation = await validateUrl(request.originalUrl);
      if (!urlValidation.isValid) {
        return {
          success: false,
          error: "无效的URL",
          details: urlValidation.errors,
        };
      }

      const normalizedUrl = urlValidation.normalizedUrl!;

      // 2. 检查URL是否已存在（可选：避免重复）
      const existingLink = await this.findExistingLink(normalizedUrl);
      if (existingLink && !request.customSlug) {
        // 如果存在且未过期，返回现有链接
        if (!this.isExpired(existingLink)) {
          return {
            success: true,
            link: {
              id: existingLink.id,
              originalUrl: existingLink.original_url,
              shortCode: existingLink.short_code,
              shortUrl: this.buildShortUrl(existingLink.short_code),
              createdAt: existingLink.created_at,
              expiresAt: existingLink.expires_at,
              accessCount: existingLink.access_count,
            },
          };
        }
      }

      // 3. 处理短码生成
      let shortCode: string;

      if (request.customSlug && this.config.enableCustomSlug) {
        // 验证自定义短码
        const slugValidation = validateCustomSlug(request.customSlug, {
          minLength: this.config.minSlugLength,
          maxLength: this.config.maxSlugLength,
        });

        if (!slugValidation.isValid) {
          return {
            success: false,
            error: "无效的自定义短码",
            details: slugValidation.errors,
          };
        }

        shortCode = slugValidation.slug!;

        // 检查自定义短码是否已存在
        if (await this.shortCodeExists(shortCode)) {
          return {
            success: false,
            error: "短码已存在",
            details: ["自定义短码已被使用，请选择其他短码"],
          };
        }
      } else {
        // 生成随机短码
        const slugConfig: SlugConfig = {
          length: 6,
          maxRetries: 10,
          minLength: this.config.minSlugLength,
          maxLength: this.config.maxSlugLength,
        };

        const slugResult = await generateSlug(slugConfig, (slug) =>
          this.shortCodeExists(slug)
        );

        if (!slugResult.success) {
          return {
            success: false,
            error: "短码生成失败",
            details: [slugResult.error || "无法生成唯一短码"],
          };
        }

        shortCode = slugResult.slug!;
      }

      // 4. 计算过期时间
      let expiresAt: string | null = null;
      if (this.config.enableExpiration) {
        if (request.expiresAt) {
          expiresAt = request.expiresAt;
        } else if (request.expireDays) {
          const expireDate = new Date();
          expireDate.setDate(expireDate.getDate() + request.expireDays);
          expiresAt = expireDate.toISOString();
        } else {
          const expireDate = new Date();
          expireDate.setDate(
            expireDate.getDate() + this.config.defaultExpireDays
          );
          expiresAt = expireDate.toISOString();
        }
      }

      // 5. 保存到数据库
      const linkData = await this.db.createLink({
        original_url: normalizedUrl,
        short_code: shortCode,
        created_at: new Date().toISOString(),
        access_count: 0,
        expires_at: expiresAt,
      });

      // 6. 返回响应
      return {
        success: true,
        link: {
          id: linkData.id,
          originalUrl: linkData.original_url,
          shortCode: linkData.short_code,
          shortUrl: this.buildShortUrl(linkData.short_code),
          createdAt: linkData.created_at,
          expiresAt: linkData.expires_at,
          accessCount: linkData.access_count,
        },
      };
    } catch (error) {
      console.error("创建链接时发生错误:", error);
      return {
        success: false,
        error: "服务器内部错误",
        details: ["创建链接时发生未知错误"],
      };
    }
  }

  /**
   * 根据短码获取链接
   * @param shortCode - 短码
   * @param incrementAccess - 是否增加访问计数
   * @returns 获取链接响应
   */
  async getLink(
    shortCode: string,
    incrementAccess: boolean = false
  ): Promise<GetLinkResponse> {
    try {
      const linkData = await this.db.getLinkByShortCode(shortCode);

      if (!linkData) {
        return {
          success: false,
          error: "短链接不存在",
        };
      }

      // 检查是否过期
      if (this.isExpired(linkData)) {
        return {
          success: false,
          error: "短链接已过期",
        };
      }

      // 增加访问计数
      if (incrementAccess && this.config.enableAnalytics) {
        await this.incrementAccessCount(linkData.id);
        linkData.access_count += 1;
      }

      return {
        success: true,
        link: {
          id: linkData.id,
          originalUrl: linkData.original_url,
          shortCode: linkData.short_code,
          shortUrl: this.buildShortUrl(linkData.short_code),
          createdAt: linkData.created_at,
          expiresAt: linkData.expires_at,
          accessCount: linkData.access_count,
        },
      };
    } catch (error) {
      console.error("获取链接时发生错误:", error);
      return {
        success: false,
        error: "服务器内部错误",
      };
    }
  }

  /**
   * 根据短码获取链接（原始数据，不检查过期状态）
   * 用于重定向处理器获取过期链接的信息
   * @param shortCode - 短码
   * @returns 获取链接响应
   */
  async getLinkByShortCodeRaw(shortCode: string): Promise<GetLinkResponse> {
    try {
      const linkData = await this.db.getLinkByShortCode(shortCode);

      if (!linkData) {
        return {
          success: false,
          error: "短链接不存在",
        };
      }

      return {
        success: true,
        link: {
          id: linkData.id,
          originalUrl: linkData.original_url,
          shortCode: linkData.short_code,
          shortUrl: this.buildShortUrl(linkData.short_code),
          createdAt: linkData.created_at,
          expiresAt: linkData.expires_at,
          accessCount: linkData.access_count,
        },
      };
    } catch (error) {
      console.error("获取链接原始数据时发生错误:", error);
      return {
        success: false,
        error: "服务器内部错误",
      };
    }
  }

  /**
   * 更新链接信息
   * @param id - 链接ID
   * @param request - 更新请求
   * @returns 更新响应
   */
  async updateLink(
    id: number,
    request: UpdateLinkRequest
  ): Promise<UpdateLinkResponse> {
    try {
      // 检查链接是否存在
      const existingLink = await this.db.getLinkById(id);
      if (!existingLink) {
        return {
          success: false,
          error: "链接不存在",
        };
      }

      // 准备更新数据
      const updates: Partial<Link> = {};

      // 更新原始URL
      if (request.originalUrl) {
        const urlValidation = await validateUrl(request.originalUrl);
        if (!urlValidation.isValid) {
          return {
            success: false,
            error: "无效的URL",
            details: urlValidation.errors,
          };
        }
        updates.original_url = urlValidation.normalizedUrl!;
      }

      // 更新过期时间
      if (request.expiresAt !== undefined) {
        updates.expires_at = request.expiresAt;
      }

      // 执行更新
      const updatedLink = await this.db.updateLink(id, updates);

      return {
        success: true,
        link: {
          id: updatedLink.id,
          originalUrl: updatedLink.original_url,
          shortCode: updatedLink.short_code,
          shortUrl: this.buildShortUrl(updatedLink.short_code),
          createdAt: updatedLink.created_at,
          expiresAt: updatedLink.expires_at,
          accessCount: updatedLink.access_count,
        },
      };
    } catch (error) {
      console.error("更新链接时发生错误:", error);
      return {
        success: false,
        error: "服务器内部错误",
      };
    }
  }

  /**
   * 删除链接
   * @param id - 链接ID
   * @returns 是否删除成功
   */
  async deleteLink(id: number): Promise<boolean> {
    try {
      return await this.db.deleteLink(id);
    } catch (error) {
      console.error("删除链接时发生错误:", error);
      return false;
    }
  }

  /**
   * 获取链接统计信息
   * @param shortCode - 短码
   * @returns 链接统计
   */
  async getLinkStats(shortCode: string): Promise<LinkStats | null> {
    try {
      const linkData = await this.db.getLinkByShortCode(shortCode);

      if (!linkData) {
        return null;
      }

      return {
        id: linkData.id,
        shortCode: linkData.short_code,
        originalUrl: linkData.original_url,
        accessCount: linkData.access_count,
        createdAt: linkData.created_at,
        expiresAt: linkData.expires_at,
        isExpired: this.isExpired(linkData),
      };
    } catch (error) {
      console.error("获取链接统计时发生错误:", error);
      return null;
    }
  }

  /**
   * 获取所有链接（分页）
   * @param page - 页码（从1开始）
   * @param limit - 每页数量
   * @returns 链接列表
   */
  async getAllLinks(
    page: number = 1,
    limit: number = 10
  ): Promise<{
    links: Array<{
      id: number;
      originalUrl: string;
      shortCode: string;
      shortUrl: string;
      createdAt: string;
      expiresAt: string | null;
      accessCount: number;
      isExpired: boolean;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const offset = (page - 1) * limit;
      const { links, total } = await this.db.getAllLinks(limit, offset);

      const formattedLinks = links.map((link) => ({
        id: link.id,
        originalUrl: link.original_url,
        shortCode: link.short_code,
        shortUrl: this.buildShortUrl(link.short_code),
        createdAt: link.created_at,
        expiresAt: link.expires_at,
        accessCount: link.access_count,
        isExpired: this.isExpired(link),
      }));

      return {
        links: formattedLinks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("获取链接列表时发生错误:", error);
      return {
        links: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }
  }

  /**
   * 清理过期链接
   * @returns 清理的链接数量
   */
  async cleanupExpiredLinks(): Promise<number> {
    try {
      return await this.db.deleteExpiredLinks();
    } catch (error) {
      console.error("清理过期链接时发生错误:", error);
      return 0;
    }
  }

  // 私有辅助方法

  /**
   * 检查短码是否存在
   */
  private async shortCodeExists(shortCode: string): Promise<boolean> {
    try {
      const link = await this.db.getLinkByShortCode(shortCode);
      return link !== null;
    } catch (error) {
      console.error("检查短码存在性时发生错误:", error);
      return true; // 出错时保守返回 true，避免重复
    }
  }

  /**
   * 查找已存在的链接（基于URL）
   */
  private async findExistingLink(url: string): Promise<Link | null> {
    try {
      return await this.db.getLinkByUrl(url);
    } catch (error) {
      console.error("查找已存在链接时发生错误:", error);
      return null;
    }
  }

  /**
   * 检查链接是否过期
   */
  private isExpired(link: Link): boolean {
    if (!link.expires_at) {
      return false;
    }
    return new Date(link.expires_at) < new Date();
  }

  /**
   * 构建完整的短链接URL
   */
  private buildShortUrl(shortCode: string): string {
    return `${this.config.baseUrl}/${shortCode}`;
  }

  /**
   * 增加访问计数
   */
  private async incrementAccessCount(id: number): Promise<void> {
    try {
      await this.db.incrementAccessCount(id);
    } catch (error) {
      console.error("增加访问计数时发生错误:", error);
      // 不抛出错误，访问计数失败不应该影响主要功能
    }
  }
}

/**
 * 创建链接服务实例
 * @param db - 数据库实例
 * @param config - 服务配置
 * @returns 链接服务实例
 */
export function createLinkService(
  db: Database,
  config: Partial<LinkServiceConfig> = {}
): LinkService {
  return new LinkService(db, config);
}
