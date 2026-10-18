# D1 atomicity

Status: design note, no patch yet.

## The problem

D1 has no interactive transactions, so `@payloadcms/db-d1-sqlite` makes `beginTransaction` a no-op and every statement commits on its own. Payload writes one document as many statements. `upsertRow` in `@payloadcms/drizzle` runs these steps in order:

1. Insert or update the main row.
2. Delete and reinsert locale rows, relationship rows, block rows and their locale rows, array rows (recursively), and hasMany select rows.
3. Read the document back.

An operation also writes a version row, and may update locked-document and job rows. If the Worker fails partway through, the document is left half-written. Upstream has reports of exactly this:

- array data lost between the delete and the insert ([#15219](https://github.com/payloadcms/payload/issues/15219))
- duplicate `latest` version rows under autosave ([#17216](https://github.com/payloadcms/payload/issues/17216))

A Postgres operation also rolls back when an `afterChange` hook throws. On D1 the rows are already written by then.

## Why a plain `db.batch()` is not enough

D1's `batch()` runs a list of statements in one implicit transaction, but each statement must be built before the batch is sent. `upsertRow` can't build its statements up front, for two reasons:

- In version tables, array and block rows have `serial` IDs. Their original ID moves to `_uuid` (`packages/drizzle/src/schema/idToUUID.ts`). Child rows such as block locales, nested arrays and hasMany selects need the parent's generated ID, which `upsertRow` reads back from each insert (`arraysBlocksUUIDMap`).
- On create, the main row's ID comes from the insert too, when `idType` is `number`, which is the default.

## Proposed patch

Compile each document write into one batch in which child rows find their parents with subqueries on stable keys, instead of with IDs returned to JavaScript:

- Array and block rows already carry a client-generated key: `id` in main tables, `_uuid` in version tables. A child insert can then use `(SELECT id FROM <parent_table> WHERE _uuid = ? AND _parent_id = <root>)` for its foreign key.
- On create, generate the main row's ID before the batch, or switch D1 collections to text IDs, which removes the dependency.
- Read the document back after the batch, as today.

The patch belongs in `@payloadcms/drizzle`, behind an adapter capability such as `supportsBatchWrites`, so Postgres and SQLite keep their current path. It makes each document write atomic. It cannot make a whole operation atomic: the version row, the main row and hook side effects are separate writes. The next step after that is to batch the main and version writes of `create` and `update` together.

Estimated effort: one to two weeks including tests. The test suite needs a D1 run of the existing `test/database` and `test/versions` integration tests through `getPlatformProxy`, which the repo already uses for its D1 tests.

## Until then

- Keep versions enabled on content collections, so a half-written document can be restored from its last version.
- Treat `afterChange` hooks as unable to roll back the write.
- For commerce, prefer Postgres through Hyperdrive, or add a reconciliation job for transactions left in `processing`.
