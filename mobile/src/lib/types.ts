export type UserRole = 'buyer' | 'seller' | 'broker';
export type CallPermission = 'everyone' | 'contacts' | 'nobody';
export type ListingStatus = 'active' | 'sold' | 'archived';
export type LandType = 'residential' | 'agricultural' | 'commercial' | 'industrial';
export type AreaUnit = 'sqft' | 'sqm' | 'acre' | 'cent' | 'guntha' | 'hectare';
export type CallKind = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'cancelled';
export type ConversationKind = 'direct' | 'meeting';

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  bio: string;
  city: string;
  avatar_path: string | null;
  call_permission: CallPermission;
  created_at: string;
};

export type ListingImage = {
  id: string;
  listing_id: string;
  storage_path: string;
  position: number;
};

export type Listing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  price: number;
  area: number | null;
  area_unit: AreaUnit;
  land_type: LandType;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  listing_images?: ListingImage[];
  owner?: Pick<Profile, 'id' | 'full_name' | 'role' | 'avatar_path'>;
};

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  listing_id: string | null;
  listing_title: string | null;
  other_user_id: string | null;
  other_user_name: string | null;
  other_user_role: UserRole | null;
  other_user_avatar: string | null;
  member_count: number;
  last_message: string | null;
  last_message_at: string;
  last_sender_id: string | null;
  unread_count: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  listing_id: string | null;
  created_at: string;
};

export type Call = {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  kind: CallKind;
  status: CallStatus;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
};

export type CallHistoryEntry = {
  id: string;
  kind: CallKind;
  status: CallStatus;
  outgoing: boolean;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
};

export type LiveKitGrant = {
  room: string;
  serverUrl: string;
  token: string;
};
