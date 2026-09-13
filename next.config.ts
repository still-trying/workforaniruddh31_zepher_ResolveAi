import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json outside this repo makes Turbopack guess the wrong workspace
  // root, so pin it explicitly to the project directory.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  allowedDevOrigins: ["172.16.0.2"],
};

export default nextConfig;
