# @repo/tsconfig

Shared TypeScript configuration. Every workspace package extends one of these.

| File           | For                                                                                    |
| -------------- | -------------------------------------------------------------------------------------- |
| `base.json`    | The strict settings every config shares                                                |
| `node.json`    | Scripts that Node runs directly from `.ts` source (type stripping). No emit.           |
| `library.json` | Packages built to `dist` with declarations. Set `outDir` and `rootDir` in the package. |
