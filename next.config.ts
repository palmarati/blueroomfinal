import type { NextConfig } from "next";

function buildCsp(env: string) {
  const isProd = env === "production";
  const isDevRuntime = process.env.NODE_ENV !== "production";
  const scriptSrc = isProd ? "https://web.squarecdn.com" : "https://sandbox.web.squarecdn.com";
  const frameSrc = scriptSrc;
  const connectSrc = isProd ? "https://pci-connect.squareup.com" : "https://sandbox.web.squarecdn.com https://pci-connect.squareupsandbox.com";
  const fontSrc = "https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net";
  const scriptDirectives = [`script-src 'self' ${scriptSrc}`];
  if (isDevRuntime) {
    scriptDirectives[0] += " 'unsafe-eval' 'unsafe-inline' blob:"; // Next dev/HMR and Turbopack workers + inline dev scripts
  }
  const connectDirectives = [`connect-src 'self' ${connectSrc}`];
  if (isDevRuntime) {
    connectDirectives[0] += " ws: http://localhost:*"; // enable HMR websockets and dev connections
  }
  const parts = [
    "default-src 'self' blob: data:",
    scriptDirectives[0],
    `frame-src 'self' ${frameSrc}`,
    connectDirectives[0],
    "style-src 'self' 'unsafe-inline'",
    `font-src 'self' ${fontSrc}`,
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
  ];
  return parts.join("; ");
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
