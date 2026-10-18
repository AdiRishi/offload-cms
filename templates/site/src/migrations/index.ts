import * as migration_20261018_095738_initial from './20261018_095738_initial';

export const migrations = [
  {
    up: migration_20261018_095738_initial.up,
    down: migration_20261018_095738_initial.down,
    name: '20261018_095738_initial',
  },
];
