# meridian-tasks-api

Internal task API. Run with npm run dev.

## OpenWiki workflow

The `OpenWiki Update` GitHub Actions workflow updates repository docs under
`openwiki/`. It runs only when manually triggered with `workflow_dispatch` in
`.github/workflows/openwiki-update.yml`.

Expected flow:

1. Run the `OpenWiki Update` workflow from the GitHub Actions UI, or wait for
   the manual dispatch.
2. The workflow updates or creates the `openwiki/update` branch.
3. The workflow opens or updates a pull request from `openwiki/update` to
   `main`.
4. Review the documentation changes and merge the PR if they look correct.

Repository setting required for PR creation:

1. Go to `Settings` > `Actions` > `General`.
2. Under `Workflow permissions`, choose `Read and write permissions`.
3. Enable `Allow GitHub Actions to create and approve pull requests`.
4. Save the settings.

The workflow intentionally does not run on every push to `main`. This avoids a
loop where merging an OpenWiki PR immediately triggers another OpenWiki update.
