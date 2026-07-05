import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Self-contained server bundle for the Docker image
  output: "standalone",
};

export default nextConfig;
