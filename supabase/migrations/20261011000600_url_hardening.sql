-- URLs that end up in href/src must be http(s): no javascript:, data: or other schemes.
alter table public.markets
  add constraint markets_proof_url_http
  check (resolution_proof_url is null or resolution_proof_url ~* '^https?://[^\s]+$');

alter table public.profiles
  add constraint profiles_avatar_url_https
  check (avatar_url is null or avatar_url ~* '^https://[^\s]+$');
