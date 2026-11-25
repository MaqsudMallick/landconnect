# LandConnect

A prototype land marketplace for buyers, sellers and brokers, with a chat-first interface. Users browse land listings on a feed and a map, message the owner, and talk to them over in-app voice and video calls without ever sharing a phone number. Groups can meet in meeting rooms with chat and a group video call.

| | |
|---|---|
| Mobile app | React Native (Expo SDK 58, Expo Router), TypeScript |
| Backend | Supabase: PostgreSQL with row-level security, Auth, Storage, Realtime, one Edge Function |
| Calls | LiveKit (WebRTC SFU) through `@livekit/react-native` |
| Maps | Leaflet inside a WebView, with OpenStreetMap streets and Esri satellite imagery, no API key needed |

Technical documentation: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). AI tools used: [docs/AI_USAGE.md](docs/AI_USAGE.md).

## Demo

- **Video (4.5 minutes):** [watch in the browser](https://maqsudmallick.github.io/landconnect/) or [download landconnect-demo.mp4](https://github.com/MaqsudMallick/landconnect/releases/latest/download/landconnect-demo.mp4). Two Android emulators side by side, a buyer and a seller: browsing, the map, chat, video and voice calls (accept, decline, cancel, hang up), the call log, posting a listing, a meeting room and the privacy settings.
- **Android app:** [LandConnect.apk](https://github.com/MaqsudMallick/landconnect/releases/latest/download/LandConnect.apk) (phones and emulators). It connects to a hosted backend (Supabase and LiveKit Cloud), so you can install it and sign in with the demo accounts below. To use your own backend instead, tap **Server** on the sign-in screen.

## Features

- **Accounts and roles.** Email sign-up with a Buyer, Seller or Broker role. The role is fixed after sign-up and enforced by the database, not just hidden in the UI.
- **Community feed.** Listings with photos, price, area, land type and location, plus search and land-type filters.
- **Listing management.** Sellers and brokers post, edit, mark as sold, hide and delete their own listings. Each listing can have up to 8 photos (gallery or camera, compressed on the device). Location is set by tapping the map or with the phone's GPS, and the address is filled in by reverse geocoding.
- **Map.** Every active listing is shown as a price pin, on a street map or satellite imagery. Tapping a pin opens a preview card, and the listing page has its own map and an "Open in maps" link.
- **Messaging.** One-to-one chats, started from a listing (the listing is pinned at the top of the chat), with live updates, unread counts and read tracking.
- **Meeting rooms.** Named group rooms with invited members, group chat, and a group video call. The creator can add people and members can leave.
- **Audio and video calls (the key requirement).**
  - Start a voice or video call from a listing, a chat, a profile or the call log.
  - The other person gets a full-screen incoming call with Accept and Decline.
  - The caller can cancel while it rings; calls nobody answers become "missed" after 45 seconds.
  - Either side can hang up.
  - During a call: mute, camera on or off, front/back camera, speaker or earpiece, and a call timer.
  - A call log shows incoming and outgoing calls, missed and declined ones, and their duration, with call-back buttons.
  - "Busy" is detected: you cannot call someone who is already on a call.
- **Privacy.**
  - Phone numbers live in a private table that only their owner can read.
  - Each user chooses who can call them: everyone, only people they have replied to, or nobody.
  - Blocking stops chats and calls in both directions.
  - Call media tokens are issued only to the two people in that call, and only once it is answered.

## Repository layout

```
mobile/                 Expo app (TypeScript)
  src/app/              Screens (Expo Router file-based routes)
  src/components/       UI building blocks (map, call stage, cards…)
  src/providers/        Backend selection, auth session and incoming-call handling
  src/hooks/            Data and call-media hooks
  src/lib/              Supabase client, types, formatting, image upload
supabase/
  migrations/           Database schema, row-level security, RPC functions, storage buckets
  functions/livekit-token/   Edge Function that issues LiveKit tokens
scripts/
  rls.test.mjs          19 tests for roles, privacy and access rules against a running Supabase
  token.test.mjs        Tests for the call-token function
  seed.mjs              Demo users, listings with photos and a sample chat
docs/                   Architecture notes and AI usage summary
```

## Demo accounts

These accounts exist on the hosted backend, and `node scripts/seed.mjs` creates them on your own. The password for all three is `LandConnect@2026`.

| Role | Email |
|---|---|
| Buyer | buyer@landconnect.demo |
| Seller | seller@landconnect.demo |
| Broker | broker@landconnect.demo |

To try a call, sign in as two different users on two phones (or a phone and an emulator).

## Running it locally

Prerequisites: Node 20 or later, Docker, the Android SDK with Java 17, and an Android phone with USB debugging or an emulator.

1. **Start Supabase locally.** This applies the migration automatically:
   ```bash
   npx supabase start
   ```
2. **Start a LiveKit server for calls** in development mode. Its API key is `devkey` and its secret is `secret`:
   ```bash
   docker run -d --name livekit -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
     livekit/livekit-server --dev --bind 0.0.0.0 --node-ip <your LAN IP>
   ```
3. **Serve the token function.** Create `supabase/functions/.env`:
   ```
   LIVEKIT_URL=ws://<your LAN IP>:7880
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret
   ```
   Then run:
   ```bash
   npx supabase functions serve --env-file supabase/functions/.env
   ```
4. **Seed demo data and run the tests.** The URL and keys come from `npx supabase status`:
   ```bash
   cd scripts && npm install
   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... node seed.mjs
   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... node --test rls.test.mjs token.test.mjs
   ```
5. **Run the app.** Create `mobile/.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=http://<your LAN IP>:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   Then:
   ```bash
   cd mobile && npm install
   npx expo run:android
   ```
   LiveKit needs native code, so the app does not run in Expo Go. `expo run:android` builds a development build.
6. **Or use the released APK against your backend.** On the sign-in screen, tap **Server** and enter `http://<your LAN IP>:54321` and the anon key. The app checks that the server answers before saving, and no rebuild is needed. An Android emulator on the same computer can use `http://10.0.2.2:54321`.

## Deploying the backend (Supabase cloud and LiveKit Cloud)

1. **Create the services.** Create a Supabase project and a LiveKit Cloud project; both have free tiers.
2. **Push the schema:**
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. **Add the LiveKit settings and deploy the function:**
   ```bash
   npx supabase secrets set LIVEKIT_URL=wss://<project>.livekit.cloud LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
   npx supabase functions deploy livekit-token --no-verify-jwt
   ```
   The function checks the caller's Supabase session itself, so gateway JWT verification is turned off.
4. **Turn off email confirmation** under Authentication → Providers → Email, so test accounts work straight away. This is optional.
5. **Seed the demo data** with the cloud URL and service role key: `node scripts/seed.mjs`.

## Building the APK

```bash
cd mobile
printf 'EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>\n' > .env.local
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

The APK is written to `mobile/android/app/build/outputs/apk/release/app-release.apk`. It is signed with the debug key, which is fine for sideloading a prototype.

## Known limitations

- **Incoming calls only ring while the app is open.** It can be in the foreground, or the call is picked up as soon as the app is opened within 45 seconds. Ringing a locked phone needs push notifications (FCM) and Android's ConnectionService (for example `react-native-callkeep`); that is the next step.
- **No email verification or password reset screens.** The prototype assumes email confirmation is off.
- **The server can only be changed while signed out,** from the sign-in screen.
- **Message delivery and read receipts are per conversation,** not per message.
- **Photos are public URLs.** Listings are public anyway; nothing private is stored in Storage.
