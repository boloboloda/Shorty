# 贡献指南

感谢您对 Shorty 短链接服务的关注和贡献！我们欢迎所有形式的贡献，无论是代码、文档、bug 报告还是功能建议。

## 🚀 如何开始

### 环境准备

1. Fork 本仓库到您的 GitHub 账户
2. 克隆您的 fork 到本地：
   ```bash
   git clone https://github.com/YOUR_USERNAME/shorty.git
   cd shorty
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 创建本地开发数据库：
   ```bash
   npx wrangler d1 create shorty-db
   npx wrangler d1 migrations apply shorty-db --local
   ```
5. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 📝 开发流程

### 1. 创建分支

从 `main` 分支创建您的功能分支：

```bash
git checkout -b feature/amazing-feature
# 或者
git checkout -b bugfix/fix-issue-123
```

### 2. 开发代码

- 遵循现有的代码风格和约定
- 编写清晰、有意义的提交信息
- 添加必要的测试用例
- 更新相关文档

### 3. 测试

确保您的更改通过所有测试：

```bash
npm run test
npm run type-check
npm run lint
```

### 4. 提交代码

```bash
git add .
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
```

### 5. 创建 Pull Request

1. 前往 GitHub 创建 Pull Request
2. 填写 PR 模板中的所有必要信息
3. 确保 CI 检查通过
4. 等待代码审查

## 🔧 代码规范

### TypeScript 规范

- 使用严格的 TypeScript 配置
- 为所有函数和变量提供类型注解
- 避免使用 `any` 类型
- 使用 Zod 进行运行时类型验证

### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 行末不要分号（除非必要）
- 遵循 ESLint 和 Prettier 配置

### 命名约定

- 变量和函数使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 类型和接口使用 PascalCase
- 文件名使用 kebab-case

### Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

类型包括：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

示例：

```
feat(analytics): add geographic location tracking
fix(redirect): handle expired links properly
docs(api): update authentication documentation
```

## 🧪 测试指南

### 运行测试

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test -- src/utils/slugGenerator.test.ts

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 编写测试

- 为新功能编写单元测试
- 确保测试覆盖率不低于 80%
- 使用描述性的测试名称
- 遵循 AAA 模式（Arrange, Act, Assert）

### 测试示例

```typescript
describe("SlugGenerator", () => {
  it("should generate unique slugs of specified length", () => {
    // Arrange
    const generator = new SlugGenerator();
    const length = 8;

    // Act
    const slug = generator.generateSlug(length);

    // Assert
    expect(slug).toHaveLength(length);
    expect(slug).toMatch(/^[a-zA-Z0-9]+$/);
  });
});
```

## 📋 Bug 报告

报告 Bug 时，请包含以下信息：

### 环境信息

- Node.js 版本
- npm/yarn 版本
- 操作系统
- 浏览器版本（如果相关）

### 重现步骤

1. 详细描述触发 Bug 的步骤
2. 提供最小化的重现示例
3. 包含相关的错误日志

### 期望行为

描述您期望发生的行为

### 实际行为

描述实际发生的行为

### 额外信息

- 截图（如果有助于理解问题）
- 相关配置文件
- 网络请求详情

## 💡 功能请求

提出功能请求时，请：

1. **描述问题** - 解释当前的限制或缺失的功能
2. **建议解决方案** - 详细描述您希望如何解决
3. **考虑替代方案** - 列出您考虑过的其他解决方案
4. **使用场景** - 提供具体的使用场景

## 📚 文档贡献

文档改进包括：

- 修复拼写错误和语法错误
- 添加缺失的文档
- 改进现有文档的清晰度
- 添加使用示例
- 翻译文档

## 🎯 优先级指南

我们优先考虑以下类型的贡献：

### 高优先级

- 安全漏洞修复
- 性能问题修复
- 数据丢失 Bug 修复
- API 兼容性问题

### 中优先级

- 新功能实现
- 用户体验改进
- 代码重构
- 测试覆盖率提升

### 低优先级

- 代码风格优化
- 文档改进
- 示例代码添加

## ❓ 获得帮助

如果您需要帮助：

1. **查看文档** - 首先查看 README 和相关文档
2. **搜索 Issues** - 查看是否有人遇到过类似问题
3. **创建 Discussion** - 在 GitHub Discussions 中提问
4. **联系维护者** - 通过 Issue 或 Email 联系

## 📄 许可证

通过贡献代码，您同意您的贡献将在 MIT 许可证下授权。

---

再次感谢您的贡献！您的参与让 Shorty 变得更好。 🚀
