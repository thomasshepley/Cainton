"use client";

import { useState } from "react";
import Link from "next/link";
import { site } from "@/lib/site";

/* ---------- types shared with the API ---------- */

interface PartyMember {
  id: number;
  full_name: string;
  menu: string;
  previous: { attending: boolean; meal: string | null } | null;
}

interface Party {
  id: number;
  label: string;
  inviteType: "full" | "evening";
  members: PartyMember[];
  previousComment: string | null;
  previousSongRequest: string | null;
}

interface Candidate {
  id: number;
  full_name: string;
}

type Step =
  | "name"
  | "choices"
  | "not_found"
  | "attendance"
  | "details"
  | "done";

type Answers = Record<number, { attending: boolean | null; meal: string | null }>;

/* ---------- shared UI bits ---------- */

function StepShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise w-full max-w-xl">
      <p className="text-center text-[0.7rem] tracking-[0.4em] uppercase text-gold">
        {eyebrow}
      </p>
      <h2 className="font-display mt-3 text-center text-4xl font-medium sm:text-5xl">
        {title}
      </h2>
      <div className="ornament mx-auto mt-6 w-40 text-xs">◆</div>
      <div className="mt-10">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full border border-sage-dark bg-sage-dark px-8 py-4 text-sm tracking-[0.3em] uppercase text-cream transition-all duration-300 enabled:hover:bg-transparent enabled:hover:text-sage-dark disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-6 block text-xs tracking-[0.2em] uppercase text-ink-soft underline-offset-4 hover:underline"
    >
      ← {label}
    </button>
  );
}

/* ---------- the flow ---------- */

export default function RsvpPage() {
  const [step, setStep] = useState<Step>("name");
  const [nameInput, setNameInput] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [matchedName, setMatchedName] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [comment, setComment] = useState("");
  const [songRequest, setSongRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hadPreviousResponse =
    party?.members.some((m) => m.previous !== null) ?? false;

  function enterParty(p: Party, matched: string) {
    setParty(p);
    setMatchedName(matched);
    const initial: Answers = {};
    for (const m of p.members) {
      initial[m.id] = m.previous
        ? { attending: m.previous.attending, meal: m.previous.meal }
        : { attending: null, meal: null };
    }
    setAnswers(initial);
    setComment(p.previousComment ?? "");
    setSongRequest(p.previousSongRequest ?? "");
    setStep("attendance");
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        return;
      }
      if (data.status === "match" && data.party) {
        enterParty(data.party, data.match.full_name);
      } else if (data.status === "choices") {
        setCandidates(data.candidates);
        setStep("choices");
      } else {
        setStep("not_found");
      }
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function pickCandidate(c: Candidate) {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: c.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        return;
      }
      enterParty(data.party, c.full_name);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const allAnswered =
    party !== null &&
    party.members.every((m) => answers[m.id]?.attending !== null);
  const attendingMembers =
    party?.members.filter((m) => answers[m.id]?.attending === true) ?? [];
  const anyAttending = attendingMembers.length > 0;
  // Meal choices only apply to full-day guests (the sit-down wedding
  // breakfast) — evening guests go straight to the note step
  const mealsApply = anyAttending && party?.inviteType === "full";
  const allMealsChosen =
    !mealsApply ||
    attendingMembers.every((m) => answers[m.id]?.meal !== null);

  async function submit() {
    if (!party || busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: party.id,
          submittedBy: matchedName || nameInput,
          comment,
          songRequest,
          answers: party.members.map((m) => ({
            guestId: m.id,
            attending: answers[m.id]?.attending === true,
            meal: answers[m.id]?.meal ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        return;
      }
      setStep("done");
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function resetToName() {
    setStep("name");
    setCandidates([]);
    setParty(null);
    setMatchedName("");
    setError("");
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-14 sm:py-20">
      <Link
        href="/"
        className="font-display mb-12 text-2xl italic text-ink-soft transition-colors hover:text-ink"
      >
        {site.coupleNames}
      </Link>

      {step === "name" && (
        <StepShell eyebrow="RSVP" title="Find your invitation">
          <form onSubmit={lookup} className="space-y-6">
            <p className="text-center text-sm leading-relaxed text-ink-soft">
              Please enter your first and last name as it appears on your
              invitation.
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Jane Smith"
              autoFocus
              className="font-display w-full border-b border-ink-soft/40 bg-transparent px-2 py-3 text-center text-2xl outline-none transition-colors placeholder:text-ink-soft/40 focus:border-gold"
            />
            {error && (
              <p className="text-center text-sm text-red-700">{error}</p>
            )}
            <PrimaryButton type="submit" disabled={busy || nameInput.trim().length < 2}>
              {busy ? "Searching…" : "Find my invitation"}
            </PrimaryButton>
          </form>
        </StepShell>
      )}

      {step === "choices" && (
        <StepShell eyebrow="RSVP" title="Is this you?">
          <p className="text-center text-sm leading-relaxed text-ink-soft">
            We found a few names close to “{nameInput.trim()}”. Please choose
            yours:
          </p>
          <div className="mt-8 space-y-3">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCandidate(c)}
                disabled={busy}
                className="font-display block w-full border border-ink-soft/25 bg-white/60 px-6 py-4 text-xl transition-all duration-200 hover:border-gold hover:bg-gold-light disabled:opacity-50"
              >
                {c.full_name}
              </button>
            ))}
          </div>
          {error && (
            <p className="mt-4 text-center text-sm text-red-700">{error}</p>
          )}
          <button
            type="button"
            onClick={() => setStep("not_found")}
            className="mx-auto mt-8 block text-xs tracking-[0.2em] uppercase text-ink-soft underline-offset-4 hover:underline"
          >
            None of these are me
          </button>
          <BackLink onClick={resetToName} label="Search again" />
        </StepShell>
      )}

      {step === "not_found" && (
        <StepShell eyebrow="RSVP" title="Hmm, we couldn't find you">
          <div className="space-y-6 text-center text-sm leading-relaxed text-ink-soft">
            <p>
              We couldn&apos;t find a matching name on the guest list. Try
              entering your name exactly as it appears on your invitation — or
              try a family member&apos;s name from your household.
            </p>
            <p>
              Still stuck? Reach out to us at{" "}
              <a
                href={`mailto:${site.contactEmail}`}
                className="text-sage-dark underline underline-offset-4"
              >
                {site.contactEmail}
              </a>{" "}
              and we&apos;ll get you sorted.
            </p>
          </div>
          <div className="mt-10">
            <PrimaryButton onClick={resetToName}>Try again</PrimaryButton>
          </div>
        </StepShell>
      )}

      {step === "attendance" && party && (
        <StepShell eyebrow="We found you" title={party.label}>
          {hadPreviousResponse && (
            <p className="mb-6 border border-gold/40 bg-gold-light px-4 py-3 text-center text-xs tracking-wide text-ink-soft">
              You&apos;ve responded before — your previous answers are shown
              below and you&apos;re welcome to update them.
            </p>
          )}
          <p className="border border-sage-dark/30 bg-sage-light px-4 py-3 text-center text-sm leading-relaxed text-sage-dark">
            {site.inviteInfo[party.inviteType]}
          </p>
          <p className="mt-6 text-center text-sm leading-relaxed text-ink-soft">
            Please let us know who will be joining us on {site.dateDisplay}.
          </p>
          <div className="mt-8 space-y-5">
            {party.members.map((m) => {
              const a = answers[m.id];
              return (
                <div
                  key={m.id}
                  className="border border-ink-soft/20 bg-white/60 p-5"
                >
                  <p className="font-display text-center text-2xl">
                    {m.full_name}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [m.id]: { ...prev[m.id], attending: true },
                        }))
                      }
                      className={`border px-4 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-200 ${
                        a?.attending === true
                          ? "border-sage-dark bg-sage-dark text-cream"
                          : "border-ink-soft/30 text-ink-soft hover:border-sage-dark hover:text-sage-dark"
                      }`}
                    >
                      Joyfully accepts
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [m.id]: { ...prev[m.id], attending: false, meal: null },
                        }))
                      }
                      className={`border px-4 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-200 ${
                        a?.attending === false
                          ? "border-ink bg-ink text-cream"
                          : "border-ink-soft/30 text-ink-soft hover:border-ink hover:text-ink"
                      }`}
                    >
                      Regretfully declines
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-10">
            <PrimaryButton
              onClick={() => setStep("details")}
              disabled={!allAnswered}
            >
              Continue
            </PrimaryButton>
            {!allAnswered && (
              <p className="mt-3 text-center text-xs text-ink-soft">
                Please answer for each guest to continue.
              </p>
            )}
          </div>
          <BackLink onClick={resetToName} label="Not your party? Search again" />
        </StepShell>
      )}

      {step === "details" && party && (
        <StepShell
          eyebrow={anyAttending ? "Wonderful!" : "We'll miss you"}
          title={
            mealsApply
              ? "Choose your meals"
              : anyAttending
                ? "One last thing"
                : "Leave us a note?"
          }
        >
          {mealsApply ? (
            <div className="space-y-10">
              {attendingMembers.map((m) => {
                // The menu is assigned by the couple (via the admin
                // dashboard) — guests choose a dish from their menu only
                const guestMenu =
                  site.menus.find((menu) => menu.id === m.menu) ??
                  site.menus[0];
                return (
                  <div key={m.id}>
                    <p className="font-display mb-1 text-center text-2xl">
                      {m.full_name}
                    </p>
                    {guestMenu.id !== "adult" && (
                      <p className="mb-3 text-center text-[0.65rem] tracking-[0.25em] uppercase text-gold">
                        {guestMenu.label}
                      </p>
                    )}
                    <div className="mt-3 space-y-3">
                      {guestMenu.mealOptions.map((meal) => {
                        const selected = answers[m.id]?.meal === meal.id;
                        return (
                          <button
                            key={meal.id}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [m.id]: { ...prev[m.id], meal: meal.id },
                              }))
                            }
                            className={`relative block w-full border p-4 text-left transition-all duration-200 ${
                              selected
                                ? "border-sage-dark bg-sage-light"
                                : "border-ink-soft/20 bg-white/60 hover:border-sage-dark/60"
                            }`}
                          >
                            {(meal.vegetarian || meal.glutenFree) && (
                              <span
                                title={meal.vegetarian ? "Vegetarian" : "Gluten-free"}
                                aria-label={
                                  meal.vegetarian ? "Vegetarian" : "Gluten-free"
                                }
                                className="absolute top-2.5 right-2.5 flex h-6 min-w-6 items-center justify-center rounded-full border border-sage-dark px-1 text-[0.6rem] font-medium text-sage-dark"
                              >
                                {meal.vegetarian ? "V" : "GF"}
                              </span>
                            )}
                            <span className="font-display block pr-8 text-lg">
                              {selected ? "✓ " : ""}
                              {meal.label}
                            </span>
                            <span className="mt-1 block pr-8 text-xs leading-relaxed text-ink-soft">
                              {meal.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : anyAttending ? (
            <p className="text-center text-sm leading-relaxed text-ink-soft">
              We can&apos;t wait to celebrate with you in the evening! If
              there&apos;s anything we should know, leave us a note below.
            </p>
          ) : (
            <p className="text-center text-sm leading-relaxed text-ink-soft">
              We&apos;re so sorry you can&apos;t make it — you&apos;ll be
              missed! If you&apos;d like, leave a note for the couple below.
            </p>
          )}

          <div className="mt-10">
            <label className="mb-2 block text-center text-[0.7rem] tracking-[0.3em] uppercase text-ink-soft">
              {anyAttending
                ? "Leave a note (optional)"
                : "Leave a note (optional)"}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Allergies, wheelchair access, well wishes…"
              className="w-full border border-ink-soft/25 bg-white/60 p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-ink-soft/40 focus:border-gold"
            />
          </div>

          {anyAttending && (
            <div className="mt-6">
              <label className="mb-2 block text-center text-[0.7rem] tracking-[0.3em] uppercase text-ink-soft">
                Song request (optional)
              </label>
              <input
                type="text"
                value={songRequest}
                onChange={(e) => setSongRequest(e.target.value)}
                maxLength={200}
                placeholder="What will get you on the dance floor?"
                className="w-full border border-ink-soft/25 bg-white/60 px-4 py-3 text-sm outline-none transition-colors placeholder:text-ink-soft/40 focus:border-gold"
              />
            </div>
          )}

          {error && (
            <p className="mt-4 text-center text-sm text-red-700">{error}</p>
          )}

          <div className="mt-8">
            <PrimaryButton onClick={submit} disabled={busy || !allMealsChosen}>
              {busy ? "Submitting…" : "Submit RSVP"}
            </PrimaryButton>
            {!allMealsChosen && (
              <p className="mt-3 text-center text-xs text-ink-soft">
                Please choose a meal for each attending guest.
              </p>
            )}
          </div>
          <BackLink onClick={() => setStep("attendance")} label="Back" />
        </StepShell>
      )}

      {step === "done" && (
        <StepShell
          eyebrow="Thank you"
          title={anyAttending ? "See you there!" : "Thank you"}
        >
          <div className="space-y-6 text-center text-sm leading-relaxed text-ink-soft">
            {anyAttending ? (
              <>
                <p className="font-display text-2xl text-ink">
                  Your RSVP has been received.
                </p>
                <p>
                  We can&apos;t wait to celebrate with you on{" "}
                  {site.dateDisplay} at {site.venueName}. If anything changes,
                  just come back here and update your response.
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl text-ink">
                  Your response has been received.
                </p>
                <p>
                  We&apos;re sad you can&apos;t join us, but thank you so much
                  for letting us know. You&apos;ll be in our thoughts on the
                  big day!
                </p>
              </>
            )}
          </div>
          <div className="ornament mx-auto mt-10 w-40 text-xs">◆</div>
          <div className="mt-10">
            <Link
              href="/"
              className="mx-auto block w-full border border-sage-dark px-8 py-4 text-center text-sm tracking-[0.3em] uppercase text-sage-dark transition-all duration-300 hover:bg-sage-dark hover:text-cream"
            >
              Back to home
            </Link>
          </div>
        </StepShell>
      )}
    </main>
  );
}
