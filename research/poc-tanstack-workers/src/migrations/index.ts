import * as migration_20261018_085112_initial from './20261018_085112_initial';
import * as migration_20261018_091051_jobs from './20261018_091051_jobs';

export const migrations = [
  {
    up: migration_20261018_085112_initial.up,
    down: migration_20261018_085112_initial.down,
    name: '20261018_085112_initial',
  },
  {
    up: migration_20261018_091051_jobs.up,
    down: migration_20261018_091051_jobs.down,
    name: '20261018_091051_jobs'
  },
];
