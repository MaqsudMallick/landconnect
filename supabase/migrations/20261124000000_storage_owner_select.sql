create policy "Owners see their own listing images and avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
