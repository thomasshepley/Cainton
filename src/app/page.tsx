import Link from "next/link";
import { site } from "@/lib/site";

/** Splash page: names, date, venue, and the door into the RSVP flow. */
export default function SplashPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* soft background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 38%, rgba(176,141,87,0.10), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-2xl">
        <p className="animate-rise font-body text-[0.8rem] tracking-[0.45em] uppercase text-ink-soft">
          Together with their families
        </p>

        <h1 className="animate-rise-slow delay-1 font-display mt-8 text-6xl leading-tight font-medium sm:text-7xl md:text-8xl">
          {site.coupleNames}
        </h1>

        <p className="animate-rise delay-2 font-display mt-4 text-2xl italic text-ink-soft sm:text-3xl">
          {site.tagline}
        </p>

        <div className="animate-rise delay-2 ornament mx-auto mt-10 w-56 text-sm">
          ◆
        </div>

        <div className="animate-rise delay-3 mt-10 space-y-2">
          <p className="font-display text-xl tracking-wide sm:text-2xl">
            {site.dateDisplay}
          </p>
          <p className="text-sm tracking-[0.2em] uppercase text-ink-soft">
            {site.venueName} · {site.venueLocation}
          </p>
        </div>

        <div className="animate-rise delay-4 mt-14">
          <Link
            href="/rsvp"
            className="inline-block border border-sage-dark bg-sage-dark px-12 py-4 text-sm tracking-[0.35em] uppercase text-cream transition-all duration-300 hover:bg-transparent hover:text-sage-dark"
          >
            RSVP
          </Link>
          <p className="mt-6 text-xs tracking-[0.15em] uppercase text-ink-soft">
            Kindly respond by {site.rsvpDeadlineDisplay}
          </p>
        </div>
      </div>
    </main>
  );
}
