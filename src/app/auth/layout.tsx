import React from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Decorative blur gradients */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            LingoMetric
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Know Your English Level
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
