import type { NextConfig } from "next";
import path from "path";

// Set by .github/workflows/deploy.yml so the GitHub Pages build gets the
// `/bfr-data-workflow` project-pages prefix; local dev/build stays unprefixed.
const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPages ? "/bfr-data-workflow" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Pin explicitly: an unrelated lockfile one level up from the repo
  // (~/Documents/GitHub/package-lock.json) otherwise makes Next guess the
  // workspace root wrong.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
