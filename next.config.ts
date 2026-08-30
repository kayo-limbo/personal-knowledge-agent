import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 仅复制生产运行真正需要的文件，供 Docker runner 阶段使用。
  output: "standalone",
};

export default nextConfig;
