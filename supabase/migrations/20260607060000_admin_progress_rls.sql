-- 1. Configure RLS SELECT policy for admin on responses
DROP POLICY IF EXISTS "Admins can select all responses" ON public.responses;
CREATE POLICY "Admins can select all responses" ON public.responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- 2. Configure RLS SELECT policy for admin on listening_responses
DROP POLICY IF EXISTS "Admins can select all listening responses" ON public.listening_responses;
CREATE POLICY "Admins can select all listening responses" ON public.listening_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- 3. Configure RLS SELECT policy for admin on writing_evaluations
DROP POLICY IF EXISTS "Admins can select all writing evaluations" ON public.writing_evaluations;
CREATE POLICY "Admins can select all writing evaluations" ON public.writing_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- 4. Configure RLS SELECT policy for admin on speaking_evaluations
DROP POLICY IF EXISTS "Admins can select all speaking evaluations" ON public.speaking_evaluations;
CREATE POLICY "Admins can select all speaking evaluations" ON public.speaking_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );
