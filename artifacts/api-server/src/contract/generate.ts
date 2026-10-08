import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function generateContract(data: unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PDF_PYTHON || "python3",
      [fileURLToPath(new URL("./contract/render.py", import.meta.url))],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    let bytes = 0;
    let failed = false;
    const stop = () => {
      failed = true;
      child.kill();
    };
    const timer = setTimeout(stop, 30_000);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 12 * 1024 * 1024) stop();
      else chunks.push(chunk);
    });
    // Do not log the renderer's input or error stream: both may contain personal data.
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("PDF renderer unavailable"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const pdf = Buffer.concat(chunks);
      if (failed || code !== 0 || pdf.subarray(0, 5).toString() !== "%PDF-")
        reject(new Error("PDF rendering failed"));
      else resolve(pdf);
    });
    child.stdin.end(JSON.stringify(data));
  });
}
