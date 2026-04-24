/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        worker_threads: false,
      };
    }
    // snarkjs uses web-worker with dynamic requires; suppress the warning
    config.module = config.module ?? {};
    config.module.exprContextCritical = false;
    return config;
  },
};

export default nextConfig;
