DROP POLICY IF EXISTS "Admins can select all attempts" ON public.attempts;

CREATE POLICY "Admins can select all attempts"
ON public.attempts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
