# Technical documentation

## Overview

```
 ┌───────────────────────────┐         HTTPS (REST, RPC, Storage)          ┌──────────────────────────────┐
 │  React Native app (Expo)  │ ───────────────────────────────────────────▶ │ Supabase                     │
 │                           │                                             │  • Postgres + row-level      │
 │  Expo Router screens      │ ◀──── WebSocket (Realtime: messages, calls) ─│    security + RPC functions  │
 │  Supabase JS client       │                                             │  • Auth (email + password)   │
 │  LiveKit React Native SDK │ ── POST /functions/v1/livekit-token ───────▶ │  • Storage (listing photos)  │
 │  Leaflet map in WebView   │ ◀─────────────── { serverUrl, token } ────── │  • Edge Function (Deno)      │
 └────────────┬──────────────┘                                             └──────────────────────────────┘
              │ WebRTC audio/video (SRTP over UDP, TURN fallback)
              ▼
 ┌───────────────────────────┐
 │ LiveKit Cloud (SFU)       │
 └───────────────────────────┘
```

The app talks to Supabase for everything except call media. Supabase is the backend: Postgres holds the data and enforces who can do what with row-level security (RLS). Multi-step operations run as SQL functions, Realtime pushes new messages and call state changes, Storage holds photos, and a small Edge Function issues LiveKit tokens. LiveKit carries the audio and video.

## Main technical decisions

| Decision | Why |
|---|---|
| **Supabase instead of a custom API server** | Auth, Postgres, file storage and realtime subscriptions are the four things this app needs, and Supabase provides all four. Writing them by hand would have used most of the 5 days. Authorization lives in the database (RLS), so the rules hold for every client and cannot be bypassed by calling the API directly. |
| **LiveKit for calls** | Peer-to-peer WebRTC needs a signalling server plus STUN/TURN servers; without TURN, calls fail on many mobile networks (carrier-grade NAT). LiveKit is an SFU with TURN built in, scales from 1:1 calls to meeting rooms with the same code, and has a maintained React Native SDK. |
| **Call signalling through Postgres + Realtime** | A call is a row in `calls` (`ringing → accepted/rejected/missed/cancelled → ended`). Changing state goes through SQL functions that check who is allowed to make the change. Both phones subscribe to the row, so ringing, answering and hanging up are seen instantly. The call log comes from the same table at no extra cost. |
| **Tokens only after the call is answered** | The Edge Function gives the callee a LiveKit token only when the call row is `accepted`, and only to its two participants. Knowing a room name is not enough to join someone's call. |
| **Leaflet + OpenStreetMap in a WebView** | No Google Maps API key or billing account needed, works the same on Android and iOS, and supports tap-to-place pins and price markers. A satellite layer (Esri World Imagery) helps buyers judge a plot's surroundings. |
| **Expo with a development build** | Expo gives TypeScript, file-based routing and config plugins for camera, location and LiveKit permissions. LiveKit's native WebRTC module rules out Expo Go, so the app is built as a normal APK. |

## Data model

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | Public profile: name, role, city, bio, avatar, call permission | Created by a trigger on sign-up. Users can update only the name, bio, city, avatar and call setting (column-level grants), so the role cannot be changed. |
| `profile_private` | Phone number | Readable and editable only by its owner. |
| `listings` | Title, price, area and unit, land type, address, city, latitude/longitude, status | `active`, `sold` or `archived`. Others see only `active` listings. |
| `listing_images` | Photo path and order | Files live in the public `listing-images` bucket under `<owner id>/<listing id>/`. |
| `conversations` | `direct` (one per pair of users, enforced by a unique `direct_key`) or `meeting` (titled group room) | Can reference the listing that started it. |
| `conversation_members` | Membership and `last_read_at` | Unread counts are computed from `last_read_at`. |
| `messages` | Text messages | Inserting one updates the conversation's `last_message_at` through a trigger. |
| `calls` | Caller, callee, `audio` or `video`, status, timestamps | Drives ringing, the call screen and the call log. |
| `blocks` | Blocker → blocked | Checked in both directions for messages and calls. |

## Authorization (row-level security)

Every table has RLS enabled, and the anonymous role gets nothing.

- **Listings:**
  - Insert requires `owner_id = auth.uid()` and a seller or broker role (`can_manage_listings()`).
  - Update and delete require ownership plus that role.
  - Buyers are refused by the database even if the UI is bypassed.
- **Listing photos:** Storage policies allow uploads only into the uploader's own folder, and only for sellers and brokers.
- **Conversations and messages:** visible only to members (`is_member()`). Sending in a direct chat is refused if either side has blocked the other.
- **Calls:** visible only to the caller and callee. Rows cannot be inserted or updated directly. Instead:
  - `start_call` checks blocks, the callee's call permission (everyone, contacts or nobody) and whether either user is already on a call.
  - `respond_to_call` can be used only by the callee, and only while the call is ringing.
  - `finish_call` works for either participant. It works out whether the call ended, was cancelled, was rejected or was missed.
- **Meeting rooms:** created through `create_meeting_room`. Only the creator can add members; anyone can leave.
- **Helper functions** (`my_role`, `is_member`, `is_blocked_between`) are `SECURITY DEFINER` with an empty `search_path`, so policies can use them without recursion or search-path injection.

`scripts/rls.test.mjs` checks these rules as real users: buyer, seller, broker and an outsider (19 tests). `scripts/token.test.mjs` checks the token function (3 tests).

## Call flow

```
Caller app                    Postgres / Realtime                 Callee app
──────────                    ───────────────────                 ──────────
rpc start_call(callee, kind) ─▶ calls row: ringing ──INSERT event──▶ full-screen incoming call, vibration
show "Ringing…" (45 s timeout)                                       Accept → rpc respond_to_call(true)
                    ◀──UPDATE event── status: accepted ──────────────
POST livekit-token {callId}                                          POST livekit-token {callId}
connect to LiveKit room call-<id>  ◀════ WebRTC audio/video ════▶  connect to the same room
End → rpc finish_call ────────▶ status: ended ──UPDATE event──────▶ leaves the room, call log updated
```

If nobody answers within 45 seconds, the caller's app marks the call `missed`. The server also treats stale `ringing` rows as missed, so a crashed client cannot leave a phantom call. When the app returns to the foreground, it checks for a call that is still ringing, so an incoming call is not lost while the app is in the background.

During a call, the app uses LiveKit's `AudioSession`:
- Video calls default to the loudspeaker and voice calls to the earpiece, with a toggle.
- Mute and camera on/off call `setMicrophoneEnabled` and `setCameraEnabled`.
- The camera flip restarts the local video track with the other `facingMode`.

Meeting rooms use the same screen in a grid layout with a token for room `meeting-<conversation id>`.

## Mobile app structure

- **`src/app/`** holds the Expo Router routes:
  - `(auth)` covers sign-in and sign-up.
  - `(app)/(tabs)` holds the five tabs: Community, Map, Chats, Calls and You.
  - `(app)/listing`, `chat`, `call`, `meeting`, `user` and `settings` are the stack screens.
- **Access control:** `Stack.Protected` guards keep signed-out users on the auth screens.
- **`AuthProvider`** keeps the Supabase session (persisted in AsyncStorage, refreshed while the app is in the foreground) and the current profile.
- **`CallProvider`** subscribes to incoming calls for the signed-in user, shows the incoming-call sheet and exposes `startCall()`.
- **`hooks/useCallMedia.ts`** requests microphone and camera permission, configures the audio session and fetches the LiveKit token.
- **`components/CallStage.tsx`** is the in-call UI for 1:1 calls and meeting rooms.
- **`components/LandMap.tsx`** is the Leaflet map in a WebView. React Native sends it pins with `injectJavaScript`, and it reports taps back through `postMessage`.
- **Photos** are resized to 1440 px wide JPEG at about 70% quality before upload. A 12 MP phone photo shrinks from about 4 MB to about 250 KB.

## Challenges and how they were handled

- **NAT traversal for calls.** Mobile networks often block direct peer-to-peer media. Using an SFU with built-in TURN (LiveKit) avoids running and tuning a TURN server.
- **Keeping ringing state consistent** when an app crashes, loses its network or is closed. Call state lives in one row that only server-side functions change, with timeouts enforced on both the client and the server.
- **Authorization that cannot be bypassed.** All rules live in Postgres RLS and SQL functions, and are tested with real user sessions rather than only in the UI.
- **Maps without API keys.** Leaflet in a WebView with a small message bridge, instead of a native map SDK that needs a Google Cloud billing account. CARTO's free tiles started demanding an API key during testing, so the map now uses OpenStreetMap's own tiles and Esri imagery, which don't need a key.
- **Uploading images from React Native.** `fetch(file://)` does not reliably produce binary bodies, so images are compressed to base64 with `expo-image-manipulator` and uploaded as an `ArrayBuffer`.

## What I would do next

- **Ring a locked phone:** push notifications (FCM) and native call UI (ConnectionService/CallKit through `react-native-callkeep`).
- **Richer chat:** sending photos and documents (title deeds, encumbrance certificates), and per-message delivery and read receipts.
- **Verification:** verified-owner badges, document checks and listing reports and moderation.
- **Search:** server-side geographic search (PostGIS) with a radius filter, and a "listings in this map area" view.
- **Tests:** end-to-end tests with Maestro covering sign-up, posting a listing and placing a call.
