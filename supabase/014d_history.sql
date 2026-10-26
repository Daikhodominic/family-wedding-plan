-- Update 14, part D of 4. Run A, B, C, D in order (each in its own New query).
create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_action text; v_changes jsonb := '{}'::jsonb;
  k text; ik text; v_label text;
begin
  if current_setting('fwp.quiet', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    v_action := 'create'; v_new := to_jsonb(new);
    if v_new ? 'list_id' then v_changes := jsonb_build_object('_new', jsonb_build_object('list_id', v_new->'list_id')); end if;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    if (v_old->>'deleted_at') is null and (v_new->>'deleted_at') is not null then
      v_action := 'remove';
    elsif (v_old->>'deleted_at') is not null and (v_new->>'deleted_at') is null then
      v_action := 'restore';
    else
      v_action := 'update';
      for k in select jsonb_object_keys(v_new) loop
        continue when k in ('position','x','y','w','z','deleted_by','created_at','created_by');
        if k = 'data' then
          for ik in select jsonb_object_keys(coalesce(v_old->'data','{}'::jsonb) || coalesce(v_new->'data','{}'::jsonb)) loop
            if (v_old->'data'->ik) is distinct from (v_new->'data'->ik) then
              v_changes := v_changes || jsonb_build_object(ik, jsonb_build_object('old', v_old->'data'->ik, 'new', v_new->'data'->ik));
            end if;
          end loop;
        elsif (v_old->k) is distinct from (v_new->k) then
          v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
        end if;
      end loop;
      if v_changes = '{}'::jsonb then return new; end if;
    end if;
  else
    v_action := 'purge'; v_old := to_jsonb(old);
    v_changes := jsonb_build_object('_old', v_old);
  end if;
  v_label := coalesce(v_new->>'title', v_old->>'title', v_new->>'couple', v_old->>'couple',
                      v_new#>>'{data,title}', v_old#>>'{data,title}',
                      v_new#>>'{data,text}', v_old#>>'{data,text}',
                      left(coalesce(v_new#>>'{cells,0}', v_old#>>'{cells,0}'), 140));
  insert into public.activity (wedding_id, actor, actor_name, action, entity, entity_id, label, changes)
  values (coalesce(v_new->>'wedding_id', v_old->>'wedding_id',
                   (select l.wedding_id from public.lists l where l.id::text = coalesce(v_new->>'list_id', v_old->>'list_id')),
                   v_new->>'id', v_old->>'id'),
          auth.uid(), (select name from public.members where user_id = auth.uid()),
          v_action, tg_table_name, coalesce(v_new->>'id', v_old->>'id'), left(v_label, 140), v_changes);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists list_rows_log on public.list_rows;
create trigger list_rows_log after insert or update or delete on public.list_rows for each row execute function public.log_change();

-- (Live updates for locks were already switched on in your database, so that line is no longer here.)
