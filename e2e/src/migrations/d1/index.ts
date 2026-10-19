import * as migration_20261018_135140_initial from './20261018_135140_initial';
import * as migration_20261019_090245_media_variants from './20261019_090245_media_variants';
import * as migration_20261019_131201_pull_quote_block from './20261019_131201_pull_quote_block';
import * as migration_20261019_132349_form_blocks from './20261019_132349_form_blocks';

export const migrations = [
  {
    up: migration_20261018_135140_initial.up,
    down: migration_20261018_135140_initial.down,
    name: '20261018_135140_initial',
  },
  {
    up: migration_20261019_090245_media_variants.up,
    down: migration_20261019_090245_media_variants.down,
    name: '20261019_090245_media_variants',
  },
  {
    up: migration_20261019_131201_pull_quote_block.up,
    down: migration_20261019_131201_pull_quote_block.down,
    name: '20261019_131201_pull_quote_block',
  },
  {
    up: migration_20261019_132349_form_blocks.up,
    down: migration_20261019_132349_form_blocks.down,
    name: '20261019_132349_form_blocks'
  },
];
