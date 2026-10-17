import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./src/app/styles/tokens.css"],
  },
  outputFileTracingExcludes: {
    "/*": ["./mocks/**"],
  },
  // 저장소가 관리하는 AGENTS.md에
  // 개발 서버가 규칙을 덧붙이지 않게 해요.
  agentRules: false,
};

export default nextConfig;
