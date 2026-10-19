import * as migration_20261018_135140_initial from './20261018_135140_initial';
import * as migration_20261019_132349_form_blocks from './20261019_132349_form_blocks';

export const migrations = [
  {
    up: migration_20261018_135140_initial.up,
    down: migration_20261018_135140_initial.down,
    name: '20261018_135140_initial',
  },
  {
    up: migration_20261019_132349_form_blocks.up,
    down: migration_20261019_132349_form_blocks.down,
    name: '20261019_132349_form_blocks'
  },
];
