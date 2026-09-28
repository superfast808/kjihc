import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
const logo = `${BASE}/logo.png`

export default function Landing() {
  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ background: "#0b1936", color: "#fff" }}>

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-[#0b1936]/80 backdrop-blur-md shadow-sm"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <img src={logo} alt="KJIHC" className="h-12 w-auto" />

        <nav className="flex items-center gap-2 md:gap-6">
          <a
            href={`${BASE}/join`}
            className="hidden md:inline text-sm font-semibold tracking-wide text-white/80 hover:text-white transition-colors uppercase"
          >
            Join Club
          </a>
          <a
            href="https://join.kjihc.org/parent-login"
            className="hidden md:inline text-sm font-semibold tracking-wide text-white/80 hover:text-white transition-colors uppercase"
          >
            Parent Portal
          </a>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors"
            style={{ background: "#f6a800", color: "#0b1936" }}
          >
            Staff Login
          </Link>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative flex-1 flex flex-col justify-center overflow-hidden px-6 md:px-12 py-12 md:py-16">

        {/* Diagonal grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 60px)",
          }}
        />

        {/* Giant watermark */}
        <div
          className="absolute bottom-0 left-0 right-0 overflow-hidden select-none pointer-events-none"
          aria-hidden="true"
          style={{ lineHeight: 1 }}
        >
          <span
            className="block font-black uppercase tracking-tighter whitespace-nowrap"
            style={{
              fontSize: "clamp(80px, 22vw, 260px)",
              color: "rgba(255,255,255,0.04)",
              letterSpacing: "-0.04em",
              transform: "translateY(18%)",
            }}
          >
            KILMARNOCK
          </span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-3xl">
          {/* Pill tag */}
          <div className="mb-6 inline-flex">
            <span
              className="text-xs font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-sm"
              style={{ border: "1px solid rgba(246,168,0,0.5)", color: "#f6a800" }}
            >
              Grassroots to Senior Hockey
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-black uppercase leading-none mb-6"
            style={{ fontSize: "clamp(2.8rem, 8vw, 6.5rem)", letterSpacing: "-0.02em" }}
          >
            PRIDE.{" "}
            <br className="hidden sm:block" />
            PASSION.{" "}
            <span style={{ color: "#f6a800" }}>PUCK.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/65 max-w-xl mb-10 leading-relaxed">
            Kilmarnock's premier ice hockey club. Developing players from their very first steps on the ice all the way through competitive age-group teams.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={`${BASE}/join`}
              className="inline-flex items-center justify-center rounded px-8 py-3.5 text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-90 shadow-lg"
              style={{ background: "#f6a800", color: "#0b1936" }}
            >
              Join the Club
            </a>
            <a
              href="https://join.kjihc.org/parent-login"
              className="inline-flex items-center justify-center rounded px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/10"
              style={{ border: "2px solid rgba(255,255,255,0.35)" }}
            >
              Parent Portal
            </a>
          </div>
        </div>
      </section>

      {/* ── Wave divider ───────────────────────────────────────── */}
      <div className="relative" style={{ background: "#0b1936" }}>
        <svg
          viewBox="0 0 1440 60"
          xmlns="http://www.w3.org/2000/svg"
          className="block w-full"
          preserveAspectRatio="none"
          style={{ height: 60, display: "block" }}
        >
          <path
            d="M0,0 C360,60 1080,60 1440,0 L1440,60 L0,60 Z"
            fill="#f0f4f8"
          />
        </svg>
      </div>

      {/* ── Info cards ─────────────────────────────────────────── */}
      <section style={{ background: "#f0f4f8" }} className="py-20 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "Learn to Play",
                body: "New to the ice? Our LTP sessions get beginners comfortable on skates and build the foundations of the game in a safe, fun environment.",
              },
              {
                num: "02",
                title: "Competitive Teams",
                body: "From U10 to U19, our teams compete regularly across Scotland. We focus on teamwork, discipline, and advancing individual skills.",
              },
              {
                num: "03",
                title: "Community First",
                body: "A family-run club where parents, coaches, and players all pull together. KJIHC is a welcoming place for every skater.",
              },
            ].map(({ num, title, body }) => (
              <div
                key={num}
                className="rounded-lg p-8"
                style={{ background: "#fff", borderTop: "4px solid #f6a800" }}
              >
                <span
                  className="block font-black text-4xl mb-4"
                  style={{ color: "#e8edf5", fontVariantNumeric: "tabular-nums" }}
                >
                  {num}
                </span>
                <h3 className="font-black text-xl uppercase tracking-wide mb-3" style={{ color: "#0b1936" }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#5a6a80" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────── */}
      <section
        className="py-16 px-6 md:px-12 text-center"
        style={{ background: "#0b1936" }}
      >
        <p
          className="text-xs font-bold uppercase tracking-[0.18em] mb-4"
          style={{ color: "#f6a800" }}
        >
          Ready to get on the ice?
        </p>
        <h2
          className="font-black uppercase mb-8"
          style={{
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          Register your player today.
        </h2>
        <a
          href={`${BASE}/join`}
          className="inline-flex items-center justify-center rounded px-10 py-4 text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-90 shadow-lg"
          style={{ background: "#f6a800", color: "#0b1936" }}
        >
          Start Registration
        </a>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        className="py-8 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 text-sm"
        style={{ background: "#07101f", color: "rgba(255,255,255,0.4)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <img src={logo} alt="KJIHC" className="h-7 w-auto opacity-70" />
          <span>© {new Date().getFullYear()} Kilmarnock Junior Ice Hockey Club</span>
        </div>
        <div className="flex gap-6">
          <a href={`${BASE}/join`} className="hover:text-white transition-colors">Join</a>
          <a href="https://join.kjihc.org/parent-login" className="hover:text-white transition-colors">Parent Portal</a>
          <Link href="/sign-in" className="hover:text-white transition-colors">Staff Access</Link>
        </div>
      </footer>

    </div>
  )
}
