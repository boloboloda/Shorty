# Contributing Guide

> [中文版](CONTRIBUTING_zh.md) | English

Thank you for your interest in contributing to Shorty URL Shortener Service! We welcome all forms of contributions, whether it's code, documentation, bug reports, or feature suggestions.

## 🚀 Getting Started

### Environment Setup

1. Fork this repository to your GitHub account
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/shorty.git
   cd shorty
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create local development database:
   ```bash
   npx wrangler d1 create shorty-db
   npx wrangler d1 migrations apply shorty-db --local
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

## 📝 Development Workflow

### 1. Create a Branch

Create your feature branch from `main`:

```bash
git checkout -b feature/amazing-feature
# or
git checkout -b bugfix/fix-issue-123
```

### 2. Develop Code

- Follow existing code style and conventions
- Write clear, meaningful commit messages
- Add necessary test cases
- Update relevant documentation

### 3. Testing

Ensure your changes pass all tests:

```bash
npm run test
npm run type-check
npm run lint
```

### 4. Commit Code

```bash
git add .
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
```

### 5. Create Pull Request

1. Go to GitHub and create a Pull Request
2. Fill out all necessary information in the PR template
3. Ensure CI checks pass
4. Wait for code review

## 🔧 Code Standards

### TypeScript Standards

- Use strict TypeScript configuration
- Provide type annotations for all functions and variables
- Avoid using `any` type
- Use Zod for runtime type validation

### Code Style

- Use 2 spaces for indentation
- Use single quotes
- No semicolons at line end (unless necessary)
- Follow ESLint and Prettier configuration

### Naming Conventions

- Variables and functions use camelCase
- Constants use UPPER_SNAKE_CASE
- Types and interfaces use PascalCase
- File names use kebab-case

### Git Commit Standards

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types include:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation updates
- `style`: Code formatting
- `refactor`: Code refactoring
- `test`: Test-related
- `chore`: Build process or auxiliary tool changes

Examples:

```
feat(analytics): add geographic location tracking
fix(redirect): handle expired links properly
docs(api): update authentication documentation
```

## 🧪 Testing Guide

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- src/utils/slugGenerator.test.ts

# Run tests with coverage report
npm run test:coverage
```

### Writing Tests

- Write unit tests for new features
- Ensure test coverage is no less than 80%
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Test Example

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

## 📋 Bug Reports

When reporting bugs, please include the following information:

### Environment Information

- Node.js version
- npm/yarn version
- Operating system
- Browser version (if relevant)

### Reproduction Steps

1. Detailed steps to trigger the bug
2. Provide minimal reproduction example
3. Include relevant error logs

### Expected Behavior

Describe what you expected to happen

### Actual Behavior

Describe what actually happened

### Additional Information

- Screenshots (if helpful for understanding the issue)
- Relevant configuration files
- Network request details

## 💡 Feature Requests

When proposing feature requests, please:

1. **Describe the Problem** - Explain current limitations or missing functionality
2. **Suggest Solution** - Detail how you'd like to solve it
3. **Consider Alternatives** - List other solutions you've considered
4. **Use Cases** - Provide specific use cases

## 📚 Documentation Contributions

Documentation improvements include:

- Fix spelling and grammar errors
- Add missing documentation
- Improve clarity of existing documentation
- Add usage examples
- Translate documentation

## 🎯 Priority Guidelines

We prioritize the following types of contributions:

### High Priority

- Security vulnerability fixes
- Performance issue fixes
- Data loss bug fixes
- API compatibility issues

### Medium Priority

- New feature implementation
- User experience improvements
- Code refactoring
- Test coverage improvements

### Low Priority

- Code style optimization
- Documentation improvements
- Example code additions

## ❓ Getting Help

If you need help:

1. **Check Documentation** - First check README and related docs
2. **Search Issues** - See if someone has encountered similar problems
3. **Create Discussion** - Ask questions in GitHub Discussions
4. **Contact Maintainers** - Through Issues or Email

## 📄 License

By contributing code, you agree that your contributions will be licensed under the MIT License.

---

Thank you again for your contributions! Your participation makes Shorty better. 🚀
