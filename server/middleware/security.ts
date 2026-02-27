import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

export const securityMiddleware = [
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  }
];

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests from this IP" } }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: { code: "LOGIN_ATTEMPTS_EXCEEDED", message: "Too many login attempts. Try again later." } }
});

export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { success: false, error: { code: "OTP_VERIFY_ATTEMPTS_EXCEEDED", message: "Too many verification attempts. Try again later." } }
});

export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { success: false, error: { code: "ORDER_LIMIT_EXCEEDED", message: "Too many orders. Try again later." } }
});

export const depositLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: { code: "DEPOSIT_LIMIT_EXCEEDED", message: "Too many deposit attempts. Try again later." } }
});

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
