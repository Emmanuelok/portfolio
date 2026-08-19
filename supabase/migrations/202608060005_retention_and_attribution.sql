-- Kingxford retention, durable-record attribution, and organization lifecycle.
--
-- Retention windows applied by the purge functions below. Each window is a
-- floor: a caller may pass a longer interval, never a shorter one.
--   idempotency_keys                 30 days after creation
--   cloud_account_deletion_receipts  90 days after creation
--   project_revisions                12 months, never the newest revision of a project
--   intelligence_runs                12 months, terminal runs only
--   audit_events                     24 months after creation
--   usage_records                    24 months after creation
--
-- No existing migration installs pg_cron, so nothing is scheduled here. The
-- purge functions must be called by a Supabase scheduled function or an
-- external cron using the service role, for example once per hour:
--   select public.run_kingxford_retention(1000);
-- Every function is bounded per invocation and safe to repeat: it deletes at
-- most p_limit rows per call and returns the number deleted, so a scheduler
-- calls it until it returns 0.
--
-- Durable review rows are attributed through the existing nullable columns
-- public.usage_records.user_id and public.audit_events.actor_user_id. The
-- add-column statements below are no-ops on deployments that already applied
-- the cloud foundation; the indexes are new and support the per-user lookups
-- that the existing self-read policies already allow. No policy is widened.
--
-- Organization creation and rename close the gap between the documented
-- personal and shared organizations and the guarded RPC surface. Both reuse
-- the existing role model, idempotency table, and audit trail.

alter table public.usage_records
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.audit_events
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

create index if not exists usage_records_user_idx
  on public.usage_records(user_id, created_at desc)
  where user_id is not null;
create index if not exists audit_events_actor_idx
  on public.audit_events(actor_user_id, created_at desc)
  where actor_user_id is not null;
create index if not exists audit_events_created_idx
  on public.audit_events(created_at);
create index if not exists usage_records_created_idx
  on public.usage_records(created_at);
create index if not exists project_revisions_created_idx
  on public.project_revisions(created_at);
create index if not exists idempotency_keys_user_key_idx
  on public.idempotency_keys(user_id, key);
create index if not exists intelligence_runs_retention_idx
  on public.intelligence_runs(completed_at)
  where status in ('completed', 'failed', 'cancelled');

create or replace function public.purge_kingxford_idempotency_keys(
  p_retention interval default interval '30 days',
  p_limit integer default 1000
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - greatest(coalesce(p_retention, interval '30 days'), interval '30 days');
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_deleted bigint;
begin
  delete from public.idempotency_keys
  where ctid in (
    select expired.ctid
    from public.idempotency_keys expired
    where expired.created_at < v_cutoff
    order by expired.created_at
    limit v_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.purge_kingxford_deletion_receipts(
  p_retention interval default interval '90 days',
  p_limit integer default 1000
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - greatest(coalesce(p_retention, interval '90 days'), interval '90 days');
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_deleted bigint;
begin
  delete from public.cloud_account_deletion_receipts
  where ctid in (
    select expired.ctid
    from public.cloud_account_deletion_receipts expired
    where expired.created_at < v_cutoff
    order by expired.created_at
    limit v_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.purge_kingxford_audit_events(
  p_retention interval default interval '24 months',
  p_limit integer default 1000
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - greatest(coalesce(p_retention, interval '24 months'), interval '24 months');
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_deleted bigint;
begin
  delete from public.audit_events
  where id in (
    select expired.id
    from public.audit_events expired
    where expired.created_at < v_cutoff
    order by expired.created_at
    limit v_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.purge_kingxford_usage_records(
  p_retention interval default interval '24 months',
  p_limit integer default 1000
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - greatest(coalesce(p_retention, interval '24 months'), interval '24 months');
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_deleted bigint;
begin
  delete from public.usage_records
  where id in (
    select expired.id
    from public.usage_records expired
    where expired.created_at < v_cutoff
    order by expired.created_at
    limit v_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.purge_kingxford_project_revisions(
  p_retention interval default interval '12 months',
  p_limit integer default 1000
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - greatest(coalesce(p_retention, interval '12 months'), interval '12 months');
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_deleted bigint;
begin
  delete from public.project_revisions
  where id in (
    select expired.id
    from public.project_revisions expired
    where expired.created_at < v_cutoff
      and exists (
        select 1
        from public.project_revisions newer
        where newer.organization_id = expired.organization_id
          and newer.project_id = expired.project_id
          and newer.project_version > expired.project_version
      )
    order by expired.created_at
    limit v_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.purge_kingxford_intelligence_runs(
  p_retention interval default interval '12 months',
  p_limit integer default 1000
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - greatest(coalesce(p_retention, interval '12 months'), interval '12 months');
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_deleted bigint;
begin
  delete from public.intelligence_runs
  where id in (
    select expired.id
    from public.intelligence_runs expired
    where expired.status in ('completed', 'failed', 'cancelled')
      and coalesce(expired.completed_at, expired.created_at) < v_cutoff
    order by expired.created_at
    limit v_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.run_kingxford_retention(
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 5000);
begin
  return jsonb_build_object(
    'idempotencyKeys', public.purge_kingxford_idempotency_keys(interval '30 days', v_limit),
    'deletionReceipts', public.purge_kingxford_deletion_receipts(interval '90 days', v_limit),
    'projectRevisions', public.purge_kingxford_project_revisions(interval '12 months', v_limit),
    'intelligenceRuns', public.purge_kingxford_intelligence_runs(interval '12 months', v_limit),
    'auditEvents', public.purge_kingxford_audit_events(interval '24 months', v_limit),
    'usageRecords', public.purge_kingxford_usage_records(interval '24 months', v_limit)
  );
end;
$$;

-- Retention is operational work. Browser sessions keep the read-only posture
-- established by the cloud foundation and receive no execute privilege here.
revoke all on function public.purge_kingxford_idempotency_keys(interval, integer) from public;
revoke all on function public.purge_kingxford_deletion_receipts(interval, integer) from public;
revoke all on function public.purge_kingxford_audit_events(interval, integer) from public;
revoke all on function public.purge_kingxford_usage_records(interval, integer) from public;
revoke all on function public.purge_kingxford_project_revisions(interval, integer) from public;
revoke all on function public.purge_kingxford_intelligence_runs(interval, integer) from public;
revoke all on function public.run_kingxford_retention(integer) from public;

grant execute on function public.purge_kingxford_idempotency_keys(interval, integer) to service_role;
grant execute on function public.purge_kingxford_deletion_receipts(interval, integer) to service_role;
grant execute on function public.purge_kingxford_audit_events(interval, integer) to service_role;
grant execute on function public.purge_kingxford_usage_records(interval, integer) to service_role;
grant execute on function public.purge_kingxford_project_revisions(interval, integer) to service_role;
grant execute on function public.purge_kingxford_intelligence_runs(interval, integer) to service_role;
grant execute on function public.run_kingxford_retention(integer) to service_role;

create or replace function public.create_kingxford_organization(
  p_name text,
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
  v_operation constant text := 'organization.create';
  v_previous public.idempotency_keys%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_organization_id uuid;
  v_owned_count bigint;
  v_response jsonb;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  if char_length(v_name) not between 2 and 160
    or char_length(p_idempotency_key) not between 8 and 160
    or p_request_hash !~ '^kxhash_[0-9a-f]{32}$' then
    raise sqlstate 'KX400' using message = 'Invalid organization creation request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'kingxford-organization-create:' || v_user_id::text || ':' || p_idempotency_key,
      0
    )
  );
  select * into v_previous
  from public.idempotency_keys key_record
  where key_record.user_id = v_user_id
    and key_record.key = p_idempotency_key
    and key_record.operation = v_operation
  limit 1
  for update;
  if found then
    if v_previous.request_hash <> p_request_hash then
      raise sqlstate 'KX409' using message = 'Idempotency key conflict';
    end if;
    if v_previous.response_body is null then
      raise sqlstate 'KX409' using message = 'Organization creation is still processing';
    end if;
    return v_previous.response_body || jsonb_build_object('replayed', true);
  end if;

  select count(*) into v_owned_count
  from public.organization_members membership
  where membership.user_id = v_user_id
    and membership.role = 'owner';
  if v_owned_count >= 20 then
    raise sqlstate 'KX409' using message = 'This account has reached its organization limit';
  end if;

  v_slug := trim(both '-' from left(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), 40));
  if char_length(v_slug) < 3 then
    v_slug := 'organization';
  end if;
  v_slug := v_slug || '-' || left(pg_catalog.md5(extensions.gen_random_uuid()::text), 12);

  insert into public.organizations (name, slug, owner_user_id, created_at, updated_at)
  values (v_name, v_slug, v_user_id, v_now, v_now)
  returning id into v_organization_id;
  insert into public.organization_members (organization_id, user_id, role, joined_at)
  values (v_organization_id, v_user_id, 'owner', v_now);
  insert into public.idempotency_keys (
    organization_id, user_id, key, operation, request_hash
  ) values (
    v_organization_id, v_user_id, p_idempotency_key, v_operation, p_request_hash
  );
  insert into public.audit_events (
    organization_id, actor_user_id, action, target_type, target_id,
    request_id, metadata, created_at
  ) values (
    v_organization_id, v_user_id, 'organization.created', 'organization',
    v_organization_id::text, p_idempotency_key,
    jsonb_build_object('name', v_name, 'slug', v_slug), v_now
  );

  v_response := jsonb_build_object(
    'status', 'created',
    'organizationId', v_organization_id,
    'name', v_name,
    'slug', v_slug,
    'role', 'owner',
    'replayed', false
  );
  update public.idempotency_keys
  set response_body = v_response, response_status = 201, completed_at = v_now
  where organization_id = v_organization_id
    and user_id = v_user_id
    and key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.create_kingxford_organization(text, text, text) from public;
grant execute on function public.create_kingxford_organization(text, text, text) to authenticated;

create or replace function public.rename_kingxford_organization(
  p_organization_id uuid,
  p_name text,
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
  v_operation constant text := 'organization.rename';
  v_previous public.idempotency_keys%rowtype;
  v_organization public.organizations%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_response jsonb;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise sqlstate 'KX401' using message = 'Authentication required';
  end if;
  if not public.has_organization_role(
    p_organization_id,
    array['owner']::public.organization_role[],
    v_user_id
  ) then
    raise sqlstate 'KX403' using message = 'Only an organization owner can rename the organization';
  end if;
  if char_length(v_name) not between 2 and 160
    or char_length(p_idempotency_key) not between 8 and 160
    or p_request_hash !~ '^kxhash_[0-9a-f]{32}$' then
    raise sqlstate 'KX400' using message = 'Invalid organization rename request';
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

  select * into v_organization
  from public.organizations organization
  where organization.id = p_organization_id
  for update;
  if not found then
    raise sqlstate 'KX404' using message = 'Organization not found';
  end if;

  insert into public.idempotency_keys (
    organization_id, user_id, key, operation, request_hash
  ) values (
    p_organization_id, v_user_id, p_idempotency_key, v_operation, p_request_hash
  );
  if v_organization.name <> v_name then
    update public.organizations
    set name = v_name
    where id = p_organization_id;
    insert into public.audit_events (
      organization_id, actor_user_id, action, target_type, target_id,
      request_id, metadata, created_at
    ) values (
      p_organization_id, v_user_id, 'organization.renamed', 'organization',
      p_organization_id::text, p_idempotency_key,
      jsonb_build_object('previousName', v_organization.name, 'name', v_name), v_now
    );
  end if;

  v_response := jsonb_build_object(
    'status', 'renamed',
    'organizationId', p_organization_id,
    'name', v_name,
    'previousName', v_organization.name,
    'slug', v_organization.slug,
    'replayed', false
  );
  update public.idempotency_keys
  set response_body = v_response, response_status = 200, completed_at = v_now
  where organization_id = p_organization_id
    and user_id = v_user_id
    and key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.rename_kingxford_organization(uuid, text, text, text) from public;
grant execute on function public.rename_kingxford_organization(uuid, text, text, text) to authenticated;
