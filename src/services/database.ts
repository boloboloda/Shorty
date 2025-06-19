/**
 * 数据库服务 - 处理所有数据库操作
 */

import {
  Link,
  AccessLog,
  CreateAccessLogData,
  DailyStats,
  UpdateDailyStatsData,
  LinkSettings,
  UpdateLinkSettingsData,
  SystemConfig,
} from "../types/index.js";

export interface CreateLinkData {
  original_url: string;
  short_code: string;
  created_at: string;
  access_count: number;
  expires_at?: string | null;
}

export interface UpdateLinkData {
  original_url?: string;
  access_count?: number;
  expires_at?: string | null;
}

export class DatabaseService {
  constructor(private db: D1Database) {}

  /**
   * 创建新的短链接
   */
  async createLink(data: CreateLinkData): Promise<Link> {
    const query = `
      INSERT INTO links (original_url, short_code, created_at, access_count, expires_at)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `;

    const result = await this.db
      .prepare(query)
      .bind(
        data.original_url,
        data.short_code,
        data.created_at,
        data.access_count,
        data.expires_at
      )
      .first<Link>();

    if (!result) {
      throw new Error("Failed to create link");
    }

    return result;
  }

  /**
   * 根据短代码获取链接
   */
  async getLinkByShortCode(shortCode: string): Promise<Link | null> {
    const query = `SELECT * FROM links WHERE short_code = ?`;
    const result = await this.db.prepare(query).bind(shortCode).first<Link>();
    return result || null;
  }

  /**
   * 根据 ID 获取链接
   */
  async getLinkById(id: number): Promise<Link | null> {
    const query = `SELECT * FROM links WHERE id = ?`;
    const result = await this.db.prepare(query).bind(id).first<Link>();
    return result || null;
  }

  /**
   * 根据 URL 获取链接
   */
  async getLinkByUrl(url: string): Promise<Link | null> {
    const query = `SELECT * FROM links WHERE original_url = ? ORDER BY created_at DESC LIMIT 1`;
    const result = await this.db.prepare(query).bind(url).first<Link>();
    return result || null;
  }

  /**
   * 更新链接访问次数
   */
  async incrementAccessCount(id: number): Promise<void> {
    const query = `UPDATE links SET access_count = access_count + 1 WHERE id = ?`;
    await this.db.prepare(query).bind(id).run();
  }

  /**
   * 更新链接信息
   */
  async updateLink(id: number, data: Partial<Link>): Promise<Link> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (data.original_url !== undefined) {
      setClauses.push("original_url = ?");
      values.push(data.original_url);
    }

    if (data.access_count !== undefined) {
      setClauses.push("access_count = ?");
      values.push(data.access_count);
    }

    if (data.expires_at !== undefined) {
      setClauses.push("expires_at = ?");
      values.push(data.expires_at);
    }

    if (setClauses.length === 0) {
      const existing = await this.getLinkById(id);
      if (!existing) throw new Error("Link not found");
      return existing;
    }

    const query = `
      UPDATE links 
      SET ${setClauses.join(", ")}
      WHERE id = ?
      RETURNING *
    `;

    values.push(id);

    const result = await this.db
      .prepare(query)
      .bind(...values)
      .first<Link>();

    if (!result) {
      throw new Error("Failed to update link");
    }

    return result;
  }

  /**
   * 删除链接
   */
  async deleteLink(id: number): Promise<boolean> {
    const query = `DELETE FROM links WHERE id = ?`;
    const result = await this.db.prepare(query).bind(id).run();
    return result.meta.changes > 0;
  }

  /**
   * 获取所有链接（分页）
   */
  async getAllLinks(
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    links: Link[];
    total: number;
  }> {
    const linksQuery = `
      SELECT * FROM links 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    const countQuery = `SELECT COUNT(*) as count FROM links`;

    const [linksResult, countResult] = await Promise.all([
      this.db.prepare(linksQuery).bind(limit, offset).all<Link>(),
      this.db.prepare(countQuery).first<{ count: number }>(),
    ]);

    return {
      links: linksResult.results || [],
      total: countResult?.count || 0,
    };
  }

  /**
   * 检查短代码是否已存在
   */
  async shortCodeExists(shortCode: string): Promise<boolean> {
    const query = `SELECT 1 FROM links WHERE short_code = ? LIMIT 1`;
    const result = await this.db.prepare(query).bind(shortCode).first();
    return !!result;
  }

  /**
   * 清理过期链接
   */
  async deleteExpiredLinks(): Promise<number> {
    const query = `
      DELETE FROM links 
      WHERE expires_at IS NOT NULL 
      AND expires_at <= datetime('now')
    `;
    const result = await this.db.prepare(query).run();
    return result.meta.changes;
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    const totalLinksQuery = `SELECT COUNT(*) as total FROM links`;
    const totalAccessesQuery = `SELECT SUM(access_count) as total_accesses FROM links`;
    const recentLinksQuery = `
      SELECT COUNT(*) as recent 
      FROM links 
      WHERE created_at >= datetime('now', '-7 days')
    `;

    const [totalLinks, totalAccesses, recentLinks] = await Promise.all([
      this.db.prepare(totalLinksQuery).first<{ total: number }>(),
      this.db.prepare(totalAccessesQuery).first<{ total_accesses: number }>(),
      this.db.prepare(recentLinksQuery).first<{ recent: number }>(),
    ]);

    return {
      totalLinks: totalLinks?.total || 0,
      totalAccesses: totalAccesses?.total_accesses || 0,
      recentLinks: recentLinks?.recent || 0,
    };
  }

  // ===================
  // 访问日志相关操作
  // ===================

  /**
   * 记录访问日志
   */
  async createAccessLog(data: CreateAccessLogData): Promise<AccessLog> {
    const query = `
      INSERT INTO access_logs (
        link_id, short_code, ip_address, user_agent, referer,
        country, city, device_type, browser, os, response_time_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;

    const result = await this.db
      .prepare(query)
      .bind(
        data.link_id,
        data.short_code,
        data.ip_address,
        data.user_agent || null,
        data.referer || null,
        data.country || null,
        data.city || null,
        data.device_type || null,
        data.browser || null,
        data.os || null,
        data.response_time_ms || null
      )
      .first<AccessLog>();

    if (!result) {
      throw new Error("Failed to create access log");
    }

    return result;
  }

  /**
   * 获取访问日志（分页）
   */
  async getAccessLogs(
    linkId?: number,
    shortCode?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    logs: AccessLog[];
    total: number;
  }> {
    let whereClause = "";
    const bindings: any[] = [];

    if (linkId) {
      whereClause += " WHERE link_id = ?";
      bindings.push(linkId);
    } else if (shortCode) {
      whereClause += " WHERE short_code = ?";
      bindings.push(shortCode);
    }

    const logsQuery = `
      SELECT * FROM access_logs 
      ${whereClause}
      ORDER BY accessed_at DESC 
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM access_logs
      ${whereClause}
    `;

    bindings.push(limit, offset);

    const [logsResult, countResult] = await Promise.all([
      this.db
        .prepare(logsQuery)
        .bind(...bindings)
        .all<AccessLog>(),
      this.db
        .prepare(countQuery)
        .bind(...bindings.slice(0, -2))
        .first<{ count: number }>(),
    ]);

    return {
      logs: logsResult.results || [],
      total: countResult?.count || 0,
    };
  }

  /**
   * 获取访问日志统计（按日期范围）
   */
  async getAccessLogStats(
    linkId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalVisits: number;
    uniqueVisitors: number;
    deviceStats: Record<string, number>;
    countryStats: Array<{ country: string; count: number }>;
  }> {
    let whereClause = "";
    const bindings: any[] = [];

    if (linkId) {
      whereClause += " WHERE link_id = ?";
      bindings.push(linkId);
    }

    if (startDate) {
      whereClause += (whereClause ? " AND" : " WHERE") + " accessed_at >= ?";
      bindings.push(startDate);
    }

    if (endDate) {
      whereClause += (whereClause ? " AND" : " WHERE") + " accessed_at <= ?";
      bindings.push(endDate);
    }

    const totalVisitsQuery = `
      SELECT COUNT(*) as total FROM access_logs ${whereClause}
    `;

    const uniqueVisitorsQuery = `
      SELECT COUNT(DISTINCT ip_address) as unique_visitors FROM access_logs ${whereClause}
    `;

    const deviceStatsQuery = `
      SELECT device_type, COUNT(*) as count 
      FROM access_logs 
      ${whereClause}
      GROUP BY device_type
    `;

    const countryStatsQuery = `
      SELECT country, COUNT(*) as count 
      FROM access_logs 
      ${whereClause}${whereClause ? " AND" : " WHERE"} country IS NOT NULL
      GROUP BY country 
      ORDER BY count DESC
      LIMIT 10
    `;

    const [totalVisits, uniqueVisitors, deviceStats, countryStats] =
      await Promise.all([
        this.db
          .prepare(totalVisitsQuery)
          .bind(...bindings)
          .first<{ total: number }>(),
        this.db
          .prepare(uniqueVisitorsQuery)
          .bind(...bindings)
          .first<{ unique_visitors: number }>(),
        this.db
          .prepare(deviceStatsQuery)
          .bind(...bindings)
          .all<{ device_type: string; count: number }>(),
        this.db
          .prepare(countryStatsQuery)
          .bind(...bindings)
          .all<{ country: string; count: number }>(),
      ]);

    // 处理设备统计
    const deviceStatsMap: Record<string, number> = {};
    deviceStats.results?.forEach((stat) => {
      deviceStatsMap[stat.device_type || "unknown"] = stat.count;
    });

    return {
      totalVisits: totalVisits?.total || 0,
      uniqueVisitors: uniqueVisitors?.unique_visitors || 0,
      deviceStats: deviceStatsMap,
      countryStats: countryStats.results || [],
    };
  }

  // ===================
  // 每日统计相关操作
  // ===================

  /**
   * 获取或创建每日统计记录
   */
  async getOrCreateDailyStats(
    linkId: number,
    shortCode: string,
    date: string
  ): Promise<DailyStats> {
    // 尝试获取现有记录
    const existing = await this.db
      .prepare(`SELECT * FROM daily_stats WHERE link_id = ? AND date = ?`)
      .bind(linkId, date)
      .first<DailyStats>();

    if (existing) {
      return existing;
    }

    // 创建新记录
    const query = `
      INSERT INTO daily_stats (link_id, short_code, date, total_visits, unique_visitors)
      VALUES (?, ?, ?, 0, 0)
      RETURNING *
    `;

    const result = await this.db
      .prepare(query)
      .bind(linkId, shortCode, date)
      .first<DailyStats>();

    if (!result) {
      throw new Error("Failed to create daily stats");
    }

    return result;
  }

  /**
   * 更新每日统计
   */
  async updateDailyStats(
    linkId: number,
    date: string,
    data: UpdateDailyStatsData
  ): Promise<DailyStats> {
    const setClauses: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (setClauses.length === 0) {
      const existing = await this.db
        .prepare(`SELECT * FROM daily_stats WHERE link_id = ? AND date = ?`)
        .bind(linkId, date)
        .first<DailyStats>();

      if (!existing) throw new Error("Daily stats not found");
      return existing;
    }

    const query = `
      UPDATE daily_stats 
      SET ${setClauses.join(", ")}
      WHERE link_id = ? AND date = ?
      RETURNING *
    `;

    values.push(linkId, date);

    const result = await this.db
      .prepare(query)
      .bind(...values)
      .first<DailyStats>();

    if (!result) {
      throw new Error("Failed to update daily stats");
    }

    return result;
  }

  /**
   * 获取每日统计（日期范围）
   */
  async getDailyStats(
    linkId?: number,
    startDate?: string,
    endDate?: string,
    limit: number = 30
  ): Promise<DailyStats[]> {
    let whereClause = "";
    const bindings: any[] = [];

    if (linkId) {
      whereClause += " WHERE link_id = ?";
      bindings.push(linkId);
    }

    if (startDate) {
      whereClause += (whereClause ? " AND" : " WHERE") + " date >= ?";
      bindings.push(startDate);
    }

    if (endDate) {
      whereClause += (whereClause ? " AND" : " WHERE") + " date <= ?";
      bindings.push(endDate);
    }

    const query = `
      SELECT * FROM daily_stats 
      ${whereClause}
      ORDER BY date DESC 
      LIMIT ?
    `;

    bindings.push(limit);

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all<DailyStats>();
    return result.results || [];
  }

  // ===================
  // 链接设置相关操作
  // ===================

  /**
   * 获取链接设置
   */
  async getLinkSettings(linkId: number): Promise<LinkSettings | null> {
    const query = `SELECT * FROM link_settings WHERE link_id = ?`;
    const result = await this.db
      .prepare(query)
      .bind(linkId)
      .first<LinkSettings>();
    return result || null;
  }

  /**
   * 创建链接设置
   */
  async createLinkSettings(linkId: number): Promise<LinkSettings> {
    const query = `
      INSERT INTO link_settings (link_id)
      VALUES (?)
      RETURNING *
    `;

    const result = await this.db
      .prepare(query)
      .bind(linkId)
      .first<LinkSettings>();

    if (!result) {
      throw new Error("Failed to create link settings");
    }

    return result;
  }

  /**
   * 更新链接设置
   */
  async updateLinkSettings(
    linkId: number,
    data: UpdateLinkSettingsData
  ): Promise<LinkSettings> {
    const setClauses: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (setClauses.length === 0) {
      const existing = await this.getLinkSettings(linkId);
      if (!existing) throw new Error("Link settings not found");
      return existing;
    }

    const query = `
      UPDATE link_settings 
      SET ${setClauses.join(", ")}
      WHERE link_id = ?
      RETURNING *
    `;

    values.push(linkId);

    const result = await this.db
      .prepare(query)
      .bind(...values)
      .first<LinkSettings>();

    if (!result) {
      throw new Error("Failed to update link settings");
    }

    return result;
  }

  // ===================
  // 系统配置相关操作
  // ===================

  /**
   * 获取系统配置
   */
  async getSystemConfig(key: string): Promise<SystemConfig | null> {
    const query = `SELECT * FROM system_config WHERE key = ?`;
    const result = await this.db.prepare(query).bind(key).first<SystemConfig>();
    return result || null;
  }

  /**
   * 获取所有系统配置
   */
  async getAllSystemConfig(): Promise<SystemConfig[]> {
    const query = `SELECT * FROM system_config ORDER BY key`;
    const result = await this.db.prepare(query).all<SystemConfig>();
    return result.results || [];
  }

  /**
   * 设置系统配置
   */
  async setSystemConfig(
    key: string,
    value: string,
    description?: string
  ): Promise<SystemConfig> {
    const query = `
      INSERT INTO system_config (key, value, description)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        description = COALESCE(excluded.description, description),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.db
      .prepare(query)
      .bind(key, value, description || null)
      .first<SystemConfig>();

    if (!result) {
      throw new Error("Failed to set system config");
    }

    return result;
  }

  // ===================
  // 清理和维护操作
  // ===================

  /**
   * 清理过期的访问日志
   */
  async cleanupAccessLogs(retentionDays: number = 365): Promise<number> {
    const query = `
      DELETE FROM access_logs 
      WHERE accessed_at < datetime('now', '-${retentionDays} days')
    `;
    const result = await this.db.prepare(query).run();
    return result.meta.changes;
  }

  /**
   * 清理过期的每日统计
   */
  async cleanupDailyStats(retentionDays: number = 1095): Promise<number> {
    const query = `
      DELETE FROM daily_stats 
      WHERE created_at < datetime('now', '-${retentionDays} days')
    `;
    const result = await this.db.prepare(query).run();
    return result.meta.changes;
  }

  /**
   * 聚合访问日志到每日统计
   */
  async aggregateAccessLogs(date: string): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO daily_stats (
        link_id, short_code, date, total_visits, unique_visitors,
        mobile_visits, desktop_visits, tablet_visits, bot_visits
      )
      SELECT 
        al.link_id,
        al.short_code,
        ? as date,
        COUNT(*) as total_visits,
        COUNT(DISTINCT al.ip_address) as unique_visitors,
        SUM(CASE WHEN al.device_type = 'mobile' THEN 1 ELSE 0 END) as mobile_visits,
        SUM(CASE WHEN al.device_type = 'desktop' THEN 1 ELSE 0 END) as desktop_visits,
        SUM(CASE WHEN al.device_type = 'tablet' THEN 1 ELSE 0 END) as tablet_visits,
        SUM(CASE WHEN al.device_type = 'bot' THEN 1 ELSE 0 END) as bot_visits
      FROM access_logs al
      WHERE DATE(al.accessed_at) = ?
      GROUP BY al.link_id, al.short_code
    `;

    await this.db.prepare(query).bind(date, date).run();
  }
}

// 向后兼容性别名
export { DatabaseService as Database };

// 默认导出
export default DatabaseService;
