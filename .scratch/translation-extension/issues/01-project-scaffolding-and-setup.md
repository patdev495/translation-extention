Status: ready-for-human

# Issue 01: Project Scaffolding & Setup

Initialize the repository with Vite, TypeScript, and the Chrome Extension Manifest V3 configuration.

## What to build

Configure the initial project workspace using Vite with TypeScript. Set up and integrate **Tailwind CSS v4** (using `@tailwindcss/vite` plugin or postcss depending on Vite build config) for extension styles. Set up the `manifest.json` file for a Chrome Extension (Manifest V3) containing basic configurations for:
- Background Service Worker
- Content Script
- Extension Action Popup

Verify that the project compiles correctly and the extension can be successfully loaded in Google Chrome under developer mode.

## Acceptance criteria

- [ ] Repository is set up with Vite and TypeScript.
- [ ] Tailwind CSS v4 is integrated and compiles with Vite.
- [ ] `manifest.json` is configured using Chrome Extension Manifest V3.
- [ ] Placeholder files for the Popup, Service Worker, and Content Script are generated and compile without errors.
- [ ] The unpacked extension can be loaded in Chrome Developer Mode and shows no errors.


## Blocked by

None - can start immediately
