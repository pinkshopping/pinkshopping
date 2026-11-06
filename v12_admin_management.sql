-- Pink Shopping V12: secure, equal-permission admin management.
-- Run once in Supabase SQL Editor. Requires public.admins and public.is_admin() from existing setup.
-- This does NOT create Auth users. Invite/create them in Supabase Authentication > Users first.

create or replace function public.admin_list_accounts()
returns table(user_id uuid, email text)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only';
  end if;
  return query
  select a.user_id, u.email::text
  from public.admins a join auth.users u on u.id = a.user_id
  order by u.email;
end;
$$;

create or replace function public.admin_add_by_email(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_email is null or length(btrim(p_email)) < 3 then
    raise exception 'Invalid email';
  end if;
  select id into v_user_id from auth.users
  where lower(email) = lower(btrim(p_email)) limit 1;
  if v_user_id is null then
    raise exception 'User not found. First invite or create this email in Authentication > Users.';
  end if;
  insert into public.admins(user_id) values(v_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.admin_remove_account(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'Cannot remove your own admin access';
  end if;
  -- Lock the admin table against concurrent removals, preventing zero admins.
  lock table public.admins in share row exclusive mode;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;
  delete from public.admins where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_list_accounts() from public, anon;
revoke all on function public.admin_add_by_email(text) from public, anon;
revoke all on function public.admin_remove_account(uuid) from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_add_by_email(text) to authenticated;
grant execute on function public.admin_remove_account(uuid) to authenticated;
