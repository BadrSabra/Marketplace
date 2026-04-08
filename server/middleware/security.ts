import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

export const securityMiddleware = [
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' wss: ws:; " +
        "font-src 'self' data:;"
      );
    }
    next();
  }
];

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased for development/resource loading
  message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many requests from this IP" } },
  skip: (req) => {
    // Skip rate limiting for static assets and vite HMR
    return req.path.includes('/@vite/') || 
           req.path.includes('/@fs/') || 
           req.path.includes('/src/') ||
           req.path.endsWith('.js') ||
           req.path.endsWith('.css') ||
           req.path.endsWith('.ts');
  }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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
  if (contentLength > 10 * 1024 * 1024) { // 10MB
    return res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request payload exceeds 10MB limit" }
    });
  }
  next();
};
