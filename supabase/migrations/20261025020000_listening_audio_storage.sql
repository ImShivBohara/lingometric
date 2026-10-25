-- The listening admin form uploads to this bucket and uses public playback URLs.
-- Preserve existing bucket settings and files; provision the bucket on fresh setups.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('listening-audio', 'listening-audio', true, 10485760,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4',
        'audio/x-m4a', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Listening audio public playback" ON storage.objects;
CREATE POLICY "Listening audio public playback" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'listening-audio');

DROP POLICY IF EXISTS "Listening audio admin insert" ON storage.objects;
CREATE POLICY "Listening audio admin insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'listening-audio' AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);
DROP POLICY IF EXISTS "Listening audio admin update" ON storage.objects;
CREATE POLICY "Listening audio admin update" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'listening-audio' AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
) WITH CHECK (
  bucket_id = 'listening-audio' AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);
DROP POLICY IF EXISTS "Listening audio admin delete" ON storage.objects;
CREATE POLICY "Listening audio admin delete" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'listening-audio' AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);
