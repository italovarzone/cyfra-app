/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.sscdn.co" },
      { protocol: "https", hostname: "**.cifraclub.com.br" },
    ],
  },
};

export default nextConfig;
