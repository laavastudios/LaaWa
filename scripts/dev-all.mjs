import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npm, ["run", "whatsapp"], { stdio: "inherit", shell: false }),
  spawn(npm, ["run", "dev"], { stdio: "inherit", shell: false }),
];

function stop() {
  for (const child of children) child.kill();
  process.exit();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", () => {
  for (const child of children) child.kill();
});
