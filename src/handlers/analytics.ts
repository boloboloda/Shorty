/**
 * 分析API处理器 - 处理分析相关的API请求
 */

import { Context } from "hono";
import { DatabaseService } from "../services/database.js";
import { AnalyticsService } from "../services/analyticsService.js";
import {
  Env,
  LinkDetailedStatsResponse,
  OverviewAnalyticsResponse,
  TopLinksResponse,
  TrafficTrendResponse,
  AccessLogListResponse,
  ApiResponse,
} from "../types/index.js";

/**
 * 获取链接详细统计
 * GET /api/analytics/links/:linkId
 */
export async function getLinkDetailedStats(c: Context<{ Bindings: Env }>) {
  try {
    const linkIdParam = c.req.param("linkId");
    const linkId = parseInt(linkIdParam);

    if (!linkId || isNaN(linkId)) {
      return c.json(
        {
          success: false,
          error: "无效的链接ID",
        } as LinkDetailedStatsResponse,
        400
      );
    }

    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const stats = await analyticsService.getLinkDetailedStats(linkId);

    return c.json({
      success: true,
      data: stats,
    } as LinkDetailedStatsResponse);
  } catch (error) {
    console.error("获取链接统计失败:", error);

    if (error instanceof Error && error.message === "Link not found") {
      return c.json(
        {
          success: false,
          error: "链接不存在",
        } as LinkDetailedStatsResponse,
        404
      );
    }

    return c.json(
      {
        success: false,
        error: "获取链接统计失败",
      } as LinkDetailedStatsResponse,
      500
    );
  }
}

/**
 * 获取链接详细统计（通过短码）
 * GET /api/analytics/links/code/:shortCode
 */
export async function getLinkDetailedStatsByCode(
  c: Context<{ Bindings: Env }>
) {
  try {
    const shortCode = c.req.param("shortCode");

    if (!shortCode) {
      return c.json(
        {
          success: false,
          error: "缺少短码参数",
        } as LinkDetailedStatsResponse,
        400
      );
    }

    const db = new DatabaseService(c.env.DB);

    // 先通过短码获取链接
    const link = await db.getLinkByShortCode(shortCode);
    if (!link) {
      return c.json(
        {
          success: false,
          error: "链接不存在",
        } as LinkDetailedStatsResponse,
        404
      );
    }

    const analyticsService = new AnalyticsService(db);
    const stats = await analyticsService.getLinkDetailedStats(link.id);

    return c.json({
      success: true,
      data: stats,
    } as LinkDetailedStatsResponse);
  } catch (error) {
    console.error("获取链接统计失败:", error);
    return c.json(
      {
        success: false,
        error: "获取链接统计失败",
      } as LinkDetailedStatsResponse,
      500
    );
  }
}

/**
 * 获取总体分析数据
 * GET /api/analytics/overview
 */
export async function getOverviewAnalytics(c: Context<{ Bindings: Env }>) {
  try {
    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const overview = await analyticsService.getOverviewAnalytics();

    return c.json({
      success: true,
      data: overview,
    } as OverviewAnalyticsResponse);
  } catch (error) {
    console.error("获取总体分析失败:", error);
    return c.json(
      {
        success: false,
        error: "获取总体分析失败",
      } as OverviewAnalyticsResponse,
      500
    );
  }
}

/**
 * 获取热门链接
 * GET /api/analytics/top-links?period=week&limit=10
 */
export async function getTopLinks(c: Context<{ Bindings: Env }>) {
  try {
    const period =
      (c.req.query("period") as "today" | "week" | "month" | "all") || "week";
    const limit = parseInt(c.req.query("limit") || "10");

    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const topLinks = await analyticsService.getTopLinks({ period, limit });

    return c.json({
      success: true,
      data: topLinks,
    } as TopLinksResponse);
  } catch (error) {
    console.error("获取热门链接失败:", error);
    return c.json(
      {
        success: false,
        error: "获取热门链接失败",
      } as TopLinksResponse,
      500
    );
  }
}

/**
 * 获取访问趋势
 * GET /api/analytics/traffic-trend?linkId=1&period=month&granularity=day
 */
export async function getTrafficTrend(c: Context<{ Bindings: Env }>) {
  try {
    const linkId = c.req.query("linkId")
      ? parseInt(c.req.query("linkId")!)
      : undefined;
    const shortCode = c.req.query("shortCode");
    const period =
      (c.req.query("period") as "week" | "month" | "quarter" | "year") ||
      "month";
    const granularity =
      (c.req.query("granularity") as "hour" | "day" | "week" | "month") ||
      "day";

    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const trend = await analyticsService.getTrafficTrend({
      linkId,
      shortCode,
      period,
      granularity,
    });

    return c.json({
      success: true,
      data: trend,
    } as TrafficTrendResponse);
  } catch (error) {
    console.error("获取访问趋势失败:", error);
    return c.json(
      {
        success: false,
        error: "获取访问趋势失败",
      } as TrafficTrendResponse,
      500
    );
  }
}

/**
 * 查询访问日志
 * GET /api/analytics/access-logs?linkId=1&page=1&limit=50
 */
export async function queryAccessLogs(c: Context<{ Bindings: Env }>) {
  try {
    const linkId = c.req.query("linkId")
      ? parseInt(c.req.query("linkId")!)
      : undefined;
    const shortCode = c.req.query("shortCode");
    const deviceType = c.req.query("deviceType") as any;
    const country = c.req.query("country");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "50");

    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const result = await analyticsService.queryAccessLogs({
      linkId,
      shortCode,
      deviceType,
      country,
      startDate,
      endDate,
      page,
      limit,
    });

    return c.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.total,
          totalPages: result.pagination.totalPages,
        },
      },
    } as AccessLogListResponse);
  } catch (error) {
    console.error("查询访问日志失败:", error);
    return c.json(
      {
        success: false,
        error: "查询访问日志失败",
      } as AccessLogListResponse,
      500
    );
  }
}

/**
 * 导出分析数据
 * GET /api/analytics/export?format=csv&linkId=1&startDate=2024-01-01
 */
export async function exportData(c: Context<{ Bindings: Env }>) {
  try {
    const linkId = c.req.query("linkId")
      ? parseInt(c.req.query("linkId")!)
      : undefined;
    const shortCode = c.req.query("shortCode");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const format = (c.req.query("format") as "json" | "csv") || "json";
    const includeHeaders = c.req.query("includeHeaders") !== "false";

    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const exportedData = await analyticsService.exportData({
      linkId,
      shortCode,
      startDate,
      endDate,
      format,
      includeHeaders,
    });

    // 设置响应头
    const filename = `analytics_export_${
      new Date().toISOString().split("T")[0]
    }.${format}`;
    const contentType = format === "csv" ? "text/csv" : "application/json";

    c.header("Content-Type", contentType);
    c.header("Content-Disposition", `attachment; filename="${filename}"`);

    return c.body(exportedData);
  } catch (error) {
    console.error("导出数据失败:", error);
    return c.json(
      {
        success: false,
        error: "导出数据失败",
      } as ApiResponse,
      500
    );
  }
}

/**
 * 执行数据清理
 * POST /api/analytics/cleanup
 */
export async function performCleanup(c: Context<{ Bindings: Env }>) {
  try {
    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const result = await analyticsService.performCleanup();

    return c.json({
      success: true,
      data: {
        message: "数据清理完成",
        ...result,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("数据清理失败:", error);
    return c.json(
      {
        success: false,
        error: "数据清理失败",
      } as ApiResponse,
      500
    );
  }
}

/**
 * 生成统计摘要
 * GET /api/analytics/summary?linkId=1
 */
export async function generateSummary(c: Context<{ Bindings: Env }>) {
  try {
    const linkId = c.req.query("linkId")
      ? parseInt(c.req.query("linkId")!)
      : undefined;

    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const summary = await analyticsService.generateSummary(linkId);

    return c.json({
      success: true,
      data: {
        summary,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("生成统计摘要失败:", error);
    return c.json(
      {
        success: false,
        error: "生成统计摘要失败",
      } as ApiResponse,
      500
    );
  }
}

/**
 * 检查访问频率限制
 * GET /api/analytics/rate-limit-check?ip=127.0.0.1&linkId=1
 */
export async function checkRateLimit(c: Context<{ Bindings: Env }>) {
  try {
    const ip =
      c.req.query("ip") || c.req.header("CF-Connecting-IP") || "127.0.0.1";
    const linkId = c.req.query("linkId")
      ? parseInt(c.req.query("linkId")!)
      : undefined;
    const limitPerMinute = parseInt(c.req.query("limitPerMinute") || "60");

    const db = new DatabaseService(c.env.DB);
    const analyticsService = new AnalyticsService(db);

    const allowed = await analyticsService.checkVisitRateLimit(
      ip,
      linkId,
      limitPerMinute
    );

    return c.json({
      success: true,
      data: {
        ip,
        linkId,
        limitPerMinute,
        allowed,
        rateLimited: !allowed,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("检查访问频率限制失败:", error);
    return c.json(
      {
        success: false,
        error: "检查访问频率限制失败",
      } as ApiResponse,
      500
    );
  }
}
