import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export const opaque = () => randomBytes(32).toString("hex");
export const hash = (value: string) => createHash("sha256").update(value).digest();
export const validOpaque = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export function secrets(key: Buffer, installation: string) {
  const derive = (purpose: string) => Buffer.from(hkdfSync("sha256", key, installation, `rise-auth-${purpose}-v1`, 32));
  const encryption = derive("encryption"), csrf = derive("csrf"), rate = derive("rate");
  return {
    rate: (value: string) => createHmac("sha256", rate).update(value).digest(),
    csrf: (context: string, session: string | null) => createHmac("sha256", csrf).update(`${context}:${session ?? "guest"}`).digest("hex"),
    equal: (a: string, b: unknown) => validOpaque(b) && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex")),
    seal(value: unknown, binding: string) {
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryption, iv);
      cipher.setAAD(Buffer.from(`${installation}:${binding}`));
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
      return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
    },
    open(value: string, binding: string): unknown {
      const [version, iv, tag, payload, extra] = value.split(".");
      if (version !== "v1" || extra || !iv || !tag || !payload || value.length > 65536) throw new Error("invalid_auth_cipher");
      const decipher = createDecipheriv("aes-256-gcm", encryption, Buffer.from(iv, "base64url"));
      decipher.setAAD(Buffer.from(`${installation}:${binding}`)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]).toString("utf8"));
    },
  };
}
