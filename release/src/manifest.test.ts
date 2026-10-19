import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { releaseManifest, withOffloadVersion } from "./manifest.ts";

const version = "4.0.0-beta.2-offload.3";
const upstreamNames = new Set(["payload", "@payloadcms/ui", "@payloadcms/graphql"]);

describe("releaseManifest", () => {
  test("publishes an upstream package under its Offload name with upstream dependencies aliased", () => {
    const release = releaseManifest(
      {
        name: "@payloadcms/graphql",
        version: "4.0.0-beta.2",
        author: "Payload <dev@payloadcms.com>",
        dependencies: { "@payloadcms/ui": "workspace:*", "graphql-scalars": "1.22.2" },
        devDependencies: { "@payloadcms/eslint-config": "workspace:*" },
        peerDependencies: { graphql: "^16.8.1", payload: "workspace:*" },
      },
      { upstreamNames, version },
    );

    assert.equal(release.name, "@adirishi/offload-graphql");
    assert.equal(release.version, version);
    assert.equal(release.author, undefined);
    assert.equal(release.devDependencies, undefined);
    assert.deepEqual(release.offload, { upstream: "@payloadcms/graphql@4.0.0-beta.2" });
    assert.deepEqual(release.dependencies, {
      "@payloadcms/ui": "npm:@adirishi/offload-ui@4.0.0-beta.2-offload.3",
      "graphql-scalars": "1.22.2",
    });
    assert.deepEqual(release.peerDependencies, {
      graphql: "^16.8.1",
      payload: "4.0.0-beta.2-offload.3",
    });
  });

  test("keeps Offload's own package name and identity", () => {
    const release = releaseManifest(
      {
        name: "@adirishi/offload-cloudflare",
        version: "0.0.0",
        description: "Run Offload on Cloudflare Workers",
        peerDependencies: { payload: "4.0.0-beta.2", vite: "^8.0.0" },
      },
      { upstreamNames, version },
    );

    assert.equal(release.name, "@adirishi/offload-cloudflare");
    assert.equal(release.description, "Run Offload on Cloudflare Workers");
    assert.equal(release.offload, undefined);
    assert.deepEqual(release.peerDependencies, {
      payload: "4.0.0-beta.2-offload.3",
      vite: "^8.0.0",
    });
  });
});

test("withOffloadVersion moves every Offload dependency of a site and nothing else", () => {
  const site = withOffloadVersion(
    {
      name: "site",
      version: "0.0.0",
      dependencies: {
        "@adirishi/offload-cloudflare": "4.0.0-beta.2-offload.2",
        "@payloadcms/ui": "npm:@adirishi/offload-ui@4.0.0-beta.2-offload.2",
        payload: "npm:@adirishi/offload-payload@4.0.0-beta.2-offload.2",
        react: "19.3.1",
      },
      devDependencies: { vite: "8.3.4" },
    },
    version,
  );

  assert.deepEqual(site.dependencies, {
    "@adirishi/offload-cloudflare": "4.0.0-beta.2-offload.3",
    "@payloadcms/ui": "npm:@adirishi/offload-ui@4.0.0-beta.2-offload.3",
    payload: "npm:@adirishi/offload-payload@4.0.0-beta.2-offload.3",
    react: "19.3.1",
  });
  assert.deepEqual(site.devDependencies, { vite: "8.3.4" });
});
