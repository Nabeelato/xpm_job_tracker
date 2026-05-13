import { redirect } from "next/navigation";
import { BellDot, Files, UsersRound } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/rbac";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-background lg:h-screen lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,30%)]">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_14%_18%,_hsla(var(--secondary),0.18),_transparent_16%),radial-gradient(circle_at_74%_62%,_hsla(var(--primary),0.14),_transparent_22%),linear-gradient(180deg,#fbfdff_0%,#f5f8fc_100%)] px-6 py-8 sm:px-10 lg:h-screen lg:px-14 lg:py-8">
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full border border-primary/10" />
        <div className="absolute -bottom-6 left-20 h-32 w-32 rounded-full border border-secondary/20" />
        <div className="absolute left-[18%] top-[18%] h-24 w-24 rounded-full bg-primary/6 blur-3xl" />
        <div className="relative flex min-h-[58vh] flex-col justify-between gap-8 lg:h-full lg:min-h-0 lg:gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <span className="text-sm font-semibold">TI</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Job Tracker</p>
              <p className="text-[11px] text-muted-foreground">Internal workflow workspace</p>
            </div>
          </div>

          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-primary/10 bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary shadow-sm backdrop-blur">
              Team Operations Portal
            </div>
            <h1 className="mt-6 max-w-2xl text-[2rem] font-semibold leading-[0.98] tracking-tight text-foreground sm:text-[3.1rem] xl:text-[3.7rem]">
              Keep jobs
              <br />
              moving,
              <br />
              <span className="text-primary">with clarity.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[13px] leading-5 text-muted-foreground sm:text-sm">
              One workspace for imports, assignments, review flow, follow-ups, and visibility across departments without losing the thread
              of work.
            </p>

            <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
                <div className="text-xl font-semibold tracking-tight text-foreground">CSV + XLSX</div>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Import ready</p>
              </div>
              <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
                <div className="text-xl font-semibold tracking-tight text-foreground">Role-based</div>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Review workflow</p>
              </div>
              <div className="rounded-3xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
                <div className="text-xl font-semibold tracking-tight text-foreground">Live queue</div>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status visibility</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/80 bg-white/72 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <Files className="h-5 w-5" />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">Structured imports</div>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground sm:text-xs">Preview new, updated, duplicate, and missing jobs before applying changes.</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/72 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-secondary/20 p-2 text-foreground">
                  <UsersRound className="h-5 w-5" />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">Assignment control</div>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground sm:text-xs">Coordinate managers, reviewers, supervisors, and helpers without losing ownership context.</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/72 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <BellDot className="h-5 w-5" />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">Actionable alerts</div>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground sm:text-xs">Surface stale work, missing jobs, and notifications before they turn into bottlenecks.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex items-center overflow-hidden bg-[linear-gradient(180deg,#0e1b2d_0%,#11243b_58%,#0b1727_100%)] px-6 py-10 sm:px-10 lg:h-screen lg:px-12 lg:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsla(var(--primary),0.18),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.03),_transparent_45%)]" />
        <div className="relative mx-auto w-full max-w-sm">
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/85">
            Secure sign in
          </div>
          <div className="mt-8">
            <h2 className="text-[1.4rem] font-semibold tracking-tight text-white sm:text-[1.7rem]">Welcome back</h2>
            <p className="mt-2 text-[11px] leading-5 text-slate-300 sm:text-xs">
              Sign in with your internal account to continue to the job tracking workspace.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_-34px_rgba(0,0,0,0.75)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">Access</div>
                <div className="mt-1 text-[11px] font-medium text-white sm:text-xs">Admins, managers, and staff</div>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
                Internal
              </div>
            </div>

            <LoginForm />

            <div className="mt-5 text-center text-[10px] leading-4 text-slate-400 sm:text-[11px]">
              Use the account provided by your administrator. Contact your manager if your access needs to be updated.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
