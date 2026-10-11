-- New auth users get a profile and the 1,000-coin signup bonus.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  insert into public.profiles (id, display_name, avatar_url, school_domain, meta)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 40),
    new.raw_user_meta_data ->> 'avatar_url',
    case when v_domain like '%.edu' then v_domain end,
    case when new.raw_app_meta_data ->> 'seed' = 'true'
         then jsonb_build_object('seed', true) else '{}'::jsonb end
  );
  perform public.post_ledger(new.id, 1000, 'signup_bonus', 'profile', new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Close markets whose closes_at has passed, every minute. Guarded so the
-- migrations also apply to Postgres builds without pg_cron (plain CI Postgres).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('close-due-markets', '* * * * *', 'select public.close_due_markets()');
  else
    raise notice 'pg_cron not available; schedule public.close_due_markets() some other way';
  end if;
end;
$$;
