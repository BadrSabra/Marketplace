import type { Request, Response } from "express";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface DeployLog {
  timestamp: string;
  status: "started" | "success" | "failed";
  message: string;
  duration?: number;
}

const DEPLOY_LOG_PATH = path.join(process.cwd(), "logs", "deploy.log");

function saveDeployLog(log: DeployLog) {
  try {
    const logsDir = path.dirname(DEPLOY_LOG_PATH);
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const existing = fs.existsSync(DEPLOY_LOG_PATH)
      ? JSON.parse(fs.readFileSync(DEPLOY_LOG_PATH, "utf8"))
      : [];
    existing.unshift(log);
    fs.writeFileSync(DEPLOY_LOG_PATH, JSON.stringify(existing.slice(0, 50), null, 2));
  } catch {
    console.error("[Deploy] Failed to save log");
  }
}

function verifyGitHubSignature(req: Request): boolean {
  if (!WEBHOOK_SECRET) return false;
  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(req.body as Buffer).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

async function runDeploy(): Promise<void> {
  const startTime = Date.now();
  saveDeployLog({ timestamp: new Date().toISOString(), status: "started", message: "بدأ التحديث التلقائي" });

  const scriptPath = path.join(process.cwd(), "deploy.sh");
  const command = fs.existsSync(scriptPath)
    ? `bash ${scriptPath}`
    : "git pull && npm install --production=false && npm run build";

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 300_000,
      env: { ...process.env, NODE_ENV: "production" },
    });

    const duration = Date.now() - startTime;
    console.log("[Deploy] ✅ نجح التحديث في", duration, "ms\n", stdout);
    if (stderr) console.warn("[Deploy] تحذيرات:", stderr);

    saveDeployLog({
      timestamp: new Date().toISOString(),
      status: "success",
      message: "تم التحديث بنجاح",
      duration,
    });

    setTimeout(() => {
      console.log("[Deploy] 🔄 إعادة تشغيل الخادم...");
      process.exit(0);
    }, 2000);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    console.error("[Deploy] ❌ فشل التحديث:", message);
    saveDeployLog({ timestamp: new Date().toISOString(), status: "failed", message, duration });
    throw error;
  }
}

export const deployController = {
  webhook: (req: Request, res: Response) => {
    if (!IS_PRODUCTION) {
      return res.status(403).json({ error: "النشر التلقائي متاح في بيئة الإنتاج فقط" });
    }

    if (!verifyGitHubSignature(req)) {
      console.warn("[Deploy] ⚠️ محاولة وصول غير مصرح بها");
      return res.status(401).json({ error: "توقيع غير صالح" });
    }

    const event = req.headers["x-github-event"];
    if (event !== "push") {
      return res.status(200).json({ message: `تجاهل حدث: ${event}` });
    }

    const payload = JSON.parse((req.body as Buffer).toString());
    const branch = payload?.ref?.replace("refs/heads/", "");
    if (branch !== "main") {
      return res.status(200).json({ message: `تجاهل فرع: ${branch}` });
    }

    res.status(202).json({
      message: "✅ تم استلام التحديث - بدأ النشر التلقائي",
      commit: payload?.head_commit?.message || "غير معروف",
      pusher: payload?.pusher?.name || "غير معروف",
    });

    runDeploy().catch((err) => console.error("[Deploy] خطأ في النشر:", err));
  },

  status: async (_req: Request, res: Response) => {
    try {
      const logs: DeployLog[] = fs.existsSync(DEPLOY_LOG_PATH)
        ? JSON.parse(fs.readFileSync(DEPLOY_LOG_PATH, "utf8"))
        : [];

      const { stdout: gitLog } = await execAsync("git log --oneline -5").catch(() => ({ stdout: "" }));
      const { stdout: gitStatus } = await execAsync("git status --short").catch(() => ({ stdout: "" }));

      res.json({
        lastDeploys: logs.slice(0, 10),
        recentCommits: gitLog.trim().split("\n").filter(Boolean),
        workingTree: gitStatus.trim() || "نظيف",
        uptime: Math.floor(process.uptime()) + " ثانية",
      });
    } catch {
      res.status(500).json({ error: "تعذر جلب الحالة" });
    }
  },
};
