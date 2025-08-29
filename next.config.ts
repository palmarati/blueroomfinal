import type { NextConfig } from "next";

function buildCsp(env: string) {
  const isProd = env === "production";
  const isDevRuntime = process.env.NODE_ENV !== "production";

  if (isDevRuntime) {
    // Relaxed CSP for dev to avoid blank screens due to blocked HMR/overlay/scripts
    return [
      "default-src 'self' blob: data: https: http:",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https: http:",
      "style-src 'self' 'unsafe-inline' https: http:",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' ws: wss: https: http:",
      "frame-src 'self' https: http:",
      "font-src https: http:",
    ].join("; ");
  }

  const scriptSrc = isProd ? "https://web.squarecdn.com" : "https://sandbox.web.squarecdn.com";
  const frameSrc = scriptSrc;
  const connectSrc = isProd ? "https://pci-connect.squareup.com" : "https://pci-connect.squareupsandbox.com";
  const fontSrc = "https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net";
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptSrc}`,
    `frame-src 'self' ${frameSrc}`,
    `connect-src 'self' ${connectSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `font-src ${fontSrc}`,
    "img-src 'self' data:",
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    const env = process.env.SQUARE_ENV?.toLowerCase() === "production" ? "production" : "sandbox";
    const csp = buildCsp(env);
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
