-- Update 14, part C of 4. Run A, B, C, D in order (each in its own New query).
drop policy if exists "role insert stages" on public.stages;
drop policy if exists "role update stages" on public.stages;
drop policy if exists "role delete stages" on public.stages;
create policy "role insert stages" on public.stages as restrictive for insert to authenticated with check (public.may_write('stages') and not public.is_held('budgets', null::text));
create policy "role update stages" on public.stages as restrictive for update to authenticated using (public.may_write('stages') and not public.is_held('budgets', null::text)) with check (public.may_write('stages') and not public.is_held('budgets', null::text));
create policy "role delete stages" on public.stages as restrictive for delete to authenticated using (public.may_write('stages') and not public.is_held('budgets', null::text));

drop policy if exists "role insert areas" on public.areas;
drop policy if exists "role update areas" on public.areas;
drop policy if exists "role delete areas" on public.areas;
create policy "role insert areas" on public.areas as restrictive for insert to authenticated with check (public.may_write('areas') and not public.is_held('areas', id::text));
create policy "role update areas" on public.areas as restrictive for update to authenticated using (public.may_write('areas') and not public.is_held('areas', id::text)) with check (public.may_write('areas') and not public.is_held('areas', id::text));
create policy "role delete areas" on public.areas as restrictive for delete to authenticated using (public.may_write('areas') and not public.is_held('areas', id::text));

drop policy if exists "role insert steps" on public.steps;
drop policy if exists "role update steps" on public.steps;
drop policy if exists "role delete steps" on public.steps;
create policy "role insert steps" on public.steps as restrictive for insert to authenticated with check (public.may_write('steps') and not public.is_held('areas', area_id::text));
create policy "role update steps" on public.steps as restrictive for update to authenticated using (public.may_write('steps') and not public.is_held('areas', area_id::text)) with check (public.may_write('steps') and not public.is_held('areas', area_id::text));
create policy "role delete steps" on public.steps as restrictive for delete to authenticated using (public.may_write('steps') and not public.is_held('areas', area_id::text));

drop policy if exists "role insert todos" on public.todos;
drop policy if exists "role update todos" on public.todos;
drop policy if exists "role delete todos" on public.todos;
create policy "role insert todos" on public.todos as restrictive for insert to authenticated with check (public.may_write('todos') and not public.is_held('budgets', null::text));
create policy "role update todos" on public.todos as restrictive for update to authenticated using (public.may_write('todos') and not public.is_held('budgets', null::text)) with check (public.may_write('todos') and not public.is_held('budgets', null::text));
create policy "role delete todos" on public.todos as restrictive for delete to authenticated using (public.may_write('todos') and not public.is_held('budgets', null::text));

drop policy if exists "role insert board_items" on public.board_items;
drop policy if exists "role update board_items" on public.board_items;
drop policy if exists "role delete board_items" on public.board_items;
create policy "role insert board_items" on public.board_items as restrictive for insert to authenticated with check (public.may_write('board_items') and not public.is_held('budgets', null::text));
create policy "role update board_items" on public.board_items as restrictive for update to authenticated using (public.may_write('board_items') and not public.is_held('budgets', null::text)) with check (public.may_write('board_items') and not public.is_held('budgets', null::text));
create policy "role delete board_items" on public.board_items as restrictive for delete to authenticated using (public.may_write('board_items') and not public.is_held('budgets', null::text));

drop policy if exists "role insert files" on public.files;
drop policy if exists "role update files" on public.files;
drop policy if exists "role delete files" on public.files;
create policy "role insert files" on public.files as restrictive for insert to authenticated with check (public.may_write('files') and not public.is_held('budgets', null::text));
create policy "role update files" on public.files as restrictive for update to authenticated using (public.may_write('files') and not public.is_held('budgets', null::text)) with check (public.may_write('files') and not public.is_held('budgets', null::text));
create policy "role delete files" on public.files as restrictive for delete to authenticated using (public.may_write('files') and not public.is_held('budgets', null::text));

drop policy if exists "role insert lists" on public.lists;
drop policy if exists "role update lists" on public.lists;
drop policy if exists "role delete lists" on public.lists;
create policy "role insert lists" on public.lists as restrictive for insert to authenticated with check (public.may_write('lists') and not public.is_held('lists', id::text));
create policy "role update lists" on public.lists as restrictive for update to authenticated using (public.may_write('lists') and not public.is_held('lists', id::text)) with check (public.may_write('lists') and not public.is_held('lists', id::text));
create policy "role delete lists" on public.lists as restrictive for delete to authenticated using (public.may_write('lists') and not public.is_held('lists', id::text));

drop policy if exists "role insert list_rows" on public.list_rows;
drop policy if exists "role update list_rows" on public.list_rows;
drop policy if exists "role delete list_rows" on public.list_rows;
create policy "role insert list_rows" on public.list_rows as restrictive for insert to authenticated with check (public.may_write('list_rows') and not public.is_held('lists', list_id::text));
create policy "role update list_rows" on public.list_rows as restrictive for update to authenticated using (public.may_write('list_rows') and not public.is_held('lists', list_id::text)) with check (public.may_write('list_rows') and not public.is_held('lists', list_id::text));
create policy "role delete list_rows" on public.list_rows as restrictive for delete to authenticated using (public.may_write('list_rows') and not public.is_held('lists', list_id::text));

drop policy if exists "role insert budgets" on public.budgets;
drop policy if exists "role update budgets" on public.budgets;
drop policy if exists "role delete budgets" on public.budgets;
create policy "role insert budgets" on public.budgets as restrictive for insert to authenticated with check (public.may_write('budgets') and not public.is_held('budgets', id::text));
create policy "role update budgets" on public.budgets as restrictive for update to authenticated using (public.may_write('budgets') and not public.is_held('budgets', id::text)) with check (public.may_write('budgets') and not public.is_held('budgets', id::text));
create policy "role delete budgets" on public.budgets as restrictive for delete to authenticated using (public.may_write('budgets') and not public.is_held('budgets', id::text));

drop policy if exists "role insert budget_areas" on public.budget_areas;
drop policy if exists "role update budget_areas" on public.budget_areas;
drop policy if exists "role delete budget_areas" on public.budget_areas;
create policy "role insert budget_areas" on public.budget_areas as restrictive for insert to authenticated with check (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text));
create policy "role update budget_areas" on public.budget_areas as restrictive for update to authenticated using (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text)) with check (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text));
create policy "role delete budget_areas" on public.budget_areas as restrictive for delete to authenticated using (public.may_write('budget_areas') and not public.is_held('budgets', budget_id::text));

drop policy if exists "role insert budget_items" on public.budget_items;
drop policy if exists "role update budget_items" on public.budget_items;
drop policy if exists "role delete budget_items" on public.budget_items;
create policy "role insert budget_items" on public.budget_items as restrictive for insert to authenticated with check (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text));
create policy "role update budget_items" on public.budget_items as restrictive for update to authenticated using (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text)) with check (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text));
create policy "role delete budget_items" on public.budget_items as restrictive for delete to authenticated using (public.may_write('budget_items') and not public.is_held('budgets', budget_id::text));

drop policy if exists "role insert weddings" on public.weddings;
drop policy if exists "role update weddings" on public.weddings;
drop policy if exists "role delete weddings" on public.weddings;
create policy "role insert weddings" on public.weddings as restrictive for insert to authenticated with check (public.may_write('weddings') and not public.is_held('budgets', null::text));
create policy "role update weddings" on public.weddings as restrictive for update to authenticated using (public.may_write('weddings') and not public.is_held('budgets', null::text)) with check (public.may_write('weddings') and not public.is_held('budgets', null::text));
create policy "role delete weddings" on public.weddings as restrictive for delete to authenticated using (public.may_write('weddings') and not public.is_held('budgets', null::text));

drop policy if exists "role uploads media" on storage.objects;
create policy "role uploads media" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'media' or public.my_role() in ('full', 'lists'));
