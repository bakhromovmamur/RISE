-- Allow the full documented Unicode title/area/reason/unit bounds together.
-- The request remains limited to 64 KiB; no accepted text is truncated.
alter table rise.habits drop constraint habits_data_check;
alter table rise.habits add constraint habits_data_check check (
  rise_private.personal_json(data,
    array['name','icon','area','reason','type','unit','created','archivedAt'],
    array['name','icon','area','reason','type','unit','created'], 32768)
  and data->>'type' in ('count','duration','check') and char_length(data->>'name') between 1 and 160
);
