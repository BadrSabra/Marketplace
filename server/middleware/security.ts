import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Request, Response, NextFunction } from "express";

// General security headers
export const securityMiddleware = [
  helmet(),
];

// Rate Limiters
export const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100,
  message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many login attempts, please try again later" } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Order creation limit reached" } },
});

export const depositLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Deposit request limit reached" } },
});

// Payload size hardening
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
