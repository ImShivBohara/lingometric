'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'
import { signupAction } from '@/features/auth/actions'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

const initialState = {
  success: false,
  message: '',
  error: '',
}

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState)

  return (
    <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl text-slate-100">
      <CardHeader>
        <CardTitle className="text-xl text-center font-bold">Create Account</CardTitle>
        <CardDescription className="text-center text-slate-400">
          Get certified on CEFR English scales today
        </CardDescription>
      </CardHeader>
      
      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <div className="p-3 text-sm rounded-md bg-red-950/50 border border-red-800 text-red-200">
              {state.error}
            </div>
          )}

          {state?.success && state?.message && (
            <div className="p-3 text-sm rounded-md bg-emerald-950/50 border border-emerald-800 text-emerald-200">
              {state.message}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Alex Carter"
              required
              className="bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              className="bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-600"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition duration-200"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Sign Up'
            )}
          </Button>

          <p className="text-xs text-center text-slate-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-indigo-400 hover:underline">
              Sign In
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
