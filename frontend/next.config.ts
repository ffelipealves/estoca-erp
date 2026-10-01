import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Phosphor ships a barrel; import only the icons we use.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
}

export default nextConfig
