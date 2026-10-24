import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { 
  ArrowRight, 
  BookOpen, 
  Volume2, 
  PenTool, 
  Mic, 
  Award, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  BrainCircuit
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Decorative backdrop gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="border-b border-slate-900/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/15 border border-indigo-500/30 rounded-lg">
              <BrainCircuit className="h-6 w-6 text-indigo-400" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              LinguaCert AI
            </span>
          </div>

          <nav className="flex items-center space-x-4">
            {user ? (
              <Link 
                href="/dashboard" 
                className={buttonVariants({ className: "bg-indigo-600 hover:bg-indigo-500 transition duration-200 flex items-center space-x-1" })}
              >
                <span>Dashboard</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm font-medium text-slate-400 hover:text-slate-200 transition">
                  Sign In
                </Link>
                <Link 
                  href="/auth/signup" 
                  className={buttonVariants({ className: "bg-indigo-600 hover:bg-indigo-500 transition duration-200" })}
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/5 text-indigo-400 text-xs font-semibold tracking-wide uppercase mb-6 animate-pulse">
            <Award className="h-4 w-4" />
            <span>Accurate CEFR Standardized Scales</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Measure Your English Proficiency <br className="hidden sm:inline" />
            With <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">AI Precision</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            Get an instant, robust, and verifiable evaluation of your Reading, Listening, Writing, and Speaking skills, completely aligned with the global CEFR framework.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href={user ? '/dashboard' : '/auth/signup'} 
              className={buttonVariants({ 
                size: 'lg', 
                className: "bg-indigo-600 hover:bg-indigo-500 text-base font-semibold px-8 py-6 rounded-xl shadow-lg shadow-indigo-500/20 transition duration-200 w-full sm:w-auto flex items-center justify-center space-x-2" 
              })}
            >
              <span>{user ? 'Go to Dashboard' : 'Take Free Test'}</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a 
              href="#how-it-works" 
              className="text-sm font-semibold text-slate-400 hover:text-slate-200 transition py-3 px-6 flex items-center space-x-1"
            >
              <span>Learn how it works</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Skills Grid Section */}
      <section className="py-20 border-t border-slate-900/60 bg-slate-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Complete Four-Skill Evaluation Suite
            </h2>
            <p className="mt-4 text-slate-400 font-light">
              Unlike basic tests, LinguaCert AI covers all core dimensions of linguistic competency using optimized assessment models.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Reading */}
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/40 backdrop-blur-sm hover:border-slate-800 transition duration-200">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl w-fit text-blue-400 mb-6">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Reading Section</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light">
                Adaptive comprehension passages and grammar evaluations that scale in difficulty based on response accuracy.
              </p>
            </div>

            {/* Listening */}
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/40 backdrop-blur-sm hover:border-slate-800 transition duration-200">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl w-fit text-indigo-400 mb-6">
                <Volume2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Listening Section</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light">
                High-fidelity audio playback with interactive multiple-choice assessment to evaluate auditory language processing.
              </p>
            </div>

            {/* Writing */}
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/40 backdrop-blur-sm hover:border-slate-800 transition duration-200">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-fit text-emerald-400 mb-6">
                <PenTool className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Writing Evaluation</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light">
                Open-ended essay interface evaluating spelling, lexicon richness, structural coherence, and topical alignment.
              </p>
            </div>

            {/* Speaking */}
            <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/40 backdrop-blur-sm hover:border-slate-800 transition duration-200">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl w-fit text-amber-400 mb-6">
                <Mic className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Speaking Analysis</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light">
                Direct audio recordings analyzing pronunciation metrics, cadence, disfluency counts, and syntactic layout.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works / CEFR mapping */}
      <section id="how-it-works" className="py-20 border-t border-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight text-white leading-tight">
                Computerized Adaptive Testing aligned to CEFR Levels
              </h2>
              <p className="text-slate-400 font-light leading-relaxed">
                LinguaCert AI uses an adaptive question delivery protocol. Starting at a baseline level (B1), the difficulty shifts dynamically after each question:
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-1 p-1 bg-indigo-500/15 border border-indigo-500/30 rounded text-indigo-400">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Dynamic Item Selection</h4>
                    <p className="text-sm text-slate-400 font-light">Correct answers route to more challenging questions. Incorrect responses recalibrate downward to isolate your capability fast.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="mt-1 p-1 bg-emerald-500/15 border border-emerald-500/30 rounded text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">No Mock Grading System</h4>
                    <p className="text-sm text-slate-400 font-light">Grading models use accurate psychometric scales (0–100 mapped to standard A1 to C2 tiers) without artificial grade inflation.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="mt-1 p-1 bg-blue-500/15 border border-blue-500/30 rounded text-blue-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Secure Verification Page</h4>
                    <p className="text-sm text-slate-400 font-light">Every certificate yields a cryptographically generated verification code verifiable directly on the platform by colleges or recruiters.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual representation of CEFR levels */}
            <div className="p-8 rounded-2xl border border-slate-900 bg-slate-900/30 backdrop-blur-sm space-y-6">
              <h3 className="font-bold text-white text-lg border-b border-slate-800 pb-3">CEFR Reference Scale Mapping</h3>
              <div className="space-y-3">
                {[
                  { level: 'C2', desc: 'Proficient User (Mastery)', score: '91-100', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                  { level: 'C1', desc: 'Advanced User (Effective)', score: '81-90', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
                  { level: 'B2', desc: 'Independent User (Vantage)', score: '61-80', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                  { level: 'B1', desc: 'Independent User (Threshold)', score: '41-60', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
                  { level: 'A2', desc: 'Basic User (Waystage)', score: '21-40', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
                  { level: 'A1', desc: 'Basic User (Breakthrough)', score: '0-20', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
                ].map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${item.color}`}>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-lg">{item.level}</span>
                      <span className="text-xs font-light opacity-90">{item.desc}</span>
                    </div>
                    <span className="text-xs font-semibold">Score: {item.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} LinguaCert AI. All rights reserved.</p>
        <p className="mt-2 text-slate-600 font-light">Built for standardized, verifiable language assessment.</p>
      </footer>
    </div>
  )
}
