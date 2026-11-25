import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const runId = Date.now();

async function signUp(name, role) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `${name}.${runId}@example.test`,
    password: "test-password-123",
    options: { data: { full_name: name, role } },
  });
  if (error) throw error;
  return { client, id: data.user.id };
}

const caller = await signUp("caller", "buyer");
const callee = await signUp("callee", "seller");
const stranger = await signUp("stranger", "buyer");

function decode(jwt) {
  return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
}

test("call participants get a LiveKit token for the call room, others do not", async () => {
  const { data: call } = await caller.client.rpc("start_call", { callee: callee.id, call_type: "video" });

  const early = await callee.client.functions.invoke("livekit-token", { body: { callId: call.id } });
  assert.ok(early.error, "callee cannot join before accepting");

  const callerEarly = await caller.client.functions.invoke("livekit-token", { body: { callId: call.id } });
  assert.ifError(callerEarly.error);

  await callee.client.rpc("respond_to_call", { target_call: call.id, accept: true });
  const { data, error } = await callee.client.functions.invoke("livekit-token", { body: { callId: call.id } });
  assert.ifError(error);
  assert.equal(data.room, `call-${call.id}`);
  const claims = decode(data.token);
  assert.equal(claims.sub, callee.id);
  assert.equal(claims.video.room, `call-${call.id}`);
  assert.equal(claims.name, "callee");

  const outsider = await stranger.client.functions.invoke("livekit-token", { body: { callId: call.id } });
  assert.ok(outsider.error);

  await caller.client.rpc("finish_call", { target_call: call.id });
  const afterEnd = await caller.client.functions.invoke("livekit-token", { body: { callId: call.id } });
  assert.ok(afterEnd.error);
});

test("meeting room members get a token for the room", async () => {
  const { data: roomId } = await caller.client.rpc("create_meeting_room", { room_title: "Plot walkthrough", member_ids: [callee.id] });
  const member = await callee.client.functions.invoke("livekit-token", { body: { conversationId: roomId } });
  assert.ifError(member.error);
  assert.equal(member.data.room, `meeting-${roomId}`);
  const outsider = await stranger.client.functions.invoke("livekit-token", { body: { conversationId: roomId } });
  assert.ok(outsider.error);
});

test("requests without a session are refused", async () => {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await anon.functions.invoke("livekit-token", { body: { conversationId: "00000000-0000-0000-0000-000000000000" } });
  assert.ok(error);
});
