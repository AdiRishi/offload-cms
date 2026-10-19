import * as migration_20261018_135140_initial from './20261018_135140_initial';

export const migrations = [
  {
    up: migration_20261018_135140_initial.up,
    down: migration_20261018_135140_initial.down,
    name: '20261018_135140_initial'
  },
];
