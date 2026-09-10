import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function start(script) {
  const child = spawn(npm, ["run", script], {
    stdio: "inherit",
    shell: true,
    windowsHide: false,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[laawa] Failed to start ${script}:`, error.message);
  });
  return child;
}

start("whatsapp");
start("dev");

function stop() {
  for (const child of children) {
    try { child.kill(); } catch {}
  }
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

process.on("exit", stop);
