import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function start(script) {
  const child = spawn(npm, ["run", script], {
    stdio: "inherit",
    windowsHide: false,
    shell: process.platform === "win32",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[laawa] Failed to start ${script}:`, error.message);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (code && code !== 0) shutdown(code);
    else if (signal) shutdown(1);
  });
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      try { child.kill(); } catch {}
    }
  }
  setTimeout(() => process.exit(code), 50).unref();
}

start("whatsapp");
start("dev");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => {
  for (const child of children) {
    try { child.kill(); } catch {}
  }
});
