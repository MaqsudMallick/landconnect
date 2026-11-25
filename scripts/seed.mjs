import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD ?? "LandConnect@2026";
if (!url || !serviceKey) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const people = [
  { key: "buyer", email: "buyer@landconnect.demo", full_name: "Asha Rao", role: "buyer", city: "Bengaluru", bio: "Looking for a residential plot in east Bengaluru." },
  { key: "seller", email: "seller@landconnect.demo", full_name: "Ravi Kumar", role: "seller", city: "Bengaluru", bio: "Selling family land with clear titles." },
  { key: "broker", email: "broker@landconnect.demo", full_name: "Meera Shetty", role: "broker", city: "Bengaluru", bio: "Land broker covering north and south Bengaluru for 9 years." },
];

const listings = [
  {
    owner: "seller", image: "whitefield-plot", title: "East-facing 30x40 plot near Whitefield", price: 6800000, area: 1200, area_unit: "sqft",
    land_type: "residential", city: "Bengaluru", address: "Kadugodi, near Whitefield railway station", latitude: 12.9958, longitude: 77.7605,
    description: "BMRDA-approved layout, 40 ft road, water and power at the gate. A-khata, ready for registration.",
  },
  {
    owner: "seller", image: "sarjapur-plot", title: "Corner plot in gated layout, Sarjapur Road", price: 9200000, area: 1500, area_unit: "sqft",
    land_type: "residential", city: "Bengaluru", address: "Dommasandra, Sarjapur Road", latitude: 12.8826, longitude: 77.7547,
    description: "Corner site with two road frontages, compound wall done. 10 minutes to Wipro SEZ.",
  },
  {
    owner: "broker", image: "devanahalli-farm", title: "2 acre farm land near Devanahalli", price: 18000000, area: 2, area_unit: "acre",
    land_type: "agricultural", city: "Devanahalli", address: "Off NH 44, 6 km from Kempegowda airport", latitude: 13.2437, longitude: 77.7129,
    description: "Red soil with a borewell and mango trees. Converted to agricultural use, clear RTC.",
  },
  {
    owner: "broker", image: "kanakapura-acreage", title: "5 acres with stream frontage, Kanakapura", price: 22500000, area: 5, area_unit: "acre",
    land_type: "agricultural", city: "Kanakapura", address: "Harohalli hobli, Kanakapura Road", latitude: 12.6821, longitude: 77.4755,
    description: "Gentle slope towards a seasonal stream, good for a farmhouse or plantation.",
  },
  {
    owner: "broker", image: "hosur-road-commercial", title: "Commercial land on Hosur Road", price: 48000000, area: 8000, area_unit: "sqft",
    land_type: "commercial", city: "Bengaluru", address: "Bommasandra, Hosur Road", latitude: 12.8155, longitude: 77.6957,
    description: "Main road frontage of 80 ft, suitable for a showroom or warehouse. Commercial conversion done.",
  },
  {
    owner: "seller", image: "bidadi-industrial", title: "Industrial plot in Bidadi KIADB area", price: 31000000, area: 1, area_unit: "acre",
    land_type: "industrial", city: "Bidadi", address: "KIADB Industrial Area, Bidadi", latitude: 12.7975, longitude: 77.3897,
    description: "KIADB allotted plot with 3-phase power and water connection, 100 ft internal road.",
  },
];

async function ensureUser(person) {
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing.users.find((user) => user.email === person.email);
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({
    email: person.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: person.full_name, role: person.role, city: person.city },
  });
  if (error) throw error;
  return data.user.id;
}

const ids = {};
for (const person of people) {
  ids[person.key] = await ensureUser(person);
  await admin.from("profiles").update({ bio: person.bio, city: person.city }).eq("id", ids[person.key]);
}

const ownerIds = Object.values(ids);
const { data: oldImages } = await admin.from("listing_images").select("storage_path, listings!inner(owner_id)").in("listings.owner_id", ownerIds);
if (oldImages?.length) await admin.storage.from("listing-images").remove(oldImages.map((row) => row.storage_path));
await admin.from("listings").delete().in("owner_id", ownerIds);

let firstListingId;
for (const { owner, image, ...fields } of listings) {
  const { data: listing, error } = await admin.from("listings").insert({ ...fields, owner_id: ids[owner] }).select("id").single();
  if (error) throw error;
  firstListingId ??= listing.id;
  for (const variant of [1, 2]) {
    const path = `${ids[owner]}/${listing.id}/${image}-${variant}.jpg`;
    const bytes = await readFile(new URL(`./seed-images/${image}-${variant}.jpg`, import.meta.url));
    const upload = await admin.storage.from("listing-images").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (upload.error) throw upload.error;
    await admin.from("listing_images").insert({ listing_id: listing.id, storage_path: path, position: variant - 1 });
  }
}

const key = [ids.buyer, ids.seller].sort().join(":");
const { data: existingChat } = await admin.from("conversations").select("id").eq("direct_key", key).maybeSingle();
if (!existingChat) {
  const { data: chat } = await admin
    .from("conversations")
    .insert({ kind: "direct", direct_key: key, listing_id: firstListingId, created_by: ids.buyer })
    .select("id")
    .single();
  await admin.from("conversation_members").insert([
    { conversation_id: chat.id, user_id: ids.buyer },
    { conversation_id: chat.id, user_id: ids.seller },
  ]);
  const start = Date.now() - 60 * 60 * 1000;
  const lines = [
    [ids.buyer, "Hi Ravi, is the Whitefield plot still available?"],
    [ids.seller, "Yes it is. The khata and EC are ready if you want to check them."],
    [ids.buyer, "Great. Can we do a quick video call so you can show me the road access?"],
  ];
  for (const [index, [sender, body]] of lines.entries()) {
    await admin.from("messages").insert({
      conversation_id: chat.id,
      sender_id: sender,
      body,
      created_at: new Date(start + index * 5 * 60 * 1000).toISOString(),
    });
  }
}

console.log(`Seeded ${people.length} demo users and ${listings.length} listings.`);
console.log(people.map((person) => `  ${person.role.padEnd(6)} ${person.email}`).join("\n"));
