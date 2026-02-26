import fs from "fs";
import path from "path";

async function verifyBackup() {
  const backupsDir = path.join(process.cwd(), "backups");
  console.log(JSON.stringify({ level: "info", message: "Verifying backups...", directory: backupsDir }));

  try {
    if (!fs.existsSync(backupsDir)) {
      throw new Error("Backups directory does not exist.");
    }

    const files = fs.readdirSync(backupsDir).filter(f => f.endsWith(".sql")).sort().reverse();
    if (files.length === 0) {
      throw new Error("No SQL backups found.");
    }

    const latestBackup = path.join(backupsDir, files[0]);
    const stats = fs.statSync(latestBackup);

    if (stats.size === 0) {
      throw new Error(`Latest backup ${files[0]} is empty.`);
    }

    console.log(JSON.stringify({
      level: "info",
      message: "Backup verified successfully.",
      filename: files[0],
      size: stats.size,
      timestamp: stats.mtime
    }));

  } catch (error: any) {
    console.error(JSON.stringify({ level: "error", message: "Backup verification failed", error: error.message }));
    process.exit(1);
  }
}

verifyBackup();
