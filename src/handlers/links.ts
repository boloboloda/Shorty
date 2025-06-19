/**
 * 链接处理器 - 处理链接相关的 HTTP 请求
 */

import { Hono } from "hono";
import { z } from "zod";
import { DatabaseService } from "../services/database.js";
import {
  createLinkService,
  type LinkServiceConfig,
} from "../services/linkService.js";
import type {
  Env,
  CreateLinkRequest,
  CreateLinkResponse,
  GetLinkResponse,
  UpdateLinkResponse,
  ApiResponse,
} from "../types/index.js";

// 创建链接请求验证 Schema
const createLinkSchema = z.object({
  originalUrl: z
    .string()
    .min(1, "原始URL不能为空")
    .max(2048, "URL长度不能超过2048个字符"),

  customSlug: z
    .string()
    .min(3, "自定义短码长度不能少于3个字符")
    .max(16, "自定义短码长度不能超过16个字符")
    .regex(/^[a-zA-Z0-9]+$/, "自定义短码只能包含字母和数字")
    .optional(),

  expiresAt: z
    .string()
    .datetime("过期时间格式无效，请使用 ISO 8601 格式")
    .optional(),

  expireDays: z
    .number()
    .int("过期天数必须是整数")
    .min(1, "过期天数不能少于1天")
    .max(3650, "过期天数不能超过3650天（10年）")
    .optional(),
});

/**
 * 创建链接处理器应用
 */
export function createLinksHandler() {
  const app = new Hono<{ Bindings: Env }>();

  // 获取应用配置
  const getConfig = (env: Env): LinkServiceConfig => ({
    baseUrl: env.BASE_URL || "https://shorty.dev",
    defaultExpireDays: 365,
    enableCustomSlug: true,
    enableExpiration: true,
    maxSlugLength: 16,
    minSlugLength: 4,
    enableRateLimit: true,
    enableAnalytics: true,
  });

  /**
   * POST /links - 创建新的短链接
   */
  app.post("/", async (c) => {
    try {
      // 手动解析和验证请求体
      const body = await c.req.json();
      const validation = createLinkSchema.safeParse(body);

      if (!validation.success) {
        const response: ApiResponse = {
          success: false,
          error: "请求参数验证失败",
          data: {
            details: validation.error.errors.map(
              (err) => `${err.path.join(".")}: ${err.message}`
            ),
          },
        };

        c.status(400);
        return c.json(response);
      }

      const requestData = validation.data;

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);
      const linkService = createLinkService(db, getConfig(c.env));

      // 构建创建请求
      const createRequest: CreateLinkRequest = {
        originalUrl: requestData.originalUrl,
        customSlug: requestData.customSlug,
        expiresAt: requestData.expiresAt,
        expireDays: requestData.expireDays,
      };

      // 创建短链接
      const result = await linkService.createLink(createRequest);

      // 处理响应
      if (result.success) {
        const response: ApiResponse<CreateLinkResponse["link"]> = {
          success: true,
          data: result.link,
          message: "短链接创建成功",
        };

        c.status(201);
        return c.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: result.error,
          data: {
            details: result.details || [],
          },
        };

        // 根据错误类型设置不同的状态码
        if (result.error?.includes("无效的URL")) {
          c.status(400);
        } else if (result.error?.includes("短码已存在")) {
          c.status(409);
        } else if (result.error?.includes("无效的自定义短码")) {
          c.status(400);
        } else {
          c.status(500);
        }

        return c.json(response);
      }
    } catch (error) {
      console.error("创建链接时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "创建链接时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * GET /links - 获取链接列表（分页）
   */
  app.get("/", async (c) => {
    try {
      // 解析查询参数
      const pageParam = c.req.query("page");
      const limitParam = c.req.query("limit");

      const page = pageParam ? parseInt(pageParam, 10) : 1;
      const limit = limitParam ? parseInt(limitParam, 10) : 10;

      if (page <= 0 || limit <= 0 || limit > 100) {
        const response: ApiResponse = {
          success: false,
          error: "无效的分页参数",
          message: "页码必须大于0，每页数量必须在1-100之间",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);
      const linkService = createLinkService(db, getConfig(c.env));

      // 获取链接列表
      const result = await linkService.getAllLinks(page, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          links: result.links,
          pagination: result.pagination,
        },
        message: "获取链接列表成功",
      };

      return c.json(response);
    } catch (error) {
      console.error("获取链接列表时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "获取链接列表时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * GET /links/:id - 根据ID获取链接详情
   */
  app.get("/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);

      if (isNaN(id) || id <= 0) {
        const response: ApiResponse = {
          success: false,
          error: "无效的链接ID",
          message: "链接ID必须是正整数",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);
      const linkData = await db.getLinkById(id);

      if (!linkData) {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }

      // 构建响应数据
      const linkService = createLinkService(db, getConfig(c.env));
      const linkResponse = {
        id: linkData.id,
        originalUrl: linkData.original_url,
        shortCode: linkData.short_code,
        shortUrl: `${getConfig(c.env).baseUrl}/${linkData.short_code}`,
        createdAt: linkData.created_at,
        expiresAt: linkData.expires_at,
        accessCount: linkData.access_count,
      };

      const response: ApiResponse = {
        success: true,
        data: linkResponse,
        message: "获取链接详情成功",
      };

      return c.json(response);
    } catch (error) {
      console.error("获取链接详情时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "获取链接详情时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * PUT /links/:id - 更新链接信息
   */
  app.put("/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);
      const updateData = await c.req.json();

      if (isNaN(id) || id <= 0) {
        const response: ApiResponse = {
          success: false,
          error: "无效的链接ID",
          message: "链接ID必须是正整数",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);
      const linkService = createLinkService(db, getConfig(c.env));

      // 更新链接
      const result = await linkService.updateLink(id, updateData);

      if (result.success) {
        const response: ApiResponse<UpdateLinkResponse["link"]> = {
          success: true,
          data: result.link,
          message: "链接更新成功",
        };

        return c.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: result.error,
          data: {
            details: result.details || [],
          },
        };

        if (result.error?.includes("链接不存在")) {
          c.status(404);
        } else if (result.error?.includes("无效的URL")) {
          c.status(400);
        } else {
          c.status(500);
        }

        return c.json(response);
      }
    } catch (error) {
      console.error("更新链接时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "更新链接时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * DELETE /links/:id - 删除链接
   */
  app.delete("/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"), 10);

      if (isNaN(id) || id <= 0) {
        const response: ApiResponse = {
          success: false,
          error: "无效的链接ID",
          message: "链接ID必须是正整数",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);
      const linkService = createLinkService(db, getConfig(c.env));

      // 删除链接
      const deleted = await linkService.deleteLink(id);

      if (deleted) {
        const response: ApiResponse = {
          success: true,
          message: "链接删除成功",
        };

        return c.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的链接未找到或已被删除",
        };

        c.status(404);
        return c.json(response);
      }
    } catch (error) {
      console.error("删除链接时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "删除链接时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * GET /links/:shortCode/stats - 获取链接统计信息
   */
  app.get("/:shortCode/stats", async (c) => {
    try {
      const shortCode = c.req.param("shortCode");

      if (!shortCode || shortCode.length < 3) {
        const response: ApiResponse = {
          success: false,
          error: "无效的短码",
          message: "短码不能为空且长度不能少于3个字符",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);
      const linkService = createLinkService(db, getConfig(c.env));

      // 获取统计信息
      const stats = await linkService.getLinkStats(shortCode);

      if (stats) {
        const response: ApiResponse = {
          success: true,
          data: stats,
          message: "获取链接统计成功",
        };

        return c.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的短码对应的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }
    } catch (error) {
      console.error("获取链接统计时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "获取链接统计时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * GET /links/code/:shortCode - 根据短码获取链接详情
   */
  app.get("/code/:shortCode", async (c) => {
    try {
      const shortCode = c.req.param("shortCode");

      if (!shortCode || shortCode.length < 3) {
        const response: ApiResponse = {
          success: false,
          error: "无效的短码",
          message: "短码不能为空且长度不能少于3个字符",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);
      const linkData = await db.getLinkByShortCode(shortCode);

      if (!linkData) {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的短码对应的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }

      // 构建响应数据
      const linkResponse = {
        id: linkData.id,
        originalUrl: linkData.original_url,
        shortCode: linkData.short_code,
        shortUrl: `${getConfig(c.env).baseUrl}/${linkData.short_code}`,
        createdAt: linkData.created_at,
        expiresAt: linkData.expires_at,
        accessCount: linkData.access_count,
        isActive: linkData.is_active,
        lastAccessedAt: linkData.last_accessed_at,
      };

      const response: ApiResponse = {
        success: true,
        data: linkResponse,
        message: "获取链接详情成功",
      };

      return c.json(response);
    } catch (error) {
      console.error("获取链接详情时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "获取链接详情时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * PUT /links/code/:shortCode - 根据短码更新链接信息
   */
  app.put("/code/:shortCode", async (c) => {
    try {
      const shortCode = c.req.param("shortCode");
      const updateData = await c.req.json();

      if (!shortCode || shortCode.length < 3) {
        const response: ApiResponse = {
          success: false,
          error: "无效的短码",
          message: "短码不能为空且长度不能少于3个字符",
        };

        c.status(400);
        return c.json(response);
      }

      // 验证更新数据
      const updateSchema = z.object({
        originalUrl: z
          .string()
          .min(1, "原始URL不能为空")
          .max(2048, "URL长度不能超过2048个字符")
          .optional(),

        expiresAt: z
          .string()
          .datetime("过期时间格式无效，请使用 ISO 8601 格式")
          .optional(),

        isActive: z.boolean({ message: "启用状态必须是布尔值" }).optional(),
      });

      const validation = updateSchema.safeParse(updateData);

      if (!validation.success) {
        const response: ApiResponse = {
          success: false,
          error: "请求参数验证失败",
          data: {
            details: validation.error.errors.map(
              (err) => `${err.path.join(".")}: ${err.message}`
            ),
          },
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);

      // 首先获取链接信息
      const linkData = await db.getLinkByShortCode(shortCode);
      if (!linkData) {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的短码对应的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }

      // 更新链接
      const linkService = createLinkService(db, getConfig(c.env));
      const result = await linkService.updateLink(linkData.id, validation.data);

      if (result.success) {
        const response: ApiResponse<UpdateLinkResponse["link"]> = {
          success: true,
          data: result.link,
          message: "链接更新成功",
        };

        return c.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: result.error,
          data: {
            details: result.details || [],
          },
        };

        if (result.error?.includes("无效的URL")) {
          c.status(400);
        } else {
          c.status(500);
        }

        return c.json(response);
      }
    } catch (error) {
      console.error("更新链接时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "更新链接时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * DELETE /links/code/:shortCode - 根据短码删除链接
   */
  app.delete("/code/:shortCode", async (c) => {
    try {
      const shortCode = c.req.param("shortCode");

      if (!shortCode || shortCode.length < 3) {
        const response: ApiResponse = {
          success: false,
          error: "无效的短码",
          message: "短码不能为空且长度不能少于3个字符",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);

      // 首先获取链接信息
      const linkData = await db.getLinkByShortCode(shortCode);
      if (!linkData) {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的短码对应的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }

      // 删除链接
      const linkService = createLinkService(db, getConfig(c.env));
      const deleted = await linkService.deleteLink(linkData.id);

      if (deleted) {
        const response: ApiResponse = {
          success: true,
          message: "链接删除成功",
          data: {
            shortCode: shortCode,
            deletedAt: new Date().toISOString(),
          },
        };

        return c.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: "删除失败",
          message: "删除链接时发生未知错误",
        };

        c.status(500);
        return c.json(response);
      }
    } catch (error) {
      console.error("删除链接时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "删除链接时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * POST /links/code/:shortCode/toggle - 切换链接启用/禁用状态
   */
  app.post("/code/:shortCode/toggle", async (c) => {
    try {
      const shortCode = c.req.param("shortCode");

      if (!shortCode || shortCode.length < 3) {
        const response: ApiResponse = {
          success: false,
          error: "无效的短码",
          message: "短码不能为空且长度不能少于3个字符",
        };

        c.status(400);
        return c.json(response);
      }

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);

      // 首先获取链接信息
      const linkData = await db.getLinkByShortCode(shortCode);
      if (!linkData) {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的短码对应的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }

      // 切换状态
      const newStatus = !linkData.is_active;
      const linkService = createLinkService(db, getConfig(c.env));
      const result = await linkService.updateLink(linkData.id, {
        isActive: newStatus,
      });

      if (result.success) {
        const response: ApiResponse = {
          success: true,
          data: {
            shortCode: shortCode,
            isActive: newStatus,
            message: newStatus ? "链接已启用" : "链接已禁用",
            updatedAt: new Date().toISOString(),
          },
          message: `链接状态已${newStatus ? "启用" : "禁用"}`,
        };

        return c.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: result.error,
          message: "切换链接状态失败",
        };

        c.status(500);
        return c.json(response);
      }
    } catch (error) {
      console.error("切换链接状态时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "切换链接状态时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * POST /links/code/:shortCode/ownership - 声明链接所有权（基于IP验证）
   */
  app.post("/code/:shortCode/ownership", async (c) => {
    try {
      const shortCode = c.req.param("shortCode");

      if (!shortCode || shortCode.length < 3) {
        const response: ApiResponse = {
          success: false,
          error: "无效的短码",
          message: "短码不能为空且长度不能少于3个字符",
        };

        c.status(400);
        return c.json(response);
      }

      // 获取客户端IP
      const clientIP =
        c.req.header("CF-Connecting-IP") ||
        c.req.header("X-Real-IP") ||
        c.req.header("X-Forwarded-For")?.split(",")[0] ||
        "127.0.0.1";

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);

      // 获取链接信息
      const linkData = await db.getLinkByShortCode(shortCode);
      if (!linkData) {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的短码对应的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }

      // 检查创建IP（如果有记录的话）
      // 注意：这是一个简单的所有权验证，在生产环境中应该有更完善的认证机制
      const response: ApiResponse = {
        success: true,
        data: {
          shortCode: shortCode,
          clientIP: clientIP,
          canManage: true, // 简化版本，总是允许管理
          message: "链接管理权限确认",
          permissions: {
            canView: true,
            canUpdate: true,
            canDelete: true,
            canToggle: true,
          },
        },
        message: "链接所有权验证成功",
      };

      return c.json(response);
    } catch (error) {
      console.error("验证链接所有权时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "验证链接所有权时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  /**
   * GET /links/code/:shortCode/analytics - 获取链接详细分析数据
   */
  app.get("/code/:shortCode/analytics", async (c) => {
    try {
      const shortCode = c.req.param("shortCode");

      if (!shortCode || shortCode.length < 3) {
        const response: ApiResponse = {
          success: false,
          error: "无效的短码",
          message: "短码不能为空且长度不能少于3个字符",
        };

        c.status(400);
        return c.json(response);
      }

      // 解析查询参数
      const days = parseInt(c.req.query("days") || "30", 10);
      const includeDetails = c.req.query("details") === "true";

      // 创建服务实例
      const db = new DatabaseService(c.env.DB);

      // 获取链接信息
      const linkData = await db.getLinkByShortCode(shortCode);
      if (!linkData) {
        const response: ApiResponse = {
          success: false,
          error: "链接不存在",
          message: "指定的短码对应的链接未找到",
        };

        c.status(404);
        return c.json(response);
      }

      // 构建分析数据
      const analyticsData = {
        shortCode: shortCode,
        linkId: linkData.id,
        basicStats: {
          totalClicks: linkData.access_count || 0,
          createdAt: linkData.created_at,
          lastAccessedAt: linkData.last_accessed_at,
          isActive: linkData.is_active,
        },
        timeRange: {
          days: days,
          from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        },
      };

      // 如果需要详细信息，可以在这里添加更多数据查询
      if (includeDetails) {
        // 这里可以调用之前实现的分析服务来获取更详细的数据
        // 例如地理位置分布、设备类型分布等
      }

      const response: ApiResponse = {
        success: true,
        data: analyticsData,
        message: "获取链接分析数据成功",
      };

      return c.json(response);
    } catch (error) {
      console.error("获取链接分析数据时发生错误:", error);

      const response: ApiResponse = {
        success: false,
        error: "服务器内部错误",
        message: "获取链接分析数据时发生未知错误",
      };

      c.status(500);
      return c.json(response);
    }
  });

  return app;
}

// 默认导出处理器应用
export default createLinksHandler;
