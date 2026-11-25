import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY");

const runId = Date.now();

async function signUp(role, name) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const email = `${name.split(" ")[0].toLowerCase()}.${runId}@example.test`;
  const { data, error } = await client.auth.signUp({
    email,
    password: "test-password-123",
    options: { data: { full_name: name, role, phone: "+91 90000 00000" } },
  });
  if (error) throw error;
  return { client, id: data.user.id };
}

const buyer = await signUp("buyer", "Bina Buyer");
const seller = await signUp("seller", "Sunil Seller");
const broker = await signUp("broker", "Bharat Broker");
const outsider = await signUp("buyer", "Olga Outsider");

const sampleListing = {
  title: "Corner plot near Whitefield",
  description: "East facing, clear title",
  price: 4500000,
  area: 1200,
  area_unit: "sqft",
  land_type: "residential",
  city: "Bengaluru",
  latitude: 12.9698,
  longitude: 77.75,
};

let listingId;
let conversationId;
let meetingId;
let callId;

test("signup creates a profile with the requested role", async () => {
  const { data } = await seller.client.from("profiles").select("role, full_name").eq("id", seller.id).single();
  assert.equal(data.role, "seller");
  assert.equal(data.full_name, "Sunil Seller");
});

test("users cannot change their own role", async () => {
  const { error } = await buyer.client.from("profiles").update({ role: "seller" }).eq("id", buyer.id);
  assert.ok(error, "role update should be rejected");
  const { data } = await buyer.client.from("profiles").select("role").eq("id", buyer.id).single();
  assert.equal(data.role, "buyer");
});

test("phone numbers are visible only to their owner", async () => {
  const own = await seller.client.from("profile_private").select("phone").eq("id", seller.id);
  assert.equal(own.data.length, 1);
  const other = await buyer.client.from("profile_private").select("phone").eq("id", seller.id);
  assert.equal(other.data.length, 0);
});

test("buyers cannot create listings", async () => {
  const { error } = await buyer.client.from("listings").insert(sampleListing);
  assert.ok(error);
});

test("sellers create listings and everyone signed in can see them", async () => {
  const { data, error } = await seller.client.from("listings").insert(sampleListing).select("id").single();
  assert.ifError(error);
  listingId = data.id;
  const seen = await buyer.client.from("listings").select("id").eq("id", listingId);
  assert.equal(seen.data.length, 1);
});

test("brokers can also create listings", async () => {
  const { error } = await broker.client.from("listings").insert({ ...sampleListing, title: "Farm land, Devanahalli" });
  assert.ifError(error);
});

test("nobody edits someone else's listing", async () => {
  const { data } = await broker.client.from("listings").update({ price: 1 }).eq("id", listingId).select("id");
  assert.equal(data.length, 0);
  const { data: current } = await seller.client.from("listings").select("price").eq("id", listingId).single();
  assert.equal(Number(current.price), 4500000);
});

test("archived listings are hidden from others but not from the owner", async () => {
  await seller.client.from("listings").update({ status: "archived" }).eq("id", listingId);
  const others = await buyer.client.from("listings").select("id").eq("id", listingId);
  assert.equal(others.data.length, 0);
  const own = await seller.client.from("listings").select("id").eq("id", listingId);
  assert.equal(own.data.length, 1);
  await seller.client.from("listings").update({ status: "active" }).eq("id", listingId);
});

test("sellers upload listing images only into their own folder", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const own = await seller.client.storage.from("listing-images").upload(`${seller.id}/${listingId}/a.png`, png, { contentType: "image/png" });
  assert.ifError(own.error);
  const foreign = await seller.client.storage.from("listing-images").upload(`${broker.id}/x.png`, png, { contentType: "image/png" });
  assert.ok(foreign.error);
  const buyerUpload = await buyer.client.storage.from("listing-images").upload(`${buyer.id}/x.png`, png, { contentType: "image/png" });
  assert.ok(buyerUpload.error);
  const row = await seller.client.from("listing_images").insert({ listing_id: listingId, storage_path: `${seller.id}/${listingId}/a.png` });
  assert.ifError(row.error);
});

test("only the owner can delete a listing photo from storage", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const path = `${seller.id}/${listingId}/to-remove.png`;
  const upload = await seller.client.storage.from("listing-images").upload(path, png, { contentType: "image/png" });
  assert.ifError(upload.error);
  const byBroker = await broker.client.storage.from("listing-images").remove([path]);
  assert.equal(byBroker.data?.length ?? 0, 0);
  const byOwner = await seller.client.storage.from("listing-images").remove([path]);
  assert.ifError(byOwner.error);
  assert.equal(byOwner.data.length, 1);
});

test("a buyer starts a chat with the seller and both see it", async () => {
  const { data, error } = await buyer.client.rpc("start_direct_conversation", { other_user: seller.id, about_listing: listingId });
  assert.ifError(error);
  conversationId = data;
  const again = await seller.client.rpc("start_direct_conversation", { other_user: buyer.id });
  assert.equal(again.data, conversationId);
  const sent = await buyer.client.from("messages").insert({ conversation_id: conversationId, body: "Is the plot still available?" });
  assert.ifError(sent.error);
  const reply = await seller.client.from("messages").insert({ conversation_id: conversationId, body: "Yes, it is." });
  assert.ifError(reply.error);
  const list = await seller.client.rpc("my_conversations");
  const row = list.data.find((c) => c.id === conversationId);
  assert.equal(row.other_user_name, "Bina Buyer");
  assert.equal(row.listing_title, sampleListing.title);
});

test("outsiders cannot read or post in other people's chats", async () => {
  const read = await outsider.client.from("messages").select("id").eq("conversation_id", conversationId);
  assert.equal(read.data.length, 0);
  const post = await outsider.client.from("messages").insert({ conversation_id: conversationId, body: "hi" });
  assert.ok(post.error);
});

test("unread counts drop when a member marks the chat read", async () => {
  await buyer.client.from("messages").insert({ conversation_id: conversationId, body: "Can we visit on Saturday?" });
  let row = (await seller.client.rpc("my_conversations")).data.find((c) => c.id === conversationId);
  assert.equal(Number(row.unread_count), 1);
  await seller.client.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", seller.id);
  row = (await seller.client.rpc("my_conversations")).data.find((c) => c.id === conversationId);
  assert.equal(Number(row.unread_count), 0);
});

test("meeting rooms include only invited members", async () => {
  const { data, error } = await broker.client.rpc("create_meeting_room", {
    room_title: "Site visit planning",
    member_ids: [buyer.id, seller.id],
    about_listing: listingId,
  });
  assert.ifError(error);
  meetingId = data;
  const members = await buyer.client.from("conversation_members").select("user_id").eq("conversation_id", meetingId);
  assert.equal(members.data.length, 3);
  const outsiderView = await outsider.client.from("conversations").select("id").eq("id", meetingId);
  assert.equal(outsiderView.data.length, 0);
  const notCreator = await buyer.client.rpc("add_meeting_members", { target_conversation: meetingId, member_ids: [outsider.id] });
  assert.ok(notCreator.error);
});

test("a call rings, is accepted and ended, and only participants see it", async () => {
  const { data, error } = await buyer.client.rpc("start_call", { callee: seller.id, call_type: "video" });
  assert.ifError(error);
  callId = data.id;
  assert.equal(data.status, "ringing");
  const busy = await broker.client.rpc("start_call", { callee: seller.id, call_type: "audio" });
  assert.match(busy.error?.message ?? "", /already on a call/);
  const callerCannotAccept = await buyer.client.rpc("respond_to_call", { target_call: callId, accept: true });
  assert.ok(callerCannotAccept.error);
  const accepted = await seller.client.rpc("respond_to_call", { target_call: callId, accept: true });
  assert.equal(accepted.data.status, "accepted");
  const seenByOutsider = await outsider.client.from("calls").select("id").eq("id", callId);
  assert.equal(seenByOutsider.data.length, 0);
  const ended = await buyer.client.rpc("finish_call", { target_call: callId });
  assert.equal(ended.data.status, "ended");
  const history = await seller.client.rpc("my_call_history");
  assert.equal(history.data[0].other_user_name, "Bina Buyer");
  assert.equal(history.data[0].outgoing, false);
});

test("a rejected call ends immediately", async () => {
  const { data } = await seller.client.rpc("start_call", { callee: buyer.id, call_type: "audio" });
  const rejected = await buyer.client.rpc("respond_to_call", { target_call: data.id, accept: false });
  assert.equal(rejected.data.status, "rejected");
});

test("call privacy settings are enforced", async () => {
  await seller.client.from("profiles").update({ call_permission: "contacts" }).eq("id", seller.id);
  const stranger = await outsider.client.rpc("start_call", { callee: seller.id, call_type: "audio" });
  assert.match(stranger.error?.message ?? "", /chatted with/);
  const contact = await buyer.client.rpc("start_call", { callee: seller.id, call_type: "audio" });
  assert.ifError(contact.error);
  await buyer.client.rpc("finish_call", { target_call: contact.data.id });
  await seller.client.from("profiles").update({ call_permission: "nobody" }).eq("id", seller.id);
  const blockedByPref = await buyer.client.rpc("start_call", { callee: seller.id, call_type: "audio" });
  assert.match(blockedByPref.error?.message ?? "", /not accepting calls/);
  await seller.client.from("profiles").update({ call_permission: "everyone" }).eq("id", seller.id);
});

test("blocking stops messages and calls in both directions", async () => {
  const block = await seller.client.from("blocks").insert({ blocked_id: buyer.id });
  assert.ifError(block.error);
  const message = await buyer.client.from("messages").insert({ conversation_id: conversationId, body: "hello?" });
  assert.ok(message.error);
  const call = await buyer.client.rpc("start_call", { callee: seller.id, call_type: "audio" });
  assert.ok(call.error);
  const reverse = await seller.client.rpc("start_call", { callee: buyer.id, call_type: "audio" });
  assert.ok(reverse.error);
  await seller.client.from("blocks").delete().eq("blocked_id", buyer.id);
  const after = await buyer.client.from("messages").insert({ conversation_id: conversationId, body: "hello again" });
  assert.ifError(after.error);
});

test("anonymous visitors see nothing", async () => {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data } = await anon.from("listings").select("id");
  assert.equal((data ?? []).length, 0);
});
