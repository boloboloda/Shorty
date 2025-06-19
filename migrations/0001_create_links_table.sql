-- 创建链接表
CREATE TABLE links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_url TEXT NOT NULL,
    short_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    expires_at DATETIME NULL
);

-- 创建索引以提高查询性能
CREATE INDEX idx_short_code ON links(short_code);
CREATE INDEX idx_created_at ON links(created_at);
CREATE INDEX idx_expires_at ON links(expires_at); 