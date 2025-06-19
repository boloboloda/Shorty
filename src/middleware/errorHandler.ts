/**
 * 错误处理中间件
 * 统一处理应用中的错误和异常
 */

import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { ApiResponse, Env, ValidationError } from "../types/index.js";

// 错误类型定义
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: any
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationException extends AppError {
  public errors: ValidationError[];

  constructor(errors: ValidationError[], message: string = "验证失败") {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors;
    this.details = { errors };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "资源") {
    super(`${resource}不存在`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "资源冲突") {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "请求过于频繁") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

// 错误响应构造器
function createErrorResponse(error: any, env: Env): ApiResponse {
  // 开发环境显示详细错误信息
  const isDevelopment = env.ENVIRONMENT === "development";

  if (error instanceof ValidationException) {
    return {
      success: false,
      error: error.message,
      data: {
        code: error.code,
        errors: error.errors,
        ...(isDevelopment && { stack: error.stack }),
      },
    };
  }

  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      data: {
        code: error.code,
        ...(error.details && { details: error.details }),
        ...(isDevelopment && { stack: error.stack }),
      },
    };
  }

  if (error instanceof HTTPException) {
    return {
      success: false,
      error: error.message || "请求处理失败",
      data: {
        code: "HTTP_ERROR",
        statusCode: error.status,
        ...(isDevelopment && { stack: error.stack }),
      },
    };
  }

  // 处理数据库错误
  if (error.name === "D1_ERROR" || error.message?.includes("D1")) {
    return {
      success: false,
      error: "数据库操作失败",
      data: {
        code: "DATABASE_ERROR",
        ...(isDevelopment && {
          originalError: error.message,
          stack: error.stack,
        }),
      },
    };
  }

  // 处理网络错误
  if (error.name === "TypeError" && error.message?.includes("fetch")) {
    return {
      success: false,
      error: "网络请求失败",
      data: {
        code: "NETWORK_ERROR",
        ...(isDevelopment && {
          originalError: error.message,
          stack: error.stack,
        }),
      },
    };
  }

  // 默认错误处理
  return {
    success: false,
    error: isDevelopment ? error.message : "服务器内部错误",
    data: {
      code: "INTERNAL_ERROR",
      ...(isDevelopment && {
        originalError: error.message,
        stack: error.stack,
      }),
    },
  };
}

// 错误日志记录
function logError(error: any, context: Context<{ Bindings: Env }>) {
  const { req } = context;
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.header("User-Agent") || "Unknown";
  const ip =
    req.header("CF-Connecting-IP") ||
    req.header("X-Forwarded-For") ||
    "Unknown";

  const logData = {
    timestamp,
    level: "ERROR",
    method,
    url,
    userAgent,
    ip,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof AppError && {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      }),
    },
  };

  // 在开发环境中输出到控制台
  if (context.env.ENVIRONMENT === "development") {
    console.error("🚨 错误日志:", JSON.stringify(logData, null, 2));
  } else {
    // 在生产环境中可以发送到日志服务
    console.error(JSON.stringify(logData));
  }
}

/**
 * 主错误处理中间件
 */
export function errorHandler() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      await next();
    } catch (error: any) {
      // 记录错误日志
      logError(error, c);

      // 创建错误响应
      const errorResponse = createErrorResponse(error, c.env);

      // 确定状态码
      let statusCode = 500;
      if (error instanceof AppError) {
        statusCode = error.statusCode;
      } else if (error instanceof HTTPException) {
        statusCode = error.status;
      }

      // 设置响应头
      c.status(statusCode as any);
      c.header("Content-Type", "application/json");

      return c.json(errorResponse);
    }
  };
}

/**
 * 404 处理中间件
 */
export function notFoundHandler() {
  return (c: Context<{ Bindings: Env }>) => {
    const errorResponse: ApiResponse = {
      success: false,
      error: "请求的资源不存在",
      data: {
        code: "NOT_FOUND",
        path: c.req.path,
        method: c.req.method,
      },
    };

    c.status(404);
    return c.json(errorResponse);
  };
}

/**
 * 异步错误包装器
 * 用于包装异步处理函数，自动捕获和处理错误
 */
export function asyncHandler<T>(
  handler: (c: Context<{ Bindings: Env }>) => Promise<T>
) {
  return async (c: Context<{ Bindings: Env }>) => {
    try {
      return await handler(c);
    } catch (error) {
      throw error; // 重新抛出，让错误处理中间件处理
    }
  };
}

/**
 * 创建业务错误的便捷函数
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string
) {
  return new AppError(message, statusCode, code);
}

export function createValidationError(
  errors: ValidationError[],
  message?: string
) {
  return new ValidationException(errors, message);
}

export function createNotFoundError(resource?: string) {
  return new NotFoundError(resource);
}

export function createConflictError(message?: string) {
  return new ConflictError(message);
}

export function createRateLimitError(message?: string) {
  return new RateLimitError(message);
}
