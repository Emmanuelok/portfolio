-- Kingxford authenticated cloud foundation
-- Apply through the Supabase migration workflow; never expose a service-role
-- key to the browser. Every application table is protected by RLS.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.organization_role as enum (
    'owner',
    'admin',
    'editor',
    'reviewer',
    'viewer'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.projects (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null check (id ~ '^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$'),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 160),
  summary text not null check (char_length(summary) <= 1200),
  active_phase text not null check (
    active_phase in ('discovery', 'evidence', 'systems', 'prototype', 'validation', 'delivery')
  ),
  document jsonb not null,
  version bigint not null default 1 check (version >= 1),
  content_hash text not null check (content_hash ~ '^kxhash_[0-9a-f]{32}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (organization_id, id),
  check (jsonb_typeof(document) = 'object')
);

create table if not exists public.project_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  project_id text not null,
  project_version bigint not null check (project_version >= 1),
  content_hash text not null check (content_hash ~ '^kxhash_[0-9a-f]{32}$'),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, project_version),
  foreign key (organization_id, project_id)
    references public.projects(organization_id, id) on delete cascade
);

create table if not exists public.intelligence_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text,
  user_id uuid references auth.users(id) on delete set null,
  request_id text not null check (char_length(request_id) between 8 and 160),
  workflow_run_id text check (workflow_run_id is null or char_length(workflow_run_id) between 8 and 240),
  mode text not null check (char_length(mode) between 1 and 80),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  provider text check (provider is null or char_length(provider) <= 120),
  model text check (model is null or char_length(model) <= 160),
  input_hash text check (input_hash is null or char_length(input_hash) <= 160),
  result jsonb,
  error_code text check (error_code is null or char_length(error_code) <= 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, request_id),
  foreign key (organization_id, project_id)
    references public.projects(organization_id, id) on delete cascade
);

create table if not exists public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 120),
  target_type text not null check (char_length(target_type) between 1 and 80),
  target_id text not null check (char_length(target_id) between 1 and 240),
  request_id text not null check (char_length(request_id) between 8 and 160),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_records (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  run_id uuid references public.intelligence_runs(id) on delete set null,
  feature text not null check (char_length(feature) between 1 and 120),
  provider text check (provider is null or char_length(provider) <= 120),
  model text check (model is null or char_length(model) <= 160),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cost_microunits bigint not null default 0 check (cost_microunits >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_objects (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  project_id text not null,
  artifact_id text,
  uploaded_by uuid references auth.users(id) on delete set null,
  bucket_id text not null default 'kingxford-private' check (bucket_id = 'kingxford-private'),
  storage_path text not null unique check (char_length(storage_path) between 38 and 1024),
  filename text not null check (char_length(filename) between 1 and 260),
  mime_type text not null check (char_length(mime_type) between 1 and 160),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  deletion_requested_at timestamptz,
  deletion_request_key text check (
    deletion_request_key is null or char_length(deletion_request_key) between 8 and 160
  ),
  check (
    (deletion_requested_at is null and deletion_request_key is null)
    or (deletion_requested_at is not null and deletion_request_key is not null)
  ),
  foreign key (organization_id, project_id)
    references public.projects(organization_id, id) on delete cascade
);

create table if not exists public.idempotency_keys (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (char_length(key) between 8 and 160),
  operation text not null check (char_length(operation) between 3 and 120),
  request_hash text not null check (request_hash ~ '^kxhash_[0-9a-f]{32}$'),
  response_body jsonb,
  response_status integer check (response_status is null or response_status between 200 and 599),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (organization_id, user_id, key)
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id, joined_at);
create index if not exists projects_organization_updated_idx
  on public.projects(organization_id, updated_at desc) where deleted_at is null;
create index if not exists project_revisions_project_idx
  on public.project_revisions(organization_id, project_id, project_version desc);
create index if not exists intelligence_runs_project_idx
  on public.intelligence_runs(organization_id, project_id, created_at desc);
create unique index if not exists intelligence_runs_workflow_run_idx
  on public.intelligence_runs(organization_id, workflow_run_id)
  where workflow_run_id is not null;
create index if not exists audit_events_organization_idx
  on public.audit_events(organization_id, created_at desc);
create index if not exists usage_records_organization_idx
  on public.usage_records(organization_id, created_at desc);
create unique index if not exists usage_records_run_feature_idx
  on public.usage_records(run_id, feature);
create index if not exists evidence_objects_project_idx
  on public.evidence_objects(organization_id, project_id, created_at desc);
create index if not exists idempotency_keys_expiry_idx
  on public.idempotency_keys(created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists organizations_touch_updated_at on public.organizations;
create trigger organizations_touch_updated_at
before update on public.organizations
for each row execute function public.touch_updated_at();

create or replace function public.is_organization_member(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
  );
$$;

create or replace function public.has_organization_role(
  p_organization_id uuid,
  p_roles public.organization_role[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.role = any(p_roles)
  );
$$;

revoke all on function public.is_organization_member(uuid, uuid) from public;
revoke all on function public.has_organization_role(uuid, public.organization_role[], uuid) from public;
grant execute on function public.is_organization_member(uuid, uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.organization_role[], uuid) to authenticated;

create or replace function public.ensure_personal_organization()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_display_name text;
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('kingxford-personal-org:' || v_user_id::text, 0)
  );
  select membership.organization_id
    into v_organization_id
  from public.organization_members membership
  where membership.user_id = v_user_id
  order by membership.joined_at
  limit 1;
  if v_organization_id is not null then
    return v_organization_id;
  end if;

  select coalesce(
    nullif(trim(user_record.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(user_record.email, '@', 1), ''),
    'My organization'
  )
    into v_display_name
  from auth.users user_record
  where user_record.id = v_user_id;

  insert into public.organizations (name, slug, owner_user_id)
  values (
    left(coalesce(v_display_name, 'My organization'), 160),
    'personal-' || left(pg_catalog.md5(v_user_id::text), 20),
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, v_user_id, 'owner');
  return v_organization_id;
end;
$$;

revoke all on function public.ensure_personal_organization() from public;
grant execute on function public.ensure_personal_organization() to authenticated;

create or replace function public.handle_new_kingxford_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'My organization'
  );
  insert into public.organizations (name, slug, owner_user_id)
  values (
    left(v_name, 160),
    'personal-' || left(pg_catalog.md5(new.id::text), 20),
    new.id
  )
  returning id into v_organization_id;
  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_kingxford on auth.users;
create trigger on_auth_user_created_kingxford
after insert on auth.users
for each row execute function public.handle_new_kingxford_user();

create or replace function public.validate_evidence_storage_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.storage_path !~ (
    '^'
    || new.organization_id::text
    || '/'
    || new.project_id
    || '/evidence/[0-9a-f]{32}-[0-9a-f]{32}\.(txt|md|markdown|csv|json|pdf)$'
  ) then
    raise exception 'Evidence paths must remain inside their organization and project.';
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_storage_path_guard on public.evidence_objects;
create trigger evidence_storage_path_guard
before insert or update on public.evidence_objects
for each row execute function public.validate_evidence_storage_path();

create or replace function public.can_access_kingxford_storage(
  p_name text,
  p_write boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  begin
    v_organization_id := split_part(p_name, '/', 1)::uuid;
  exception
    when invalid_text_representation then return false;
  end;
  if p_write then
    return public.has_organization_role(
      v_organization_id,
      array['owner', 'admin', 'editor']::public.organization_role[]
    );
  end if;
  return public.is_organization_member(v_organization_id);
end;
$$;

revoke all on function public.can_access_kingxford_storage(text, boolean) from public;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_revisions enable row level security;
alter table public.intelligence_runs enable row level security;
alter table public.audit_events enable row level security;
alter table public.usage_records enable row level security;
alter table public.evidence_objects enable row level security;
alter table public.idempotency_keys enable row level security;

drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members on public.organizations
for select to authenticated
using (public.is_organization_member(id));
drop policy if exists organizations_insert_owner on public.organizations;
create policy organizations_insert_owner on public.organizations
for insert to authenticated
with check (owner_user_id = auth.uid());
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
for update to authenticated
using (public.has_organization_role(id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(id, array['owner', 'admin']::public.organization_role[]));
drop policy if exists organizations_delete_owner on public.organizations;
create policy organizations_delete_owner on public.organizations
for delete to authenticated
using (public.has_organization_role(id, array['owner']::public.organization_role[]));

drop policy if exists members_select_visible on public.organization_members;
create policy members_select_visible on public.organization_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
);
drop policy if exists members_insert_admin on public.organization_members;
create policy members_insert_admin on public.organization_members
for insert to authenticated
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
drop policy if exists members_update_admin on public.organization_members;
create policy members_update_admin on public.organization_members
for update to authenticated
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
drop policy if exists members_delete_admin on public.organization_members;
create policy members_delete_admin on public.organization_members
for delete to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
);

drop policy if exists projects_select_members on public.projects;
create policy projects_select_members on public.projects
for select to authenticated
using (public.is_organization_member(organization_id));
drop policy if exists projects_insert_editors on public.projects;
create policy projects_insert_editors on public.projects
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'editor']::public.organization_role[]
  )
);
drop policy if exists projects_update_editors on public.projects;
create policy projects_update_editors on public.projects
for update to authenticated
using (public.has_organization_role(organization_id, array['owner', 'admin', 'editor']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin', 'editor']::public.organization_role[]));
drop policy if exists projects_delete_admin on public.projects;
create policy projects_delete_admin on public.projects
for delete to authenticated
using (public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

drop policy if exists project_revisions_select_members on public.project_revisions;
create policy project_revisions_select_members on public.project_revisions
for select to authenticated
using (public.is_organization_member(organization_id));
drop policy if exists project_revisions_insert_editors on public.project_revisions;
create policy project_revisions_insert_editors on public.project_revisions
for insert to authenticated
with check (public.has_organization_role(organization_id, array['owner', 'admin', 'editor']::public.organization_role[]));

drop policy if exists intelligence_runs_select_members on public.intelligence_runs;
create policy intelligence_runs_select_members on public.intelligence_runs
for select to authenticated
using (public.is_organization_member(organization_id));
drop policy if exists intelligence_runs_insert_members on public.intelligence_runs;
create policy intelligence_runs_insert_members on public.intelligence_runs
for insert to authenticated
with check (user_id = auth.uid() and public.is_organization_member(organization_id));
drop policy if exists intelligence_runs_update_actor on public.intelligence_runs;
create policy intelligence_runs_update_actor on public.intelligence_runs
for update to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
)
with check (public.is_organization_member(organization_id));

drop policy if exists audit_events_select_admin on public.audit_events;
create policy audit_events_select_admin on public.audit_events
for select to authenticated
using (
  actor_user_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
);
drop policy if exists audit_events_insert_actor on public.audit_events;
create policy audit_events_insert_actor on public.audit_events
for insert to authenticated
with check (actor_user_id = auth.uid() and public.is_organization_member(organization_id));

drop policy if exists usage_records_select_visible on public.usage_records;
create policy usage_records_select_visible on public.usage_records
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
);
drop policy if exists usage_records_insert_actor on public.usage_records;
create policy usage_records_insert_actor on public.usage_records
for insert to authenticated
with check (user_id = auth.uid() and public.is_organization_member(organization_id));

drop policy if exists evidence_objects_select_members on public.evidence_objects;
create policy evidence_objects_select_members on public.evidence_objects
for select to authenticated
using (public.is_organization_member(organization_id));
drop policy if exists evidence_objects_insert_editors on public.evidence_objects;
create policy evidence_objects_insert_editors on public.evidence_objects
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.has_organization_role(organization_id, array['owner', 'admin', 'editor']::public.organization_role[])
);
drop policy if exists evidence_objects_update_editors on public.evidence_objects;
create policy evidence_objects_update_editors on public.evidence_objects
for update to authenticated
using (public.has_organization_role(organization_id, array['owner', 'admin', 'editor']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'admin', 'editor']::public.organization_role[]));
drop policy if exists evidence_objects_delete_editors on public.evidence_objects;
create policy evidence_objects_delete_editors on public.evidence_objects
for delete to authenticated
using (public.has_organization_role(organization_id, array['owner', 'admin', 'editor']::public.organization_role[]));

drop policy if exists idempotency_keys_actor on public.idempotency_keys;
create policy idempotency_keys_actor on public.idempotency_keys
for all to authenticated
using (user_id = auth.uid() and public.is_organization_member(organization_id))
with check (user_id = auth.uid() and public.is_organization_member(organization_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('kingxford-private', 'kingxford-private', false, 5242880)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists kingxford_private_select on storage.objects;
drop policy if exists kingxford_private_insert on storage.objects;
drop policy if exists kingxford_private_update on storage.objects;
drop policy if exists kingxford_private_delete on storage.objects;

-- Private evidence bytes are available only through authenticated application
-- routes. Those routes verify tenant membership, role, project ownership,
-- content type, signature, size, and digest before using the service role for
-- object I/O. Browser sessions receive no direct storage-object policy.

create or replace function public.upsert_kingxford_project(
  p_organization_id uuid,
  p_project_id text,
  p_project jsonb,
  p_title text,
  p_summary text,
  p_active_phase text,
  p_content_hash text,
  p_expected_version bigint,
  p_expected_content_hash text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.projects%rowtype;
  v_operation constant text := 'project.upsert';
  v_previous public.idempotency_keys%rowtype;
  v_response jsonb;
  v_version bigint;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'editor']::public.organization_role[],
    v_user_id
  ) then
    raise sqlstate 'KX403' using message = 'Project write denied';
  end if;
  if p_project_id !~ '^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$'
    or p_content_hash !~ '^kxhash_[0-9a-f]{32}$'
    or p_request_hash !~ '^kxhash_[0-9a-f]{32}$'
    or char_length(p_idempotency_key) not between 8 and 160 then
    raise sqlstate 'KX400' using message = 'Invalid project mutation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || v_user_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select * into v_previous
  from public.idempotency_keys key_record
  where key_record.organization_id = p_organization_id
    and key_record.user_id = v_user_id
    and key_record.key = p_idempotency_key
  for update;
  if found then
    if v_previous.operation <> v_operation or v_previous.request_hash <> p_request_hash then
      raise sqlstate 'KX409' using message = 'Idempotency key conflict';
    end if;
    if v_previous.response_body is null then
      raise sqlstate 'KX425' using message = 'Idempotent request is still processing';
    end if;
    return v_previous.response_body || jsonb_build_object('replayed', true);
  end if;

  insert into public.idempotency_keys (
    organization_id, user_id, key, operation, request_hash
  ) values (
    p_organization_id, v_user_id, p_idempotency_key, v_operation, p_request_hash
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_project_id, 0)
  );
  select * into v_current
  from public.projects project_record
  where project_record.organization_id = p_organization_id
    and project_record.id = p_project_id
    and project_record.deleted_at is null
  for update;

  if found then
    if p_expected_version is null
      or v_current.version <> p_expected_version
      or (
        p_expected_content_hash is not null
        and v_current.content_hash <> p_expected_content_hash
      ) then
      v_response := jsonb_build_object(
        'status', 'conflict',
        'project_id', p_project_id,
        'version', v_current.version,
        'content_hash', v_current.content_hash,
        'updated_at', v_current.updated_at,
        'replayed', false
      );
      update public.idempotency_keys
      set response_body = v_response, response_status = 409, completed_at = v_now
      where organization_id = p_organization_id and user_id = v_user_id and key = p_idempotency_key;
      return v_response;
    end if;
    v_version := v_current.version + 1;
    update public.projects
    set title = p_title,
        summary = p_summary,
        active_phase = p_active_phase,
        document = p_project,
        version = v_version,
        content_hash = p_content_hash,
        updated_at = v_now
    where organization_id = p_organization_id and id = p_project_id;
  else
    if p_expected_version is not null then
      v_response := jsonb_build_object(
        'status', 'conflict',
        'project_id', p_project_id,
        'version', null,
        'content_hash', null,
        'updated_at', null,
        'replayed', false
      );
      update public.idempotency_keys
      set response_body = v_response, response_status = 409, completed_at = v_now
      where organization_id = p_organization_id and user_id = v_user_id and key = p_idempotency_key;
      return v_response;
    end if;
    v_version := 1;
    insert into public.projects (
      organization_id, id, owner_user_id, title, summary, active_phase,
      document, version, content_hash, created_at, updated_at
    ) values (
      p_organization_id, p_project_id, v_user_id, p_title, p_summary,
      p_active_phase, p_project, v_version, p_content_hash, v_now, v_now
    );
  end if;

  insert into public.project_revisions (
    organization_id, project_id, project_version, content_hash, document,
    actor_user_id, created_at
  ) values (
    p_organization_id, p_project_id, v_version, p_content_hash, p_project,
    v_user_id, v_now
  );
  insert into public.audit_events (
    organization_id, actor_user_id, action, target_type, target_id,
    request_id, metadata, created_at
  ) values (
    p_organization_id,
    v_user_id,
    case when v_version = 1 then 'project.created' else 'project.updated' end,
    'project',
    p_project_id,
    p_idempotency_key,
    jsonb_build_object('version', v_version, 'contentHash', p_content_hash),
    v_now
  );
  v_response := jsonb_build_object(
    'status', case when v_version = 1 then 'created' else 'updated' end,
    'project_id', p_project_id,
    'version', v_version,
    'content_hash', p_content_hash,
    'updated_at', v_now,
    'replayed', false
  );
  update public.idempotency_keys
  set response_body = v_response,
      response_status = case when v_version = 1 then 201 else 200 end,
      completed_at = v_now
  where organization_id = p_organization_id and user_id = v_user_id and key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.upsert_kingxford_project(
  uuid, text, jsonb, text, text, text, text, bigint, text, text, text
) from public;
grant execute on function public.upsert_kingxford_project(
  uuid, text, jsonb, text, text, text, text, bigint, text, text, text
) to authenticated;

create or replace function public.register_kingxford_evidence(
  p_organization_id uuid,
  p_project_id text,
  p_artifact_id text,
  p_storage_path text,
  p_filename text,
  p_mime_type text,
  p_byte_size bigint,
  p_sha256 text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation constant text := 'evidence.upload';
  v_previous public.idempotency_keys%rowtype;
  v_project public.projects%rowtype;
  v_evidence_id uuid;
  v_response jsonb;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'editor']::public.organization_role[],
    v_user_id
  ) then
    raise sqlstate 'KX403' using message = 'Evidence write denied';
  end if;
  if p_project_id !~ '^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$'
    or p_storage_path !~ (
      '^' || p_organization_id::text || '/' || p_project_id
      || '/evidence/[0-9a-f]{32}-[0-9a-f]{32}\.(txt|md|markdown|csv|json|pdf)$'
    )
    or p_sha256 !~ '^[0-9a-f]{64}$'
    or p_request_hash !~ '^kxhash_[0-9a-f]{32}$'
    or char_length(p_idempotency_key) not between 8 and 160
    or char_length(trim(p_filename)) not between 1 and 180
    or char_length(p_mime_type) not between 1 and 160
    or p_byte_size not between 1 and 5242880 then
    raise sqlstate 'KX400' using message = 'Invalid evidence mutation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || v_user_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select * into v_previous
  from public.idempotency_keys key_record
  where key_record.organization_id = p_organization_id
    and key_record.user_id = v_user_id
    and key_record.key = p_idempotency_key
  for update;
  if found then
    if v_previous.operation <> v_operation or v_previous.request_hash <> p_request_hash then
      raise sqlstate 'KX409' using message = 'Idempotency key conflict';
    end if;
    if v_previous.response_body is null then
      raise sqlstate 'KX425' using message = 'Idempotent request is still processing';
    end if;
    return v_previous.response_body || jsonb_build_object('replayed', true);
  end if;

  select * into v_project
  from public.projects project_record
  where project_record.organization_id = p_organization_id
    and project_record.id = p_project_id
    and project_record.deleted_at is null
  for share;
  if not found then
    raise sqlstate 'KX404' using message = 'Cloud project not found';
  end if;
  if p_artifact_id is not null and not exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      coalesce(v_project.document -> 'artifacts', '[]'::jsonb)
    ) artifact
    where artifact ->> 'id' = p_artifact_id
      and artifact ->> 'kind' = 'evidence'
  ) then
    raise sqlstate 'KX404' using message = 'Evidence artifact not found';
  end if;

  insert into public.idempotency_keys (
    organization_id, user_id, key, operation, request_hash
  ) values (
    p_organization_id, v_user_id, p_idempotency_key, v_operation, p_request_hash
  );
  insert into public.evidence_objects (
    organization_id, project_id, artifact_id, uploaded_by, bucket_id,
    storage_path, filename, mime_type, byte_size, sha256, created_at
  ) values (
    p_organization_id, p_project_id, p_artifact_id, v_user_id,
    'kingxford-private', p_storage_path, p_filename, p_mime_type,
    p_byte_size, p_sha256, v_now
  ) returning id into v_evidence_id;
  insert into public.audit_events (
    organization_id, actor_user_id, action, target_type, target_id,
    request_id, metadata, created_at
  ) values (
    p_organization_id, v_user_id, 'evidence.uploaded', 'evidence',
    v_evidence_id::text, p_idempotency_key,
    jsonb_build_object(
      'projectId', p_project_id,
      'artifactId', p_artifact_id,
      'mimeType', p_mime_type,
      'byteSize', p_byte_size,
      'sha256', p_sha256
    ),
    v_now
  );
  v_response := jsonb_build_object(
    'status', 'created',
    'evidence_id', v_evidence_id,
    'replayed', false
  );
  update public.idempotency_keys
  set response_body = v_response,
      response_status = 201,
      completed_at = v_now
  where organization_id = p_organization_id
    and user_id = v_user_id
    and key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.register_kingxford_evidence(
  uuid, text, text, text, text, text, bigint, text, text, text
) from public;
grant execute on function public.register_kingxford_evidence(
  uuid, text, text, text, text, text, bigint, text, text, text
) to authenticated;

create or replace function public.delete_kingxford_evidence(
  p_organization_id uuid,
  p_project_id text,
  p_evidence_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation constant text := 'evidence.delete';
  v_previous public.idempotency_keys%rowtype;
  v_evidence public.evidence_objects%rowtype;
  v_response jsonb;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'editor']::public.organization_role[],
    v_user_id
  ) then
    raise sqlstate 'KX403' using message = 'Evidence delete denied';
  end if;
  if p_project_id !~ '^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$'
    or p_request_hash !~ '^kxhash_[0-9a-f]{32}$'
    or char_length(p_idempotency_key) not between 8 and 160 then
    raise sqlstate 'KX400' using message = 'Invalid evidence mutation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || v_user_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select * into v_previous
  from public.idempotency_keys key_record
  where key_record.organization_id = p_organization_id
    and key_record.user_id = v_user_id
    and key_record.key = p_idempotency_key
  for update;
  if found then
    if v_previous.operation <> v_operation or v_previous.request_hash <> p_request_hash then
      raise sqlstate 'KX409' using message = 'Idempotency key conflict';
    end if;
    if v_previous.response_body is null then
      raise sqlstate 'KX425' using message = 'Idempotent request is still processing';
    end if;
    return v_previous.response_body || jsonb_build_object('replayed', true);
  end if;

  insert into public.idempotency_keys (
    organization_id, user_id, key, operation, request_hash
  ) values (
    p_organization_id, v_user_id, p_idempotency_key, v_operation, p_request_hash
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || p_project_id || ':' || p_evidence_id::text,
      0
    )
  );
  select * into v_evidence
  from public.evidence_objects evidence
  where evidence.organization_id = p_organization_id
    and evidence.project_id = p_project_id
    and evidence.id = p_evidence_id
  for update;
  if not found then
    v_response := jsonb_build_object(
      'status', 'not_found',
      'evidence_id', p_evidence_id,
      'storage_path', null,
      'replayed', false
    );
  else
    update public.evidence_objects
    set deletion_requested_at = coalesce(deletion_requested_at, v_now),
        deletion_request_key = coalesce(deletion_request_key, p_idempotency_key)
    where organization_id = p_organization_id
      and project_id = p_project_id
      and id = p_evidence_id;
    v_response := jsonb_build_object(
      'status', 'deletion_pending',
      'evidence_id', p_evidence_id,
      'storage_path', v_evidence.storage_path,
      'replayed', false
    );
  end if;
  update public.idempotency_keys
  set response_body = v_response,
      response_status = case when v_response ->> 'status' = 'not_found' then 404 else 202 end,
      completed_at = v_now
  where organization_id = p_organization_id
    and user_id = v_user_id
    and key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.delete_kingxford_evidence(
  uuid, text, uuid, text, text
) from public;
grant execute on function public.delete_kingxford_evidence(
  uuid, text, uuid, text, text
) to authenticated;

create or replace function public.complete_kingxford_evidence_deletion(
  p_organization_id uuid,
  p_project_id text,
  p_evidence_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation constant text := 'evidence.delete';
  v_key_record public.idempotency_keys%rowtype;
  v_evidence public.evidence_objects%rowtype;
  v_response jsonb;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'editor']::public.organization_role[],
    v_user_id
  ) then
    raise sqlstate 'KX403' using message = 'Evidence delete denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || v_user_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select * into v_key_record
  from public.idempotency_keys key_record
  where key_record.organization_id = p_organization_id
    and key_record.user_id = v_user_id
    and key_record.key = p_idempotency_key
  for update;
  if not found
    or v_key_record.operation <> v_operation
    or v_key_record.request_hash <> p_request_hash then
    raise sqlstate 'KX409' using message = 'Evidence deletion was not prepared';
  end if;
  if v_key_record.response_body ->> 'status' = 'deleted' then
    return v_key_record.response_body || jsonb_build_object('replayed', true);
  end if;
  if v_key_record.response_body ->> 'status' <> 'deletion_pending'
    or v_key_record.response_body ->> 'evidence_id' <> p_evidence_id::text then
    raise sqlstate 'KX409' using message = 'Evidence deletion was not prepared';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || p_project_id || ':' || p_evidence_id::text,
      0
    )
  );
  select * into v_evidence
  from public.evidence_objects evidence
  where evidence.organization_id = p_organization_id
    and evidence.project_id = p_project_id
    and evidence.id = p_evidence_id
  for update;
  if found then
    if v_evidence.deletion_requested_at is null then
      raise sqlstate 'KX409' using message = 'Evidence deletion was not prepared';
    end if;
    delete from public.evidence_objects
    where organization_id = p_organization_id
      and project_id = p_project_id
      and id = p_evidence_id;
    insert into public.audit_events (
      organization_id, actor_user_id, action, target_type, target_id,
      request_id, metadata, created_at
    ) values (
      p_organization_id, v_user_id, 'evidence.deleted', 'evidence',
      p_evidence_id::text, p_idempotency_key,
      jsonb_build_object(
        'projectId', p_project_id,
        'artifactId', v_evidence.artifact_id,
        'byteSize', v_evidence.byte_size,
        'sha256', v_evidence.sha256
      ),
      v_now
    );
  end if;

  v_response := jsonb_build_object(
    'status', 'deleted',
    'evidence_id', p_evidence_id,
    'storage_path', v_key_record.response_body ->> 'storage_path',
    'replayed', false
  );
  update public.idempotency_keys
  set response_body = v_response,
      response_status = 200,
      completed_at = v_now
  where organization_id = p_organization_id
    and user_id = v_user_id
    and key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.complete_kingxford_evidence_deletion(
  uuid, text, uuid, text, text
) from public;
grant execute on function public.complete_kingxford_evidence_deletion(
  uuid, text, uuid, text, text
) to authenticated;

create or replace function public.delete_kingxford_project(
  p_organization_id uuid,
  p_project_id text,
  p_expected_version bigint,
  p_expected_content_hash text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.projects%rowtype;
  v_operation constant text := 'project.delete';
  v_previous public.idempotency_keys%rowtype;
  v_response jsonb;
  v_storage_paths jsonb := '[]'::jsonb;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  if not public.has_organization_role(
    p_organization_id,
    array['owner', 'admin']::public.organization_role[],
    v_user_id
  ) then
    raise sqlstate 'KX403' using message = 'Project delete denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_organization_id::text || ':' || v_user_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select * into v_previous
  from public.idempotency_keys key_record
  where key_record.organization_id = p_organization_id
    and key_record.user_id = v_user_id
    and key_record.key = p_idempotency_key
  for update;
  if found then
    if v_previous.operation <> v_operation or v_previous.request_hash <> p_request_hash then
      raise sqlstate 'KX409' using message = 'Idempotency key conflict';
    end if;
    return v_previous.response_body || jsonb_build_object('replayed', true);
  end if;
  insert into public.idempotency_keys (
    organization_id, user_id, key, operation, request_hash
  ) values (
    p_organization_id, v_user_id, p_idempotency_key, v_operation, p_request_hash
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_project_id, 0)
  );
  select * into v_current
  from public.projects project_record
  where project_record.organization_id = p_organization_id
    and project_record.id = p_project_id
    and project_record.deleted_at is null
  for update;
  if not found then
    v_response := jsonb_build_object(
      'status', 'deleted', 'project_id', p_project_id, 'version', null,
      'content_hash', null, 'updated_at', v_now, 'replayed', false
    );
  elsif v_current.version <> p_expected_version
    or v_current.content_hash <> p_expected_content_hash then
    v_response := jsonb_build_object(
      'status', 'conflict', 'project_id', p_project_id,
      'version', v_current.version, 'content_hash', v_current.content_hash,
      'updated_at', v_current.updated_at, 'replayed', false
    );
  else
    select coalesce(jsonb_agg(evidence.storage_path order by evidence.storage_path), '[]'::jsonb)
      into v_storage_paths
    from public.evidence_objects evidence
    where evidence.organization_id = p_organization_id
      and evidence.project_id = p_project_id;
    insert into public.audit_events (
      organization_id, actor_user_id, action, target_type, target_id,
      request_id, metadata, created_at
    ) values (
      p_organization_id, v_user_id, 'project.deleted', 'project', p_project_id,
      p_idempotency_key,
      jsonb_build_object('version', v_current.version, 'contentHash', v_current.content_hash),
      v_now
    );
    delete from public.projects
    where organization_id = p_organization_id and id = p_project_id;
    v_response := jsonb_build_object(
      'status', 'deleted', 'project_id', p_project_id,
      'version', v_current.version, 'content_hash', v_current.content_hash,
      'updated_at', v_now, 'storage_paths', v_storage_paths, 'replayed', false
    );
  end if;

  update public.idempotency_keys
  set response_body = v_response,
      response_status = case when v_response ->> 'status' = 'conflict' then 409 else 200 end,
      completed_at = v_now
  where organization_id = p_organization_id and user_id = v_user_id and key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.delete_kingxford_project(uuid, text, bigint, text, text, text) from public;
grant execute on function public.delete_kingxford_project(uuid, text, bigint, text, text, text) to authenticated;

create or replace function public.delete_my_kingxford_cloud_data(
  p_organization_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.organization_role;
  v_member_count bigint;
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  select membership.role into v_role
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = v_user_id;
  if v_role is null then
    raise sqlstate 'KX403' using message = 'Organization access denied';
  end if;
  if char_length(p_idempotency_key) not between 8 and 160
    or p_request_hash !~ '^kxhash_[0-9a-f]{32}$' then
    raise sqlstate 'KX400' using message = 'Invalid deletion request';
  end if;

  select count(*) into v_member_count
  from public.organization_members membership
  where membership.organization_id = p_organization_id;

  if v_role = 'owner' and v_member_count > 1 then
    raise sqlstate 'KX403' using message = 'Transfer organization ownership before deleting personal cloud access';
  end if;
  if v_role = 'owner' then
    delete from public.organizations where id = p_organization_id;
    return jsonb_build_object(
      'organizationDeleted', true,
      'organizationId', p_organization_id,
      'authIdentityDeleted', false
    );
  end if;

  delete from public.usage_records
  where organization_id = p_organization_id and user_id = v_user_id;
  delete from public.organization_members
  where organization_id = p_organization_id and user_id = v_user_id;
  return jsonb_build_object(
    'organizationDeleted', false,
    'membershipDeleted', true,
    'organizationId', p_organization_id,
    'authIdentityDeleted', false
  );
end;
$$;

revoke all on function public.delete_my_kingxford_cloud_data(uuid, text, text) from public;
grant execute on function public.delete_my_kingxford_cloud_data(uuid, text, text) to authenticated;

-- Application roles receive the minimum direct privileges. Project and
-- membership mutations run only through guarded RPCs, preventing clients from
-- bypassing version history or audit creation with direct table writes.
revoke all on public.organizations from authenticated;
revoke all on public.organization_members from authenticated;
revoke all on public.projects from authenticated;
revoke all on public.project_revisions from authenticated;
revoke all on public.intelligence_runs from authenticated;
revoke all on public.audit_events from authenticated;
revoke all on public.usage_records from authenticated;
revoke all on public.evidence_objects from authenticated;
revoke all on public.idempotency_keys from authenticated;

grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.projects to authenticated;
grant select on public.project_revisions to authenticated;
grant select on public.intelligence_runs to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.usage_records to authenticated;
grant select on public.evidence_objects to authenticated;
