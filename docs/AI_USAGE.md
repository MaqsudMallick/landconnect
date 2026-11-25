# AI tools usage

**Tool:** Claude Code (Anthropic's coding agent, running the Claude Opus model) in the terminal.

## How it contributed

- **Planning:** I discussed the build-versus-buy options with it: a custom Node or FastAPI backend against Supabase, and peer-to-peer WebRTC against an SFU. I chose a serverless Supabase backend with LiveKit for calls.
- **Code:** Claude Code wrote most of the code: the SQL schema, row-level security policies and RPC functions, the Edge Function, and the React Native screens and components.
- **Up-to-date APIs:** Expo SDK 58 and LiveKit 3.x are newer than the model's training data. It checked their current APIs by reading the installed packages' type definitions and the LiveKit docs, instead of relying on memory.
- **Testing:** it wrote and ran the automated tests that check roles, privacy and call permissions against a local Supabase (`scripts/rls.test.mjs`, `scripts/token.test.mjs`). It also wrote the seed script and the illustrations used for the demo listings.
- **Testing on Android:** it ran the app on two Android emulators, one signed in as a buyer and one as a seller, and drove them through sign-in, the feed and map, chat, video and voice calls (accept, decline, cancel while ringing, missed, hang up from either side), meeting rooms and the privacy settings. That found real bugs, which it fixed: a storage policy that stopped photo uploads, map tiles that suddenly required an API key, a button hidden under Android's navigation bar, and duplicated times in the call log.
- **Demo video:** it scripted the walkthrough on the same two emulators and recorded both screens side by side.
- **Documentation:** it drafted the README and this documentation.

## What I did

- **Requirements and priorities:** I broke the brief down, put the calling first, and chose a serverless backend (Supabase with LiveKit) over a custom server to fit the five days.
- **Ownership:** I'm responsible for the result and can explain the code and the decisions behind it.
