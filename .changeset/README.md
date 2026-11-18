# Changesets

Each PR that changes a published `@tsviz/*` package should include a changeset:

```sh
npx changeset
```

Pick the packages that changed, choose patch/minor/major, and write a one-line
summary for the changelog. Commit the generated `.changeset/*.md` file with the PR.

To release:

1. `npm run version-packages` — bumps versions, updates internal dependency
   ranges and writes `CHANGELOG.md` files. Commit and merge to `main`.
2. Run **Actions → Publish packages** on GitHub.

See https://github.com/changesets/changesets for details.
