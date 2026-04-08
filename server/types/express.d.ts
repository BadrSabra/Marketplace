import "express";

declare module "express" {
  interface Request {
    user?: {
      id: string;
      role: string;
      email: string;
      name?: string;
    };
  }
}
