import { Request, Response, NextFunction } from "express";

// Mocking rate limiter and security headers to avoid missing dependencies if they fail to install
export const securityMiddleware = [
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  }
];

export const generalLimiter = (req: Request, res: Response, next: NextFunction) => next();
export const loginLimiter = (req: Request, res: Response, next: NextFunction) => next();
export const orderLimiter = (req: Request, res: Response, next: NextFunction) => next();
export const depositLimiter = (req: Request, res: Response, next: NextFunction) => next();

export const payloadSizeLimit = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 1024 * 1024) { // 1MB
    return res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request payload exceeds 1MB limit" }
    });
  }
  next();
};
