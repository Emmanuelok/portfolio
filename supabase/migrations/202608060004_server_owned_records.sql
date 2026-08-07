-- Kingxford server-owned record and private-object boundary hardening.
--
-- This migration is intentionally additive for deployments that may already
-- have applied the original cloud foundation. Browser sessions keep RLS-bound
-- read access, while durable run results, metering, audit history, and private
-- evidence bytes are written only by guarded RPCs or authenticated application
-- routes using the server-only service role.

drop policy if exists kingxford_private_select on storage.objects;
drop policy if exists kingxford_private_insert on storage.objects;
drop policy if exists kingxford_private_update on storage.objects;
drop policy if exists kingxford_private_delete on storage.objects;

revoke select, insert, update, delete on storage.objects from authenticated;
revoke all on function public.can_access_kingxford_storage(text, boolean)
  from authenticated;

revoke insert, update on public.intelligence_runs from authenticated;
revoke insert on public.audit_events from authenticated;
revoke insert on public.usage_records from authenticated;
revoke usage, select on sequence public.usage_records_id_seq from authenticated;

grant select on public.intelligence_runs to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.usage_records to authenticated;
