import config from '@payload-config'
import { createPayloadWorker } from '@arishi/offload-cloudflare/worker'
import handler from '@tanstack/react-start/server-entry'

export default createPayloadWorker({ config, handler })
