create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('buyer', 'seller', 'broker');
create type public.call_permission as enum ('everyone', 'contacts', 'nobody');
create type public.listing_status as enum ('active', 'sold', 'archived');
create type public.conversation_kind as enum ('direct', 'meeting');
create type public.call_kind as enum ('audio', 'video');
create type public.call_status as enum ('ringing', 'accepted', 'rejected', 'missed', 'ended', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  role public.user_role not null,
  bio text not null default '' check (char_length(bio) <= 280),
  city text not null default '' check (char_length(city) <= 80),
  avatar_path text,
  call_permission public.call_permission not null default 'everyone',
  created_at timestamptz not null default now()
);

create table public.profile_private (
  id uuid primary key references public.profiles on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  price numeric(14, 2) not null check (price >= 0),
  area numeric(12, 2) check (area > 0),
  area_unit text not null default 'sqft' check (area_unit in ('sqft', 'sqm', 'acre', 'cent', 'guntha', 'hectare')),
  land_type text not null default 'residential' check (land_type in ('residential', 'agricultural', 'commercial', 'industrial')),
  address text not null default '' check (char_length(address) <= 300),
  city text not null default '' check (char_length(city) <= 80),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_owner_idx on public.listings (owner_id);
create index listings_status_created_idx on public.listings (status, created_at desc);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id, position);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  title text check (title is null or char_length(title) between 1 and 80),
  listing_id uuid references public.listings on delete set null,
  direct_key text unique,
  created_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check ((kind = 'direct') = (direct_key is not null))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  listing_id uuid references public.listings on delete set null,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  caller_id uuid not null references public.profiles on delete cascade,
  callee_id uuid not null references public.profiles on delete cascade,
  kind public.call_kind not null,
  status public.call_status not null default 'ringing',
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  check (caller_id <> callee_id)
);

create index calls_caller_idx on public.calls (caller_id, created_at desc);
create index calls_callee_idx on public.calls (callee_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.can_manage_listings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_role() in ('seller', 'broker'), false)
$$;

create or replace function public.is_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = target_conversation and user_id = auth.uid()
  )
$$;

create or replace function public.is_blocked_between(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = first_user and blocked_id = second_user)
       or (blocker_id = second_user and blocked_id = first_user)
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'buyer');
begin
  if requested_role not in ('buyer', 'seller', 'broker') then
    requested_role := 'buyer';
  end if;

  insert into public.profiles (id, full_name, role, city)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    requested_role::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'city', '')
  );

  insert into public.profile_private (id, phone)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_updated_at();

create trigger profile_private_touch_updated_at
  before update on public.profile_private
  for each row execute function public.touch_updated_at();

create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;
alter table public.blocks enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profile_private from anon;
revoke all on public.listings from anon;
revoke all on public.listing_images from anon;
revoke all on public.conversations from anon;
revoke all on public.conversation_members from anon;
revoke all on public.messages from anon;
revoke all on public.calls from anon;
revoke all on public.blocks from anon;

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, bio, city, avatar_path, call_permission) on public.profiles to authenticated;

revoke insert, delete on public.profile_private from authenticated;

revoke insert, update, delete on public.conversations from authenticated;
revoke insert, delete on public.conversation_members from authenticated;
revoke update on public.conversation_members from authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
revoke update, delete on public.messages from authenticated;
revoke insert, update, delete on public.calls from authenticated;
revoke update on public.blocks from authenticated;

create policy "Signed-in users can see profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users edit their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Only the owner sees private contact details"
  on public.profile_private for select to authenticated
  using (id = auth.uid());

create policy "Only the owner edits private contact details"
  on public.profile_private for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Active listings are public to signed-in users"
  on public.listings for select to authenticated
  using (status = 'active' or owner_id = auth.uid());

create policy "Sellers and brokers create their own listings"
  on public.listings for insert to authenticated
  with check (owner_id = auth.uid() and public.can_manage_listings());

create policy "Sellers and brokers edit their own listings"
  on public.listings for update to authenticated
  using (owner_id = auth.uid() and public.can_manage_listings())
  with check (owner_id = auth.uid() and public.can_manage_listings());

create policy "Sellers and brokers delete their own listings"
  on public.listings for delete to authenticated
  using (owner_id = auth.uid() and public.can_manage_listings());

create policy "Images follow their listing's visibility"
  on public.listing_images for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "Listing owners add images"
  on public.listing_images for insert to authenticated
  with check (
    public.can_manage_listings()
    and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
    and split_part(storage_path, '/', 1) = auth.uid()::text
  );

create policy "Listing owners reorder images"
  on public.listing_images for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));

create policy "Listing owners remove images"
  on public.listing_images for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));

create policy "Members see their conversations"
  on public.conversations for select to authenticated
  using (public.is_member(id));

create policy "Members see who else is in the conversation"
  on public.conversation_members for select to authenticated
  using (public.is_member(conversation_id));

create policy "Members mark their own messages read"
  on public.conversation_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Members read messages"
  on public.messages for select to authenticated
  using (public.is_member(conversation_id));

create policy "Members send messages unless blocked"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_member(conversation_id)
    and not exists (
      select 1 from public.conversation_members other
      where other.conversation_id = messages.conversation_id
        and other.user_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), other.user_id)
        and (select c.kind from public.conversations c where c.id = messages.conversation_id) = 'direct'
    )
  );

create policy "Participants see their calls"
  on public.calls for select to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid());

create policy "Users see whom they blocked"
  on public.blocks for select to authenticated
  using (blocker_id = auth.uid());

create policy "Users block others"
  on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "Users unblock others"
  on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

create or replace function public.start_direct_conversation(other_user uuid, about_listing uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  key text;
  conversation uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if other_user is null or other_user = me then
    raise exception 'Choose someone else to message' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = other_user) then
    raise exception 'That user does not exist' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(me, other_user) then
    raise exception 'You cannot message this user' using errcode = '42501';
  end if;

  key := least(me::text, other_user::text) || ':' || greatest(me::text, other_user::text);

  select id into conversation from public.conversations where direct_key = key;

  if conversation is null then
    insert into public.conversations (kind, direct_key, listing_id, created_by)
    values ('direct', key, about_listing, me)
    on conflict (direct_key) do nothing
    returning id into conversation;

    if conversation is null then
      select id into conversation from public.conversations where direct_key = key;
    else
      insert into public.conversation_members (conversation_id, user_id)
      values (conversation, me), (conversation, other_user);
    end if;
  elsif about_listing is not null then
    update public.conversations set listing_id = about_listing where id = conversation;
  end if;

  return conversation;
end;
$$;

create or replace function public.create_meeting_room(room_title text, member_ids uuid[], about_listing uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  conversation uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(room_title, ''))) = 0 then
    raise exception 'Give the meeting room a name' using errcode = '22023';
  end if;

  insert into public.conversations (kind, title, listing_id, created_by)
  values ('meeting', btrim(room_title), about_listing, me)
  returning id into conversation;

  insert into public.conversation_members (conversation_id, user_id)
  select conversation, member
  from (select me as member union select unnest(coalesce(member_ids, '{}'))) chosen
  where exists (select 1 from public.profiles p where p.id = chosen.member)
    and (chosen.member = me or not public.is_blocked_between(me, chosen.member));

  return conversation;
end;
$$;

create or replace function public.add_meeting_members(target_conversation uuid, member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.conversations
    where id = target_conversation and kind = 'meeting' and created_by = me
  ) then
    raise exception 'Only the room creator can add people' using errcode = '42501';
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  select target_conversation, member
  from unnest(member_ids) as member
  where exists (select 1 from public.profiles p where p.id = member)
    and not public.is_blocked_between(me, member)
  on conflict do nothing;
end;
$$;

create or replace function public.leave_meeting_room(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.conversation_members
  where conversation_id = target_conversation
    and user_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = target_conversation and c.kind = 'meeting');
end;
$$;

create or replace function public.expire_stale_calls()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.calls
  set status = 'missed', ended_at = now()
  where status = 'ringing' and created_at < now() - interval '45 seconds';

  update public.calls
  set status = 'ended', ended_at = now()
  where status = 'accepted' and answered_at < now() - interval '4 hours';
$$;

create or replace function public.start_call(callee uuid, call_type public.call_kind)
returns public.calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  permission public.call_permission;
  conversation uuid;
  shares_conversation boolean;
  created public.calls;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if callee is null or callee = me then
    raise exception 'Choose someone else to call' using errcode = '22023';
  end if;

  select call_permission into permission from public.profiles where id = callee;
  if not found then
    raise exception 'That user does not exist' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(me, callee) then
    raise exception 'You cannot call this user' using errcode = '42501';
  end if;
  if permission = 'nobody' then
    raise exception 'This user is not accepting calls' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.conversations c
    where c.direct_key = least(me::text, callee::text) || ':' || greatest(me::text, callee::text)
      and exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = callee)
  ) into shares_conversation;

  if permission = 'contacts' and not shares_conversation then
    raise exception 'This user only accepts calls from people they have chatted with' using errcode = '42501';
  end if;

  perform public.expire_stale_calls();

  if exists (
    select 1 from public.calls
    where status in ('ringing', 'accepted')
      and (caller_id in (me, callee) or callee_id in (me, callee))
  ) then
    raise exception 'One of you is already on a call' using errcode = '55P03';
  end if;

  conversation := public.start_direct_conversation(callee, null);

  insert into public.calls (conversation_id, caller_id, callee_id, kind)
  values (conversation, me, callee, call_type)
  returning * into created;

  return created;
end;
$$;

create or replace function public.respond_to_call(target_call uuid, accept boolean)
returns public.calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.calls;
begin
  update public.calls
  set status = case when accept then 'accepted'::public.call_status else 'rejected'::public.call_status end,
      answered_at = case when accept then now() else null end,
      ended_at = case when accept then null else now() end
  where id = target_call
    and callee_id = auth.uid()
    and status = 'ringing'
    and created_at >= now() - interval '45 seconds'
  returning * into updated;

  if updated.id is null then
    raise exception 'This call is no longer ringing' using errcode = '55000';
  end if;

  return updated;
end;
$$;

create or replace function public.finish_call(target_call uuid)
returns public.calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated public.calls;
begin
  update public.calls
  set status = case
        when status = 'accepted' then 'ended'::public.call_status
        when status = 'ringing' and caller_id = auth.uid() and created_at < now() - interval '40 seconds' then 'missed'::public.call_status
        when status = 'ringing' and caller_id = auth.uid() then 'cancelled'::public.call_status
        else 'rejected'::public.call_status
      end,
      ended_at = now()
  where id = target_call
    and (caller_id = auth.uid() or callee_id = auth.uid())
    and status in ('ringing', 'accepted')
  returning * into updated;

  if updated.id is null then
    select * into updated from public.calls
    where id = target_call and (caller_id = auth.uid() or callee_id = auth.uid());
  end if;

  return updated;
end;
$$;

create or replace function public.my_conversations()
returns table (
  id uuid,
  kind public.conversation_kind,
  title text,
  listing_id uuid,
  listing_title text,
  other_user_id uuid,
  other_user_name text,
  other_user_role public.user_role,
  other_user_avatar text,
  member_count bigint,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.kind,
    c.title,
    c.listing_id,
    l.title,
    other.id,
    other.full_name,
    other.role,
    other.avatar_path,
    (select count(*) from public.conversation_members cm where cm.conversation_id = c.id),
    last.body,
    c.last_message_at,
    last.sender_id,
    (
      select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > mine.last_read_at
    )
  from public.conversations c
  join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = auth.uid()
  left join public.listings l on l.id = c.listing_id
  left join lateral (
    select p.id, p.full_name, p.role, p.avatar_path
    from public.conversation_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.conversation_id = c.id and cm.user_id <> auth.uid() and c.kind = 'direct'
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last on true
  order by c.last_message_at desc
$$;

create or replace function public.my_call_history()
returns table (
  id uuid,
  kind public.call_kind,
  status public.call_status,
  outgoing boolean,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  created_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.kind,
    case when c.status = 'ringing' and c.created_at < now() - interval '45 seconds' then 'missed'::public.call_status else c.status end,
    c.caller_id = auth.uid(),
    p.id,
    p.full_name,
    p.avatar_path,
    c.created_at,
    c.answered_at,
    c.ended_at
  from public.calls c
  join public.profiles p on p.id = case when c.caller_id = auth.uid() then c.callee_id else c.caller_id end
  where c.caller_id = auth.uid() or c.callee_id = auth.uid()
  order by c.created_at desc
  limit 100
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.bump_conversation_on_message() from public, anon, authenticated;
revoke execute on function public.expire_stale_calls() from public, anon, authenticated;
revoke execute on function public.start_direct_conversation(uuid, uuid) from public, anon;
revoke execute on function public.create_meeting_room(text, uuid[], uuid) from public, anon;
revoke execute on function public.add_meeting_members(uuid, uuid[]) from public, anon;
revoke execute on function public.leave_meeting_room(uuid) from public, anon;
revoke execute on function public.start_call(uuid, public.call_kind) from public, anon;
revoke execute on function public.respond_to_call(uuid, boolean) from public, anon;
revoke execute on function public.finish_call(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.my_call_history() from public, anon;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Sellers and brokers upload listing images to their folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_manage_listings()
  );

create policy "Owners delete their listing images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
