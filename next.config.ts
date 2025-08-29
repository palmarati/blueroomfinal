import type { NextConfig } from "next";

function buildCsp(env: string) {
  const isProd = env === "production";
  const scriptSrc = isProd ? "https://web.squarecdn.com" : "https://sandbox.web.squarecdn.com";
  const frameSrc = scriptSrc;
  const connectSrc = isProd ? "https://pci-connect.squareup.com" : "https://sandbox.web.squarecdn.com https://pci-connect.squareupsandbox.com";
  const fontSrc = "https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net";
  const parts = [
    "default-src 'self'",
    `script-src 'self' ${scriptSrc}`,
    `frame-src 'self' ${frameSrc}`,
    `connect-src 'self' ${connectSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `font-src ${fontSrc}`,
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
