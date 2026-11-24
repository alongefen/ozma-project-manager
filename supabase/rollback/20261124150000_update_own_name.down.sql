-- Rollback for 20261124150000_update_own_name.sql. NOT a migration: run by hand, only after Alon's yes.
-- Removes only the function. Names already changed stay as they are; 'user.updated' audit rows stay.
-- After this, non-owners can no longer edit their own name (switch NON_OWNER_CAN_EDIT_OWN_NAME back to false first).
begin;
drop function if exists public.update_own_name(jsonb);
commit;
