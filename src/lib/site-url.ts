export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SITE_URL must be configured for production.");
    }
    return new URL("http://localhost:3000");
  }

  const url = new URL(configuredUrl);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((!isLocal && url.protocol !== "https:") || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a site origin using HTTPS.");
  }

  return url;
}
