-- 访问日志表 - 记录每次访问的详细信息
CREATE TABLE access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    short_code TEXT NOT NULL,
    
    -- 访问时间信息
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 请求信息
    ip_address TEXT,
    user_agent TEXT,
    referer TEXT,
    
    -- 地理位置信息（可选，基于IP解析）
    country TEXT,
    city TEXT,
    
    -- 设备信息（从User-Agent解析）
    device_type TEXT, -- mobile, desktop, tablet, bot
    browser TEXT,
    os TEXT,
    
    -- 性能指标
    response_time_ms INTEGER,
    
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- 访问日志索引 - 优化查询性能
CREATE INDEX idx_access_logs_link_id ON access_logs(link_id);
CREATE INDEX idx_access_logs_short_code ON access_logs(short_code);
CREATE INDEX idx_access_logs_accessed_at ON access_logs(accessed_at);
CREATE INDEX idx_access_logs_ip_address ON access_logs(ip_address);
CREATE INDEX idx_access_logs_device_type ON access_logs(device_type);

-- 复合索引优化常见查询
CREATE INDEX idx_access_logs_link_date ON access_logs(link_id, accessed_at);
CREATE INDEX idx_access_logs_date_device ON access_logs(accessed_at, device_type);

-- 每日统计聚合表 - 提高查询性能
CREATE TABLE daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    short_code TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD 格式
    
    -- 访问统计
    total_visits INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0, -- 基于IP去重
    
    -- 设备统计
    mobile_visits INTEGER DEFAULT 0,
    desktop_visits INTEGER DEFAULT 0,
    tablet_visits INTEGER DEFAULT 0,
    bot_visits INTEGER DEFAULT 0,
    
    -- 地理统计
    top_countries TEXT, -- JSON格式存储前5个国家
    top_cities TEXT,    -- JSON格式存储前5个城市
    
    -- 来源统计
    top_referers TEXT,  -- JSON格式存储前5个来源
    
    -- 时间统计
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
    UNIQUE(link_id, date)
);

-- 每日统计索引
CREATE INDEX idx_daily_stats_link_id ON daily_stats(link_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);
CREATE INDEX idx_daily_stats_short_code ON daily_stats(short_code);
CREATE INDEX idx_daily_stats_link_date ON daily_stats(link_id, date);

-- 链接设置表 - 存储链接的高级配置
CREATE TABLE link_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL UNIQUE,
    
    -- 访问控制
    is_active BOOLEAN DEFAULT 1,        -- 链接是否启用
    password TEXT,                      -- 访问密码（可选）
    max_visits INTEGER,                 -- 最大访问次数限制
    
    -- 重定向设置
    redirect_type TEXT DEFAULT '302',   -- 301, 302, 307
    enable_preview BOOLEAN DEFAULT 0,   -- 是否启用预览页面
    
    -- 统计设置
    track_analytics BOOLEAN DEFAULT 1,  -- 是否启用访问统计
    track_location BOOLEAN DEFAULT 1,   -- 是否记录地理位置
    track_device BOOLEAN DEFAULT 1,     -- 是否记录设备信息
    
    -- 安全设置
    allowed_referers TEXT,              -- JSON格式，允许的来源域名
    blocked_countries TEXT,             -- JSON格式，阻止的国家代码
    blocked_ips TEXT,                   -- JSON格式，阻止的IP地址
    
    -- 时间信息
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- 链接设置索引
CREATE INDEX idx_link_settings_link_id ON link_settings(link_id);
CREATE INDEX idx_link_settings_is_active ON link_settings(is_active);

-- 系统配置表 - 存储全局设置
CREATE TABLE system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认系统配置
INSERT INTO system_config (key, value, description) VALUES
('analytics_retention_days', '365', '访问日志保留天数'),
('daily_stats_retention_days', '1095', '每日统计保留天数（3年）'),
('max_visits_per_minute', '60', '每分钟最大访问次数限制'),
('enable_geo_tracking', '1', '是否启用地理位置追踪'),
('enable_device_tracking', '1', '是否启用设备信息追踪'),
('default_redirect_type', '302', '默认重定向类型'),
('enable_analytics_by_default', '1', '新链接默认启用统计'),
('cleanup_interval_hours', '24', '自动清理任务间隔（小时）');

-- 系统配置索引
CREATE INDEX idx_system_config_key ON system_config(key);

-- 添加触发器：自动更新 updated_at 字段
CREATE TRIGGER update_daily_stats_updated_at 
    AFTER UPDATE ON daily_stats
    BEGIN
        UPDATE daily_stats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_link_settings_updated_at 
    AFTER UPDATE ON link_settings
    BEGIN
        UPDATE link_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_system_config_updated_at 
    AFTER UPDATE ON system_config
    BEGIN
        UPDATE system_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- 为现有链接创建默认设置
INSERT INTO link_settings (link_id)
SELECT id FROM links WHERE id NOT IN (SELECT link_id FROM link_settings); 