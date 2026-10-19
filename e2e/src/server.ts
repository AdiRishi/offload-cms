import { createPayloadWorker } from "@adirishi/offload-cloudflare/worker";
import handler from "@tanstack/react-start/server-entry";

export default createPayloadWorker({ handler });
