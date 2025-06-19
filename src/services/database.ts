/**
 * 数据库服务 - 处理所有数据库操作
 */

import { Link } from "../types/index.js";

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
}

// 向后兼容性别名
export { DatabaseService as Database };

// 默认导出
export default DatabaseService;
