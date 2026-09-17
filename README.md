# Where Winds Meet Code Monitor

This project monitors Where Winds Meet redemption codes with GitHub Actions, a GitHub Issue, a Discord Webhook, and a Cloudflare Worker.

The automatic scanner uses [codes.yar.gg](https://codes.yar.gg/). It no longer scans Bahamut, PC Gamer, or Arlen.

## Features

- Reads the site's public active and confirmed-expired code lists every six hours.
- Compares codes with the state stored in a GitHub Issue.
- Posts only newly discovered active codes to Discord. Known codes are not posted again.
- Removes codes marked as confirmed expired by the site from the Issue state. A player's personal "used" marker does not mean a code is expired.
- Establishes a baseline on the first scan after switching sources, so the site's existing codes are not all announced at once.
- Accepts player reports through the Discord `/report` command. Reports use the same stored-code check before any announcement.

The source is community-maintained. A code listed as active has not necessarily been verified with your game account. If the source cannot be read or its format changes, that scan fails without clearing the stored state.

## How It Works

Automatic scan:

```text
codes.yar.gg active and confirmed-expired lists
GitHub Actions
GitHub Issue state
Discord Webhook announcement
```

Player report:

```text
Discord /report
Cloudflare Worker
GitHub Actions manual_codes input
GitHub Issue comparison
Discord Webhook announcement
```

## GitHub Issue State

The workflow creates or updates an Issue titled:

```text
[WWM Monitor] State - do not edit
```

The Issue records known active codes. Do not edit its JSON unless you understand the state format.

## Setup

In the repository's `Settings` -> `Environments`, create an environment named:

```text
discord-production
```

Add an environment secret named `DISCORD_WEBHOOK_URL` and set its value to your Discord channel's Webhook URL. Keep GitHub Actions and the `Scan WWM redemption codes` workflow enabled for scheduled scans and player reports.

## Add Codes Manually

In GitHub, open:

```text
Actions -> Scan WWM redemption codes -> Run workflow
```

Paste one or more codes into `manual_codes`, with one code per line if preferred. New codes are saved to the Issue and announced in Discord; known codes are not announced again.

## Discord `/report`

The Cloudflare Worker in `discord-report-worker/` handles the Discord `/report` command. Players enter suspected new codes in its `codes` field. The Worker starts the GitHub Actions workflow with the `manual_codes` input, and the workflow checks the Issue before posting to Discord.

See `discord-report-worker/README.md` for Worker setup.

## Schedule

The workflow runs every six hours:

```yaml
cron: "17 0,6,12,18 * * *"
```

GitHub Actions interprets this schedule in UTC, which is eight hours behind Taiwan time.

## Security

Never commit a Discord Webhook URL, Discord Bot Token, GitHub Token, `.env` file, API key, or other secret. Store secrets in GitHub Secrets or Cloudflare Worker Secrets. Rotate any token or Webhook URL that has been exposed.

## License

MIT License
