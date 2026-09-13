import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireLocal,
  acquireRemote,
  canonicalPayloadSha256,
  extractTarGz,
  latestStableTag,
  parseStableSemver,
  selectSourceSelector,
  validateManifest,
} from "../scripts/install.ts";

const tempDirs: string[] = [];
function makeTemp(): string {
  const dir = mkdtempSync(join(tmpdir(), "ddd-install-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

describe("parseStableSemver", () => {
  test("accepts a bare and a v-prefixed stable version", () => {
    expect(parseStableSemver("1.2.3")).toEqual([1, 2, 3]);
    expect(parseStableSemver("v0.10.0")).toEqual([0, 10, 0]);
  });

  test("rejects prerelease and malformed versions", () => {
    expect(parseStableSemver("1.2.3-rc.1")).toBeNull();
    expect(parseStableSemver("1.2")).toBeNull();
    expect(parseStableSemver("v01.2.3")).toBeNull();
  });
});

describe("latestStableTag", () => {
  test("picks the highest stable tag and ignores prereleases", () => {
    expect(latestStableTag(["v1.2.0", "1.10.0", "v2.0.0-rc.1", "v1.9.9"])).toBe("1.10.0");
  });

  test("returns null when there is no stable tag", () => {
    expect(latestStableTag(["v1.0.0-rc.1", "nightly"])).toBeNull();
  });
});

describe("selectSourceSelector", () => {
  test("prefers from, then ref, then tag, then latest", () => {
    expect(selectSourceSelector({ from: "/x" }).kind).toBe("local");
    expect(selectSourceSelector({ ref: "main" }).kind).toBe("ref");
    expect(selectSourceSelector({ tag: "v1.0.0" }).kind).toBe("tag");
    expect(selectSourceSelector({}).kind).toBe("latest");
  });
});

describe("canonicalPayloadSha256", () => {
  test("is deterministic and independent of entry order", () => {
    const a = { path: "b.ts", bytes: new TextEncoder().encode("b") };
    const b = { path: "a.ts", bytes: new TextEncoder().encode("a") };
    expect(canonicalPayloadSha256([a, b])).toBe(canonicalPayloadSha256([b, a]));
    expect(canonicalPayloadSha256([a, b])).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("extractTarGz", () => {
  test("extracts a real tarball and rejects unsafe paths", () => {
    const source = makeTemp();
    mkdirSync(join(source, "nested"), { recursive: true });
    writeFileSync(join(source, "nested", "a.txt"), "hello");
    const archive = join(source, "payload.tar.gz");
    const tar = Bun.spawnSync(["tar", "-czf", archive, "-C", source, "nested"]);
    expect(tar.exitCode).toBe(0);
    const dest = makeTemp();
    extractTarGz(new Uint8Array(readFileSync(archive)), dest);
    expect(readFileSync(join(dest, "nested", "a.txt"), "utf-8")).toBe("hello");
  });
});

describe("acquireLocal", () => {
  test("rejects the plugin root itself", () => {
    const root = makeTemp();
    mkdirSync(join(root, ".aidlc-plugin"), { recursive: true });
    writeFileSync(join(root, ".aidlc-plugin", "plugin.json"), "{}");
    expect(() => acquireLocal(root)).toThrow(/repository root/);
  });

  test("resolves <root>/ddd/.aidlc-plugin/plugin.json", () => {
    const root = makeTemp();
    mkdirSync(join(root, "ddd", ".aidlc-plugin"), { recursive: true });
    writeFileSync(join(root, "ddd", ".aidlc-plugin", "plugin.json"), '{"name":"ddd","version":"0.1.0"}');
    const resolved = acquireLocal(root);
    expect(resolved.source).toBe("local");
    expect(validateManifest(resolved).version).toBe("0.1.0");
  });
});

describe("remote source acquisition", () => {
  function archive(): Uint8Array {
    const root = makeTemp();
    const manifest = join(root, "release/ddd/.aidlc-plugin/plugin.json");
    mkdirSync(join(root, "release/ddd/.aidlc-plugin"), { recursive: true });
    writeFileSync(manifest, '{"name":"ddd","version":"0.1.0"}');
    const path = join(root, "source.tar.gz");
    expect(Bun.spawnSync(["tar", "-czf", path, "-C", root, "release"]).exitCode).toBe(0);
    return new Uint8Array(readFileSync(path));
  }
  test("a tagged archive is acquired and its manifest version is verified", async () => {
    const bytes = archive();
    const source = await acquireRemote("tag", "v0.1.0", async (url) => {
      expect(String(url)).toBe("https://codeload.github.com/amadeus-dlc/aidlc-ddd-plugin/tar.gz/refs/tags/v0.1.0");
      return new Response(bytes);
    });
    try {
      expect(source.source).toBe("tag");
      expect(validateManifest(source).version).toBe("0.1.0");
      expect(() => validateManifest({ ...source, requestedTag: "v0.2.0" })).toThrow("does not match");
    } finally {
      if (source.cleanupRoot) rmSync(source.cleanupRoot, { recursive: true, force: true });
    }
  });
  test("latest resolves a stable tag before downloading the archive", async () => {
    const bytes = archive();
    const source = await acquireRemote("latest", "", async (url) => {
      if (String(url) === "https://api.github.com/repos/amadeus-dlc/aidlc-ddd-plugin/tags?per_page=100")
        return new Response(JSON.stringify([{ name: "v0.1.0" }, { name: "v0.2.0-rc.1" }]));
      expect(String(url)).toBe("https://codeload.github.com/amadeus-dlc/aidlc-ddd-plugin/tar.gz/refs/tags/v0.1.0");
      return new Response(bytes);
    });
    try {
      expect(source.source).toBe("latest");
      expect(source.ref).toBe("v0.1.0");
    } finally {
      if (source.cleanupRoot) rmSync(source.cleanupRoot, { recursive: true, force: true });
    }
  });
  test("HTTP failures are reported as acquisition failures", async () => {
    await expect(
      acquireRemote("ref", "main", async () => new Response("unavailable", { status: 503 })),
    ).rejects.toThrow("HTTP 503");
  });
});
