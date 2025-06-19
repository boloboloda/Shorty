/**
 * Shorty - 短链接服务主应用
 * 基于 Cloudflare Workers 和 Hono 框架
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { timing } from "hono/timing";

// 导入类型和配置
import { Env, AppConfig, ApiResponse } from "./types/index.js";

// 导入中间件
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// 导入服务
import { DatabaseService } from "./services/database.js";
import { createLinksHandler } from "./handlers/links.js";
import { handleRedirect } from "./handlers/redirect.js";

// 导入分析处理器
import * as analyticsHandlers from "./handlers/analytics.js";

// 创建应用实例
const app = new Hono<{ Bindings: Env }>();

// 获取应用配置
function getAppConfig(env: Env): AppConfig {
  return {
    environment: env.ENVIRONMENT || "development",
    baseUrl: env.BASE_URL || "http://localhost:8787",
    corsOrigin: env.CORS_ORIGIN || "*",
    defaultShortLength: parseInt(env.DEFAULT_SHORT_LENGTH || "6"),
    maxUrlLength: parseInt(env.MAX_URL_LENGTH || "2048"),
    rateLimitPerMinute: parseInt(env.RATE_LIMIT_PER_MINUTE || "60"),
  };
}

// 全局中间件设置
app.use("*", errorHandler());
app.use("*", logger());
app.use("*", timing());
app.use("*", prettyJSON());

// CORS 中间件（基于环境配置）
app.use("*", async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

// 健康检查端点
app.get("/health", async (c) => {
  const config = getAppConfig(c.env);

  try {
    // 简单的数据库连接测试
    const db = new DatabaseService(c.env.DB);
    await db.getStats();

    const response: ApiResponse = {
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: config.environment,
        version: "1.0.0",
      },
    };

    return c.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: "服务不可用",
      data: {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        environment: config.environment,
      },
    };

    c.status(503);
    return c.json(response);
  }
});

// API 信息端点
app.get("/api/info", async (c) => {
  const config = getAppConfig(c.env);

  const response: ApiResponse = {
    success: true,
    data: {
      name: "Shorty API",
      version: "1.0.0",
      description: "URL 短链接服务",
      environment: config.environment,
      endpoints: {
        health: "/health",
        info: "/api/info",
        stats: "/api/stats",
        create: "POST /api/links",
        redirect: "GET /:shortCode",
        links: "GET /api/links",
        analytics: {
          overview: "GET /api/analytics/overview",
          linkStats: "GET /api/analytics/links/:linkId",
          linkStatsByCode: "GET /api/analytics/links/code/:shortCode",
          topLinks: "GET /api/analytics/top-links",
          trafficTrend: "GET /api/analytics/traffic-trend",
          accessLogs: "GET /api/analytics/access-logs",
          export: "GET /api/analytics/export",
          summary: "GET /api/analytics/summary",
          rateLimitCheck: "GET /api/analytics/rate-limit-check",
          cleanup: "POST /api/analytics/cleanup",
        },
      },
      limits: {
        maxUrlLength: config.maxUrlLength,
        defaultShortLength: config.defaultShortLength,
        rateLimitPerMinute: config.rateLimitPerMinute,
      },
    },
  };

  return c.json(response);
});

// 统计信息端点
app.get("/api/stats", async (c) => {
  try {
    const db = new DatabaseService(c.env.DB);
    const stats = await db.getStats();

    const response: ApiResponse = {
      success: true,
      data: {
        totalLinks: stats.totalLinks,
        totalAccesses: stats.totalAccesses,
        recentLinks: stats.recentLinks,
        timestamp: new Date().toISOString(),
      },
    };

    return c.json(response);
  } catch (error) {
    throw error; // 让错误处理中间件处理
  }
});

// 挂载处理器
app.route("/api/links", createLinksHandler());

// 分析 API 路由
app.get("/api/analytics/overview", analyticsHandlers.getOverviewAnalytics);
app.get("/api/analytics/links/:linkId", analyticsHandlers.getLinkDetailedStats);
app.get(
  "/api/analytics/links/code/:shortCode",
  analyticsHandlers.getLinkDetailedStatsByCode
);
app.get("/api/analytics/top-links", analyticsHandlers.getTopLinks);
app.get("/api/analytics/traffic-trend", analyticsHandlers.getTrafficTrend);
app.get("/api/analytics/access-logs", analyticsHandlers.queryAccessLogs);
app.get("/api/analytics/export", analyticsHandlers.exportData);
app.get("/api/analytics/summary", analyticsHandlers.generateSummary);
app.get("/api/analytics/rate-limit-check", analyticsHandlers.checkRateLimit);
app.post("/api/analytics/cleanup", analyticsHandlers.performCleanup);

// 基础路由组 - API v1
const apiV1 = new Hono<{ Bindings: Env }>();

// API 版本信息
apiV1.get("/", (c) => {
  const response: ApiResponse = {
    success: true,
    data: {
      version: "v1",
      message: "Shorty API v1 - URL 短链接服务",
      documentation: "https://github.com/your-repo/shorty#api-documentation",
    },
  };

  return c.json(response);
});

// 挂载 API 路由
app.route("/api/v1", apiV1);

// 管理仪表板路由
app.get("/dashboard", async (c) => {
  try {
    // 设置 CSP 头部以允许内联样式和脚本
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
    );

    // 读取仪表板 HTML 文件
    const dashboardHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shorty - 管理仪表板</title>
    <!-- Chart.js 移除以避免 CSP 问题 -->
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }

        /* 头部 */
        .header {
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 0;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 1.5rem;
            font-weight: bold;
            color: #0066cc;
            text-decoration: none;
        }

        .header-actions {
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        /* 主要内容区域 */
        .main-content {
            padding: 2rem 0;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
        }

        /* 卡片样式 */
        .card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .card-header {
            padding: 1.5rem;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .card-content {
            padding: 1.5rem;
        }

        /* 统计卡片 */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #0066cc;
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: #64748b;
            font-size: 0.875rem;
        }

        /* 按钮样式 */
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }

        .btn-primary {
            background: #0066cc;
            color: white;
        }

        .btn-primary:hover {
            background: #0052a3;
        }

        .btn-secondary {
            background: #e2e8f0;
            color: #475569;
        }

        .btn-secondary:hover {
            background: #cbd5e1;
        }

        .btn-danger {
            background: #dc2626;
            color: white;
        }

        .btn-danger:hover {
            background: #b91c1c;
        }

        .btn-success {
            background: #16a34a;
            color: white;
        }

        .btn-success:hover {
            background: #15803d;
        }

        /* 表单样式 */
        .form-group {
            margin-bottom: 1rem;
        }

        .form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #374151;
        }

        .form-input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 0.875rem;
            transition: border-color 0.2s;
        }

        .form-input:focus {
            outline: none;
            border-color: #0066cc;
            box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        }

        /* 链接表格 */
        .links-table {
            width: 100%;
            border-collapse: collapse;
        }

        .links-table th,
        .links-table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        .links-table th {
            background: #f8fafc;
            font-weight: 600;
            color: #374151;
        }

        .links-table tbody tr:hover {
            background: #f8fafc;
        }

        /* 状态标签 */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
        }

        .status-active {
            background: #dcfce7;
            color: #16a34a;
        }

        .status-inactive {
            background: #fee2e2;
            color: #dc2626;
        }

        /* 模态框 */
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal.show {
            display: flex;
        }

        .modal-content {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
        }

        .modal-title {
            font-size: 1.25rem;
            font-weight: 600;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #6b7280;
        }

        /* 响应式 */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: 1rem;
            }

            .links-table {
                font-size: 0.875rem;
            }

            .links-table th,
            .links-table td {
                padding: 0.5rem;
            }
        }

        /* 加载状态 */
        .loading {
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border: 2px solid #e2e8f0;
            border-top: 2px solid #0066cc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }



        /* 空状态 */
        .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            color: #6b7280;
        }

        .empty-state-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
        }

        /* 消息提示 */
        .message {
            position: fixed;
            top: 1rem;
            right: 1rem;
            padding: 1rem;
            border-radius: 8px;
            color: white;
            z-index: 2000;
            transform: translateX(100%);
            transition: transform 0.3s;
        }

        .message.show {
            transform: translateX(0);
        }

        .message.success {
            background: #16a34a;
        }

        .message.error {
            background: #dc2626;
        }
    </style>
</head>
<body>
    <!-- 头部 -->
    <header class="header">
        <div class="container">
            <div class="header-content">
                <a href="/" class="logo">
                    🔗 Shorty
                </a>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="openCreateModal()">
                        ➕ 创建链接
                    </button>
                    <button class="btn btn-secondary" onclick="refreshData()">
                        🔄 刷新
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- 主要内容 -->
    <main class="main-content">
        <div class="container">
            <!-- 统计概览 -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="totalLinks">-</div>
                    <div class="stat-label">总链接数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="totalClicks">-</div>
                    <div class="stat-label">总点击数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="todayClicks">-</div>
                    <div class="stat-label">今日点击</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="activeLinks">-</div>
                    <div class="stat-label">活跃链接</div>
                </div>
            </div>

            <!-- 仪表板网格 -->
            <div class="dashboard-grid">
                <!-- 链接管理 -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            📋 链接管理
                        </h2>
                    </div>
                    <div class="card-content">
                        <div id="linksTableContainer">
                            <!-- 链接表格将在这里动态加载 -->
                            <div class="empty-state">
                                <div class="empty-state-icon">📦</div>
                                <p>正在加载链接数据...</p>
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            <!-- 热门链接 -->
            <div class="card" style="margin-top: 2rem;">
                <div class="card-header">
                    <h2 class="card-title">
                        🔥 热门链接
                    </h2>
                </div>
                <div class="card-content">
                    <div id="topLinksContainer">
                        <!-- 热门链接将在这里显示 -->
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- 创建/编辑链接模态框 -->
    <div class="modal" id="linkModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title" id="modalTitle">创建新链接</h3>
                <button class="close-btn" onclick="closeLinkModal()">&times;</button>
            </div>
            <form id="linkForm">
                <div class="form-group">
                    <label class="form-label" for="originalUrl">原始URL *</label>
                    <input type="url" class="form-input" id="originalUrl" required 
                           placeholder="https://example.com">
                </div>
                <div class="form-group">
                    <label class="form-label" for="customSlug">自定义短码（可选）</label>
                    <input type="text" class="form-input" id="customSlug" 
                           placeholder="my-link" pattern="[a-zA-Z0-9]+" minlength="3" maxlength="16">
                    <small style="color: #6b7280;">只能包含字母和数字，3-16个字符</small>
                </div>
                <div class="form-group">
                    <label class="form-label" for="expireDays">过期时间（天）</label>
                    <input type="number" class="form-input" id="expireDays" 
                           placeholder="365" min="1" max="3650">
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="closeLinkModal()">
                        取消
                    </button>
                    <button type="submit" class="btn btn-primary" id="submitBtn">
                        创建链接
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- 消息提示容器 -->
    <div id="messageContainer"></div>

    <!-- JavaScript -->
    <script>
        // 应用状态
        const state = {
            links: [],
            stats: {},
            isLoading: false,
            currentEditingLink: null
        };

        // API 基础配置
        const API_BASE = window.location.origin;

        // 初始化应用
        document.addEventListener('DOMContentLoaded', function() {
            initializeDashboard();
        });

        // 初始化仪表板
        async function initializeDashboard() {
            showLoading(true);
            try {
                await Promise.all([
                    loadStats(),
                    loadLinks(),
                    loadTopLinks()
                ]);
            } catch (error) {
                console.error('初始化失败:', error);
                showMessage('加载数据失败，请刷新页面重试', 'error');
            } finally {
                showLoading(false);
            }
        }

        // 加载统计数据
        async function loadStats() {
            try {
                const response = await fetch(API_BASE + '/api/analytics/overview');
                const data = await response.json();
                
                if (data.success) {
                    state.stats = data.data;
                    updateStatsDisplay();
                }
            } catch (error) {
                console.error('加载统计数据失败:', error);
            }
        }

        // 加载链接列表
        async function loadLinks() {
            try {
                const response = await fetch(API_BASE + '/api/links?limit=50');
                const data = await response.json();
                
                if (data.success) {
                    state.links = data.data.links;
                    renderLinksTable();
                }
            } catch (error) {
                console.error('加载链接列表失败:', error);
            }
        }

        // 加载热门链接
        async function loadTopLinks() {
            try {
                const response = await fetch(API_BASE + '/api/analytics/top-links?limit=10');
                const data = await response.json();
                
                if (data.success) {
                    renderTopLinks(data.data);
                }
            } catch (error) {
                console.error('加载热门链接失败:', error);
            }
        }

        // 更新统计显示
        function updateStatsDisplay() {
            const stats = state.stats;
            document.getElementById('totalLinks').textContent = stats.totalLinks || 0;
            document.getElementById('totalClicks').textContent = stats.totalVisits || 0;
            document.getElementById('todayClicks').textContent = stats.todayVisits || 0;
            
            // 计算活跃链接数
            const activeLinks = state.links.filter(link => link.is_active !== false).length;
            document.getElementById('activeLinks').textContent = activeLinks;
        }

        // 渲染链接表格
        function renderLinksTable() {
            const container = document.getElementById('linksTableContainer');
            
            if (state.links.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔗</div><p>还没有创建任何链接</p><button class="btn btn-primary" onclick="openCreateModal()" style="margin-top: 1rem;">创建第一个链接</button></div>';
                return;
            }

            const tableHTML = '<table class="links-table"><thead><tr><th>短码</th><th>原始URL</th><th>点击数</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>' +
                state.links.map(link => '<tr><td><code style="background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 4px;">' + link.short_code + '</code></td><td><a href="' + link.original_url + '" target="_blank" style="color: #0066cc; text-decoration: none;" title="' + link.original_url + '">' + truncateUrl(link.original_url, 40) + '</a></td><td>' + (link.access_count || 0) + '</td><td><span class="status-badge ' + (link.is_active !== false ? 'status-active' : 'status-inactive') + '">' + (link.is_active !== false ? '✅ 活跃' : '❌ 禁用') + '</span></td><td>' + formatDate(link.created_at) + '</td><td><div style="display: flex; gap: 0.5rem;"><button class="btn btn-secondary" onclick="toggleLinkStatus(\\'' + link.short_code + '\\')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">' + (link.is_active !== false ? '暂停' : '启用') + '</button><button class="btn btn-primary" onclick="editLink(\\'' + link.short_code + '\\')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">编辑</button><button class="btn btn-danger" onclick="deleteLink(\\'' + link.short_code + '\\')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button></div></td></tr>').join('') +
                '</tbody></table>';

            container.innerHTML = tableHTML;
        }

        // 渲染热门链接
        function renderTopLinks(topLinks) {
            const container = document.getElementById('topLinksContainer');
            
            if (!topLinks || topLinks.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><p>暂无访问数据</p></div>';
                return;
            }

            const html = topLinks.map((link, index) => '<div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid #e2e8f0;"><div style="display: flex; align-items: center; gap: 1rem;"><div style="font-weight: bold; color: #0066cc; min-width: 2rem;">#' + (index + 1) + '</div><div><div style="font-weight: 500;">' + (link.shortCode || link.short_code) + '</div><div style="font-size: 0.875rem; color: #6b7280;">' + truncateUrl(link.originalUrl || link.original_url, 50) + '</div></div></div><div style="text-align: right;"><div style="font-weight: bold;">' + link.visits + '</div><div style="font-size: 0.875rem; color: #6b7280;">点击</div></div></div>').join('');

            container.innerHTML = html;
        }



        // 工具函数
        function truncateUrl(url, maxLength) {
            if (url.length <= maxLength) return url;
            return url.substring(0, maxLength - 3) + '...';
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }

        function showLoading(show) {
            state.isLoading = show;
        }

        function showMessage(message, type) {
            const container = document.getElementById('messageContainer');
            const messageEl = document.createElement('div');
            messageEl.className = 'message ' + (type || 'success');
            messageEl.textContent = message;
            
            container.appendChild(messageEl);
            
            setTimeout(() => messageEl.classList.add('show'), 100);
            
            setTimeout(() => {
                messageEl.classList.remove('show');
                setTimeout(() => container.removeChild(messageEl), 300);
            }, 3000);
        }

        // 模态框函数
        function openCreateModal() {
            state.currentEditingLink = null;
            document.getElementById('modalTitle').textContent = '创建新链接';
            document.getElementById('submitBtn').textContent = '创建链接';
            document.getElementById('linkForm').reset();
            document.getElementById('customSlug').disabled = false;
            document.getElementById('linkModal').classList.add('show');
        }

        function closeLinkModal() {
            document.getElementById('linkModal').classList.remove('show');
            state.currentEditingLink = null;
        }

        async function editLink(shortCode) {
            try {
                const response = await fetch(API_BASE + '/api/links/code/' + shortCode);
                const data = await response.json();
                
                if (data.success) {
                    state.currentEditingLink = data.data;
                    document.getElementById('modalTitle').textContent = '编辑链接';
                    document.getElementById('submitBtn').textContent = '保存更改';
                    
                    document.getElementById('originalUrl').value = data.data.originalUrl;
                    document.getElementById('customSlug').value = data.data.shortCode;
                    document.getElementById('customSlug').disabled = true;
                    
                    document.getElementById('linkModal').classList.add('show');
                } else {
                    showMessage('加载链接数据失败', 'error');
                }
            } catch (error) {
                console.error('编辑链接失败:', error);
                showMessage('编辑链接失败', 'error');
            }
        }

        // 表单提交
        document.getElementById('linkForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                originalUrl: document.getElementById('originalUrl').value,
                customSlug: document.getElementById('customSlug').value || undefined,
                expireDays: document.getElementById('expireDays').value ? parseInt(document.getElementById('expireDays').value) : undefined
            };

            try {
                let response;
                if (state.currentEditingLink) {
                    response = await fetch(API_BASE + '/api/links/code/' + state.currentEditingLink.shortCode, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ originalUrl: data.originalUrl })
                    });
                } else {
                    response = await fetch(API_BASE + '/api/links', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                }

                const result = await response.json();
                
                if (result.success) {
                    showMessage(state.currentEditingLink ? '链接更新成功' : '链接创建成功');
                    closeLinkModal();
                    await refreshData();
                } else {
                    showMessage(result.error || '操作失败', 'error');
                }
            } catch (error) {
                console.error('提交失败:', error);
                showMessage('网络错误，请重试', 'error');
            }
        });

        // 链接操作函数
        async function toggleLinkStatus(shortCode) {
            try {
                const response = await fetch(API_BASE + '/api/links/code/' + shortCode + '/toggle', {
                    method: 'POST'
                });
                const result = await response.json();
                
                if (result.success) {
                    showMessage(result.message);
                    await refreshData();
                } else {
                    showMessage(result.error || '切换状态失败', 'error');
                }
            } catch (error) {
                console.error('切换状态失败:', error);
                showMessage('操作失败，请重试', 'error');
            }
        }

        async function deleteLink(shortCode) {
            if (!confirm('确定要删除短码 "' + shortCode + '" 吗？此操作不可撤销。')) {
                return;
            }

            try {
                const response = await fetch(API_BASE + '/api/links/code/' + shortCode, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (result.success) {
                    showMessage('链接删除成功');
                    await refreshData();
                } else {
                    showMessage(result.error || '删除失败', 'error');
                }
            } catch (error) {
                console.error('删除失败:', error);
                showMessage('删除失败，请重试', 'error');
            }
        }

        // 刷新数据
        async function refreshData() {
            await initializeDashboard();
        }

        // 关闭模态框（点击外部）
        document.getElementById('linkModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeLinkModal();
            }
        });
    </script>
</body>
</html>`;

    return c.html(dashboardHtml);
  } catch (error) {
    console.error("加载仪表板失败:", error);

    const response: ApiResponse = {
      success: false,
      error: "服务器内部错误",
      message: "加载管理仪表板失败",
    };

    c.status(500);
    return c.json(response);
  }
});

// 重定向路由 - 必须在最后添加，确保不会覆盖 API 路由
app.get("/:shortCode", async (c) => {
  const shortCode = c.req.param("shortCode");

  // 过滤掉明显的 API 路由和静态资源
  if (
    shortCode.startsWith("api") ||
    shortCode.startsWith("health") ||
    shortCode.startsWith("static") ||
    shortCode.includes(".") || // 包含点的可能是文件
    shortCode.length < 3 // 短码最小长度为3
  ) {
    const response: ApiResponse = {
      success: false,
      error: "路由不存在",
      message: "请求的路径不存在",
    };

    c.status(404);
    return c.json(response);
  }

  // 调用重定向处理器
  return handleRedirect(c, {
    redirectType: "temporary", // 使用302临时重定向
    enableAnalytics: true, // 启用访问统计
    enableCaching: false, // 禁用缓存以确保统计准确性
  });
});

// 根路径 - 欢迎页面
app.get("/", (c) => {
  const config = getAppConfig(c.env);

  const welcomeHtml = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Shorty - URL 短链接服务</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                line-height: 1.6;
                color: #333;
            }
            .header {
                text-align: center;
                margin-bottom: 3rem;
            }
            .logo {
                font-size: 3rem;
                font-weight: bold;
                color: #0066cc;
                margin-bottom: 0.5rem;
            }
            .subtitle {
                font-size: 1.2rem;
                color: #666;
            }
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 2rem;
                margin: 3rem 0;
            }
            .feature-card {
                padding: 1.5rem;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background: #f9f9f9;
            }
            .feature-title {
                font-weight: bold;
                color: #0066cc;
                margin-bottom: 0.5rem;
            }
            .api-info {
                background: #e8f4fd;
                padding: 1.5rem;
                border-radius: 8px;
                margin: 2rem 0;
            }
            .endpoint {
                font-family: 'Monaco', 'Menlo', monospace;
                background: #333;
                color: #fff;
                padding: 0.5rem;
                border-radius: 4px;
                margin: 0.5rem 0;
            }
            .status {
                display: inline-block;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.875rem;
                font-weight: bold;
            }
            .status.healthy {
                background: #d4edda;
                color: #155724;
            }
            .footer {
                text-align: center;
                margin-top: 3rem;
                padding-top: 2rem;
                border-top: 1px solid #e0e0e0;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🔗 Shorty</div>
            <div class="subtitle">现代化的 URL 短链接服务</div>
            <div class="status healthy">服务状态：运行中</div>
        </div>

        <div class="feature-grid">
            <div class="feature-card">
                <div class="feature-title">⚡ 高性能</div>
                <div>基于 Cloudflare Workers 边缘计算，全球加速访问</div>
            </div>
            <div class="feature-card">
                <div class="feature-title">🛡️ 安全可靠</div>
                <div>企业级安全防护，支持访问统计和过期设置</div>
            </div>
            <div class="feature-card">
                <div class="feature-title">🔧 易于使用</div>
                <div>RESTful API 设计，支持自定义短码和批量操作</div>
            </div>
            <div class="feature-card">
                <div class="feature-title">📊 数据洞察</div>
                <div>详细的访问统计和数据分析，助力业务决策</div>
            </div>
        </div>

        <div class="api-info">
            <h3>🚀 快速开始</h3>
            
            <div style="margin-bottom: 1rem;">
                <strong>管理仪表板：</strong>
                <div class="endpoint">
                    <a href="/dashboard" style="color: #fff; text-decoration: none;">
                        ${config.baseUrl}/dashboard
                    </a>
                </div>
            </div>
            
            <div>基础信息：</div>
            <div class="endpoint">GET ${config.baseUrl}/api/info</div>
            
            <div>健康检查：</div>
            <div class="endpoint">GET ${config.baseUrl}/health</div>
            
            <div>统计信息：</div>
            <div class="endpoint">GET ${config.baseUrl}/api/stats</div>
            
            <div>API 文档：</div>
            <div class="endpoint">GET ${config.baseUrl}/api/v1</div>
        </div>

        <div class="footer">
            <div>Shorty URL Shortener Service</div>
            <div>环境：${config.environment} | 版本：1.0.0</div>
        </div>
    </body>
    </html>
  `;

  return c.html(welcomeHtml);
});

// 404 处理
app.notFound(notFoundHandler());

// 导出默认应用
export default app;
