// Browser-safe entry for the retained local installation. No files or data move.
if (process.env.DEPLOY_ENV !== "local") throw new Error("local_environment_required");
process.env.LOCAL_BROWSER_ORIGIN = "http://127.0.0.1:4192";
await import("./main.ts");
