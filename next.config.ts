import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 仅复制生产运行真正需要的文件，供 Docker runner 阶段使用。
  output: "standalone",
  // pdf-parse/pdfjs 使用 Node 原生 canvas 和独立 worker；外部化后 standalone
  // 文件追踪会连同这些运行时依赖复制，避免 Turbopack bundle 丢失 DOMMatrix polyfill。
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/knowledge/import": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/pdfjs-dist/legacy/build/**/*",
    ],
  },
};

export default nextConfig;
