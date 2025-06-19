/**
 * 分析服务 - 处理访问统计和分析功能
 */

import { DatabaseService } from "./database.js";
import {
  AccessLog,
  CreateAccessLogData,
  DailyStats,
  LinkDetailedStats,
  OverviewAnalytics,
  AccessLogQuery,
  TopLinksQuery,
  TrafficTrendQuery,
  ExportQuery,
  DeviceType,
  Link,
  LinkSettings,
} from "../types/index.js";
import {
  parseUserAgent,
  getGeoLocation,
  getClientIP,
  extractDomain,
  formatDateToYMD,
  getDateRange,
  aggregateTopItems,
  parseTopItems,
  checkRateLimit,
  generateAnalyticsSummary,
} from "../utils/analytics.js";

export class AnalyticsService {
  constructor(private db: DatabaseService) {}

  // ===================
  // 访问记录和统计
  // ===================

  /**
   * 记录访问并更新统计
   */
  async recordVisit(
    link: Link,
    request: Request,
    responseTimeMs?: number
  ): Promise<AccessLog> {
    const startTime = Date.now();

    // 获取请求信息
    const ip = getClientIP(request);
    const userAgent = request.headers.get("User-Agent") || "";
    const referer = request.headers.get("Referer");

    // 解析 User-Agent
    const parsedUA = parseUserAgent(userAgent);

    // 获取地理位置（异步，但不阻塞）
    let geoData = null;
    try {
      geoData = await getGeoLocation(ip);
    } catch (error) {
      console.warn("Failed to get geo location:", error);
    }

    // 创建访问日志数据
    const logData: CreateAccessLogData = {
      link_id: link.id,
      short_code: link.short_code,
      ip_address: ip,
      user_agent: userAgent,
      referer: referer || undefined,
      country: geoData?.country,
      city: geoData?.city,
      device_type: parsedUA.device_type,
      browser: parsedUA.browser,
      os: parsedUA.os,
      response_time_ms: responseTimeMs || Date.now() - startTime,
    };

    // 记录访问日志
    const accessLog = await this.db.createAccessLog(logData);

    // 异步更新每日统计（不阻塞响应）
    this.updateDailyStatsAsync(link, accessLog).catch((error) => {
      console.error("Failed to update daily stats:", error);
    });

    return accessLog;
  }

  /**
   * 异步更新每日统计
   */
  private async updateDailyStatsAsync(
    link: Link,
    accessLog: AccessLog
  ): Promise<void> {
    const today = formatDateToYMD();

    // 获取或创建今天的统计记录
    const dailyStats = await this.db.getOrCreateDailyStats(
      link.id,
      link.short_code,
      today
    );

    // 获取今天的所有访问记录用于统计
    const todayLogs = await this.db.getAccessLogs(link.id, undefined, 1000, 0);
    const todayVisits = todayLogs.logs.filter((log) =>
      log.accessed_at.startsWith(today)
    );

    // 计算统计数据
    const uniqueIPs = new Set(todayVisits.map((log) => log.ip_address));
    const deviceCounts = this.countByField(todayVisits, "device_type");
    const countryCounts = this.countByField(todayVisits, "country");
    const cityCounts = this.countByField(todayVisits, "city");
    const refererDomains = todayVisits.map((log) =>
      extractDomain(log.referer || "")
    );
    const refererCounts = this.countByField(
      refererDomains.map((domain) => ({ referer: domain })),
      "referer"
    );

    // 更新每日统计
    await this.db.updateDailyStats(link.id, today, {
      total_visits: todayVisits.length,
      unique_visitors: uniqueIPs.size,
      mobile_visits: deviceCounts.mobile || 0,
      desktop_visits: deviceCounts.desktop || 0,
      tablet_visits: deviceCounts.tablet || 0,
      bot_visits: deviceCounts.bot || 0,
      top_countries: aggregateTopItems(
        todayVisits.filter((v) => v.country),
        "country",
        5
      ),
      top_cities: aggregateTopItems(
        todayVisits.filter((v) => v.city),
        "city",
        5
      ),
      top_referers: aggregateTopItems(
        refererDomains
          .filter((d) => d !== "Direct")
          .map((domain) => ({ referer: domain })),
        "referer",
        5
      ),
    });
  }

  /**
   * 辅助函数：按字段计数
   */
  private countByField(items: any[], field: string): Record<string, number> {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const value = item[field] || "unknown";
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  // ===================
  // 链接详细分析
  // ===================

  /**
   * 获取链接详细统计
   */
  async getLinkDetailedStats(linkId: number): Promise<LinkDetailedStats> {
    // 获取链接基本信息
    const link = await this.db.getLinkById(linkId);
    if (!link) {
      throw new Error("Link not found");
    }

    // 获取链接设置
    let settings = await this.db.getLinkSettings(linkId);
    if (!settings) {
      settings = await this.db.createLinkSettings(linkId);
    }

    // 获取时间范围
    const { startDate: weekStart } = getDateRange("week");
    const { startDate: monthStart } = getDateRange("month");
    const today = formatDateToYMD();

    // 并行获取统计数据
    const [todayStats, weekStats, monthStats, totalStats, recentVisits] =
      await Promise.all([
        this.db.getAccessLogStats(linkId, today, today),
        this.db.getAccessLogStats(linkId, weekStart),
        this.db.getAccessLogStats(linkId, monthStart),
        this.db.getAccessLogStats(linkId),
        this.db.getAccessLogs(linkId, undefined, 10, 0),
      ]);

    return {
      link,
      settings,
      todayVisits: todayStats.totalVisits,
      weekVisits: weekStats.totalVisits,
      monthVisits: monthStats.totalVisits,
      totalVisits: totalStats.totalVisits,
      uniqueVisitors: totalStats.uniqueVisitors,
      topCountries: totalStats.countryStats,
      topCities: [], // 可以从 daily_stats 聚合获取
      topReferers: [], // 可以从 daily_stats 聚合获取
      deviceStats: {
        mobile: totalStats.deviceStats.mobile || 0,
        desktop: totalStats.deviceStats.desktop || 0,
        tablet: totalStats.deviceStats.tablet || 0,
        bot: totalStats.deviceStats.bot || 0,
      },
      recentVisits: recentVisits.logs,
    };
  }

  // ===================
  // 总体分析
  // ===================

  /**
   * 获取总体分析数据
   */
  async getOverviewAnalytics(): Promise<OverviewAnalytics> {
    const { startDate: weekStart } = getDateRange("week");
    const { startDate: monthStart } = getDateRange("month");
    const today = formatDateToYMD();

    // 并行获取基础统计
    const [basicStats, todayStats, weekStats, monthStats, totalStats] =
      await Promise.all([
        this.db.getStats(),
        this.db.getAccessLogStats(undefined, today, today),
        this.db.getAccessLogStats(undefined, weekStart),
        this.db.getAccessLogStats(undefined, monthStart),
        this.db.getAccessLogStats(undefined),
      ]);

    // 获取访问趋势（过去30天）
    const visitsTrend = await this.getVisitsTrend(30);

    // 获取热门链接
    const topLinks = await this.getTopLinks({ period: "month", limit: 10 });

    return {
      totalLinks: basicStats.totalLinks,
      totalVisits: totalStats.totalVisits,
      uniqueVisitors: totalStats.uniqueVisitors,
      todayVisits: todayStats.totalVisits,
      weekVisits: weekStats.totalVisits,
      monthVisits: monthStats.totalVisits,
      visitsTrend,
      deviceDistribution: {
        mobile: totalStats.deviceStats.mobile || 0,
        desktop: totalStats.deviceStats.desktop || 0,
        tablet: totalStats.deviceStats.tablet || 0,
        bot: totalStats.deviceStats.bot || 0,
      },
      topCountries: totalStats.countryStats,
      topCities: [], // 从 daily_stats 聚合
      topLinks: topLinks || [],
      topReferers: [], // 从 daily_stats 聚合
    };
  }

  /**
   * 获取访问趋势
   */
  private async getVisitsTrend(
    days: number
  ): Promise<Array<{ date: string; visits: number; unique: number }>> {
    const trends: Array<{ date: string; visits: number; unique: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatDateToYMD(date);

      const stats = await this.db.getAccessLogStats(
        undefined,
        dateStr,
        dateStr
      );
      trends.push({
        date: dateStr,
        visits: stats.totalVisits,
        unique: stats.uniqueVisitors,
      });
    }

    return trends;
  }

  // ===================
  // 热门链接分析
  // ===================

  /**
   * 获取热门链接
   */
  async getTopLinks(query: TopLinksQuery): Promise<
    Array<{
      id: number;
      short_code: string;
      original_url: string;
      visits: number;
      unique_visitors: number;
      created_at: string;
    }>
  > {
    const { period = "all", limit = 10 } = query;
    let dateRange = null;

    if (period !== "all") {
      dateRange = getDateRange(period);
    }

    // 构建查询
    let whereClause = "";
    const bindings: any[] = [];

    if (dateRange) {
      whereClause = " WHERE al.accessed_at >= ? AND al.accessed_at <= ?";
      bindings.push(
        `${dateRange.startDate} 00:00:00`,
        `${dateRange.endDate} 23:59:59`
      );
    }

    const query_sql = `
      SELECT 
        l.id,
        l.short_code,
        l.original_url,
        l.created_at,
        COUNT(al.id) as visits,
        COUNT(DISTINCT al.ip_address) as unique_visitors
      FROM links l
      LEFT JOIN access_logs al ON l.id = al.link_id
      ${whereClause}
      GROUP BY l.id, l.short_code, l.original_url, l.created_at
      ORDER BY visits DESC, unique_visitors DESC
      LIMIT ?
    `;

    bindings.push(limit);

    // 使用原生查询方法（需要在 DatabaseService 中添加）
    const result = await (this.db as any).db
      .prepare(query_sql)
      .bind(...bindings)
      .all();
    return (result.results as any[]) || [];
  }

  // ===================
  // 访问趋势分析
  // ===================

  /**
   * 获取访问趋势数据
   */
  async getTrafficTrend(query: TrafficTrendQuery): Promise<
    Array<{
      date: string;
      visits: number;
      unique_visitors: number;
      devices: {
        mobile: number;
        desktop: number;
        tablet: number;
        bot: number;
      };
    }>
  > {
    const { linkId, period = "month", granularity = "day" } = query;
    const dateRange = getDateRange(period);

    // 根据粒度获取数据
    if (granularity === "day") {
      return this.getDailyTrend(linkId, dateRange.startDate, dateRange.endDate);
    }

    // TODO: 实现其他粒度（hour, week, month）
    return this.getDailyTrend(linkId, dateRange.startDate, dateRange.endDate);
  }

  /**
   * 获取每日趋势
   */
  private async getDailyTrend(
    linkId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<
    Array<{
      date: string;
      visits: number;
      unique_visitors: number;
      devices: { mobile: number; desktop: number; tablet: number; bot: number };
    }>
  > {
    const dailyStats = await this.db.getDailyStats(
      linkId,
      startDate,
      endDate,
      100
    );

    return dailyStats.map((stat) => ({
      date: stat.date,
      visits: stat.total_visits,
      unique_visitors: stat.unique_visitors,
      devices: {
        mobile: stat.mobile_visits,
        desktop: stat.desktop_visits,
        tablet: stat.tablet_visits,
        bot: stat.bot_visits,
      },
    }));
  }

  // ===================
  // 访问日志查询
  // ===================

  /**
   * 查询访问日志
   */
  async queryAccessLogs(query: AccessLogQuery): Promise<{
    logs: AccessLog[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      linkId,
      shortCode,
      deviceType,
      country,
      page = 1,
      limit = 50,
    } = query;

    const offset = (page - 1) * limit;

    // 基础查询
    let logs: AccessLog[] = [];
    let total = 0;

    if (linkId || shortCode) {
      const result = await this.db.getAccessLogs(
        linkId,
        shortCode,
        limit,
        offset
      );
      logs = result.logs;
      total = result.total;
    } else {
      // 全局查询（需要扩展数据库服务）
      const result = await this.db.getAccessLogs(
        undefined,
        undefined,
        limit,
        offset
      );
      logs = result.logs;
      total = result.total;
    }

    // 应用过滤器
    if (deviceType) {
      logs = logs.filter((log) => log.device_type === deviceType);
    }

    if (country) {
      logs = logs.filter((log) => log.country === country);
    }

    return {
      logs,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===================
  // 数据导出
  // ===================

  /**
   * 导出数据
   */
  async exportData(query: ExportQuery): Promise<string> {
    const {
      linkId,
      shortCode,
      startDate,
      endDate,
      format = "json",
      includeHeaders = true,
    } = query;

    // 获取数据
    const logs = await this.getExportLogs(
      linkId,
      shortCode,
      startDate,
      endDate
    );

    if (format === "csv") {
      return this.convertToCSV(logs, includeHeaders);
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * 获取导出用的日志数据
   */
  private async getExportLogs(
    linkId?: number,
    shortCode?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AccessLog[]> {
    // 获取所有匹配的日志（不分页）
    const result = await this.db.getAccessLogs(linkId, shortCode, 10000, 0);
    let logs = result.logs;

    // 应用日期过滤
    if (startDate) {
      logs = logs.filter((log) => log.accessed_at >= startDate);
    }

    if (endDate) {
      logs = logs.filter((log) => log.accessed_at <= endDate);
    }

    return logs;
  }

  /**
   * 转换为 CSV 格式
   */
  private convertToCSV(logs: AccessLog[], includeHeaders: boolean): string {
    const headers = [
      "id",
      "link_id",
      "short_code",
      "accessed_at",
      "ip_address",
      "user_agent",
      "referer",
      "country",
      "city",
      "device_type",
      "browser",
      "os",
      "response_time_ms",
    ];

    const lines: string[] = [];

    if (includeHeaders) {
      lines.push(headers.join(","));
    }

    logs.forEach((log) => {
      const row = headers.map((header) => {
        const value = (log as any)[header];
        // 处理包含逗号的字段
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || "";
      });
      lines.push(row.join(","));
    });

    return lines.join("\n");
  }

  // ===================
  // 频率限制检查
  // ===================

  /**
   * 检查访问频率限制
   */
  async checkVisitRateLimit(
    ip: string,
    linkId?: number,
    limitPerMinute: number = 60
  ): Promise<boolean> {
    // 获取最近一分钟的访问记录
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    let whereClause = "WHERE ip_address = ? AND accessed_at >= ?";
    const bindings = [ip, oneMinuteAgo];

    if (linkId) {
      whereClause += " AND link_id = ?";
      bindings.push(linkId.toString());
    }

    const query = `
      SELECT COUNT(*) as count
      FROM access_logs
      ${whereClause}
    `;

    const result = (await (this.db as any).db
      .prepare(query)
      .bind(...bindings)
      .first()) as { count: number } | null;
    const recentVisits = result?.count || 0;

    return recentVisits < limitPerMinute;
  }

  // ===================
  // 数据清理和维护
  // ===================

  /**
   * 执行数据清理
   */
  async performCleanup(): Promise<{
    deletedAccessLogs: number;
    deletedDailyStats: number;
    aggregatedDates: string[];
  }> {
    // 获取配置
    const retentionConfig = await this.db.getSystemConfig(
      "analytics_retention_days"
    );
    const dailyStatsRetentionConfig = await this.db.getSystemConfig(
      "daily_stats_retention_days"
    );

    const accessLogRetention = parseInt(retentionConfig?.value || "365");
    const dailyStatsRetention = parseInt(
      dailyStatsRetentionConfig?.value || "1095"
    );

    // 清理过期数据
    const [deletedAccessLogs, deletedDailyStats] = await Promise.all([
      this.db.cleanupAccessLogs(accessLogRetention),
      this.db.cleanupDailyStats(dailyStatsRetention),
    ]);

    // 聚合昨天的数据
    const yesterday = formatDateToYMD(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    await this.db.aggregateAccessLogs(yesterday);

    return {
      deletedAccessLogs,
      deletedDailyStats,
      aggregatedDates: [yesterday],
    };
  }

  // ===================
  // 统计摘要
  // ===================

  /**
   * 生成统计摘要
   */
  async generateSummary(linkId?: number): Promise<string> {
    const stats = await this.db.getAccessLogStats(linkId);
    return generateAnalyticsSummary(stats);
  }
}
