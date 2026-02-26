import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export interface AppError extends Error {
  code: string;
  status?: number;
  details?: any;
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req as any).requestId || randomUUID();
  const status = err.status || err.statusCode || 500;
  
  let code = err.code || "SYSTEM_ERROR";
  let message = err.message || "An unexpected error occurred";

  // Standardize Error Categories
  if (err.name === "ZodError" || err.name === "ValidationError") {
    code = "VALIDATION_ERROR";
    message = "Input validation failed";
  } else if (status === 401) {
    code = "AUTH_ERROR";
  } else if (status === 403) {
    code = "PERMISSION_DENIED";
  } else if (status === 404) {
    code = "NOT_FOUND";
  }

  // Internal Logging
  console.error(`[${new Date().toISOString()}] [${requestId}] ${code}: ${err.message}`);
  console.error(err.stack);
  console.error(`User: ${(req as any).user?.id || 'anonymous'}, Role: ${(req as any).user?.role || 'none'}, Endpoint: ${req.method} ${req.path}`);

  if (res.headersSent) {
    return next(err);
  }

  res.setHeader("X-Request-ID", requestId);
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: requestId
    }
  });
};

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
};
