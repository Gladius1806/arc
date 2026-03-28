/** @type {import('next').NextConfig} */
const nextConfig = {
  // OneDrive + Windows can cause readlink EINVAL on .next internals.
  // Using a custom build directory avoids that path conflict.
  distDir: ".next-build",
};

export default nextConfig;
