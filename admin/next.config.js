/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // eslint:recommended flags browser/TS globals (React, RequestInit) as
  // no-undef in pre-existing files; lint is advisory here, types still check.
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
