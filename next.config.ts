import type { NextConfig } from "next";

// GitHub Pages 的项目站点部署在 /<repo>/ 子路径下，构建时通过环境变量注入；
// 本地开发与静态预览保持根路径。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
