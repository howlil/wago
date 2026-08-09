# Security Policy

## Supported Scope

Security fixes target the latest `main` branch and the latest published container image.

Wago stores WhatsApp auth state and app settings under the configured data directory, normally `/app/data` in Docker. Treat this data like a private key.

## Reporting a Vulnerability

Report vulnerabilities through GitHub private security advisories when available. Do not open a public issue for credential exposure, auth bypass, request forgery, or message-sending abuse paths.

Do not include these values in public issues, discussions, screenshots, or logs:

- `backend/data/auth`
- `creds.json` or any Baileys auth file
- QR payloads or QR screenshots from a live session
- API keys, auth cookies, or bearer tokens
- full phone numbers, full JIDs, or message text
- raw production logs containing WhatsApp metadata

If logs are needed, redact secrets and mask identifiers first.

## Transport Boundary

This project uses Baileys, an unofficial WhatsApp Web client. Wago does not provide guaranteed ban prevention and does not support spam, bulk messaging, anti-detection behavior, or bypassing WhatsApp restrictions.
