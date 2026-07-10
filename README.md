# meridian-tasks-api

Internal task API. Run with npm run dev.

## OpenWiki workflow

The `OpenWiki Update` GitHub Actions workflow updates repository docs under
`openwiki/`. It runs only when manually triggered with `workflow_dispatch` in
`.github/workflows/openwiki-update.yml`.

## How To Run OpenWiki

From a local checkout:

1. Install the CLI.
```bash
npm install -g openwiki
```

2. Initialize repo docs the first time.
```bash
openwiki code --init
```

3. Follow the setup prompts.
The current flow asks for:
```text
provider
API key
model
```
Choose a model provider such as OpenRouter or Anthropic, paste the provider key, then use a preset or enter a custom model ID.

4. Run updates after code changes.
```bash
openwiki code --update
```

5. If you want a one-shot run for CI or scripted use, include `--print`.
```bash
openwiki code --update --print "Update only repository documentation under openwiki/. Do not edit AGENTS.md or .github workflows. Refresh the wiki from the current repository source, including rate limits in src/middleware/rateLimit.ts."
```

6. Review the generated docs in `openwiki/`.

7. Commit the docs or let the GitHub Action create the `openwiki/update` branch.
The action:
1. Checks out `main`
2. Installs `openwiki`
3. Runs the same `openwiki code --update --print` command
4. Keeps only changes under `openwiki/`
5. Opens or updates the `openwiki/update` branch and pull request

The workflow intentionally does not run on every push to `main`. This avoids a
loop where merging an OpenWiki PR immediately triggers another OpenWiki update.

Repository setting required for PR creation:

1. Go to `Settings` > `Actions` > `General`.
2. Under `Workflow permissions`, choose `Read and write permissions`.
3. Enable `Allow GitHub Actions to create and approve pull requests`.
4. Save the settings.
