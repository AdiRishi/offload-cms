import { latestRelease, offloadVersion } from "@repo/upstream";

/**
 * The Offload release the docs and the registry describe. Before the first release on a new
 * Payload tag, it is the version that release gets.
 */
export const version = latestRelease()?.version ?? offloadVersion(0);
