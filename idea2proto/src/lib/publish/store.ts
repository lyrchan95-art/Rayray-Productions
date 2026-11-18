import "server-only";
import { AwsClient } from "aws4fetch";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { wrapArtifact } from "../artifact/runtime";

/** Static hosting for published artifacts. R2 (S3 API) in production, local disk in dev. */
export interface PublishStore {
  readonly kind: string;
  put(slug: string, html: string): Promise<string>; // returns public URL
  remove(slug: string): Promise<void>;
}

const LOCAL_DIR = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "published");
const base = () => (process.env.PUBLIC_BASE_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");

class LocalStore implements PublishStore {
  readonly kind = "local";
  async put(slug: string, html: string) {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, `${slug}.html`), html, "utf8");
    return `${base()}/p/${slug}`;
  }
  async remove(slug: string) {
    await rm(path.join(LOCAL_DIR, `${slug}.html`), { force: true });
  }
}

export async function readLocal(slug: string): Promise<string | null> {
  if (!/^[a-z0-9]{6,32}$/.test(slug)) return null;
  return readFile(path.join(LOCAL_DIR, `${slug}.html`), "utf8").catch(() => null);
}

class R2Store implements PublishStore {
  readonly kind = "r2";
  private aws = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  private endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`;
  async put(slug: string, html: string) {
    const res = await this.aws.fetch(`${this.endpoint}/p/${slug}.html`, {
      method: "PUT",
      body: html,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
    });
    if (!res.ok) throw new Error(`R2 put ${res.status}`);
    return `${process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/p/${slug}.html`;
  }
  async remove(slug: string) {
    await this.aws.fetch(`${this.endpoint}/p/${slug}.html`, { method: "DELETE" });
  }
}

export function publishStore(): PublishStore {
  const r2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"].every((k) => process.env[k]);
  return r2 ? new R2Store() : new LocalStore();
}

export const newSlug = () => randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10).padEnd(10, "x");

/** The published file is self-contained: CSP meta + storage shim baked in. */
export const publishedDocument = (html: string) => wrapArtifact(html);
