import * as migration_20261018_135142_initial from './20261018_135142_initial';
import * as migration_20261019_090252_media_variants from './20261019_090252_media_variants';

export const migrations = [
  {
    up: migration_20261018_135142_initial.up,
    down: migration_20261018_135142_initial.down,
    name: '20261018_135142_initial',
  },
  {
    up: migration_20261019_090252_media_variants.up,
    down: migration_20261019_090252_media_variants.down,
    name: '20261019_090252_media_variants'
  },
];
