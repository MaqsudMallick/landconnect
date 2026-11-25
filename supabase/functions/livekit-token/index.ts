import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TokenRequest = { callId?: string; conversationId?: string };

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `${name} is not configured`);
  return value;
}

async function resolveRoom(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  request: TokenRequest,
) {
  if (request.callId) {
    const { data: call, error } = await supabase
      .from("calls")
      .select("id, caller_id, status")
      .eq("id", request.callId)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!call) throw new HttpError(404, "Call not found");
    const callerWaiting = call.status === "ringing" && call.caller_id === userId;
    if (call.status !== "accepted" && !callerWaiting) {
      throw new HttpError(409, `Call is ${call.status}`);
    }
    return `call-${call.id}`;
  }

  if (request.conversationId) {
    const { data: room, error } = await supabase
      .from("conversations")
      .select("id, kind")
      .eq("id", request.conversationId)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!room) throw new HttpError(404, "Meeting room not found");
    if (room.kind !== "meeting") throw new HttpError(400, "Only meeting rooms have group calls");
    return `meeting-${room.id}`;
  }

  throw new HttpError(400, "Send a callId or a conversationId");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const apiKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!accessToken) throw new HttpError(401, "Missing access token");

    const supabase = createClient(requiredEnv("SUPABASE_URL"), apiKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) throw new HttpError(401, "Invalid or expired session");
    const userId = userData.user.id;

    const request = (await req.json().catch(() => ({}))) as TokenRequest;
    const room = await resolveRoom(supabase, userId, request);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .single();

    const token = new AccessToken(requiredEnv("LIVEKIT_API_KEY"), requiredEnv("LIVEKIT_API_SECRET"), {
      identity: userId,
      name: profile?.full_name ?? "LandConnect user",
      metadata: JSON.stringify({ role: profile?.role ?? null }),
      ttl: "2h",
    });
    token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });

    return json(200, { room, serverUrl: requiredEnv("LIVEKIT_URL"), token: await token.toJwt() });
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    console.error(error);
    return json(500, { error: "Could not create a call token" });
  }
});
