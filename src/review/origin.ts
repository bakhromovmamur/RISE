export function assertReviewOrigin(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || !["4174", "4180", "4182"].includes(url.port)) {
    throw new Error("The review build only runs on isolated local ports 4174, 4180 or 4182. Use the production build for your personal profile.");
  }
}
