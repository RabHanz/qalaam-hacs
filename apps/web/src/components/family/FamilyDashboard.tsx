'use client';

/**
 * FamilyDashboard — parent overview.
 *
 * Top-level surface for /family.
 *
 * Layout (editorial, single column, restrained):
 *   • Header        — family name, "your role" tag, family-private ribbon
 *   • Members row   — avatar tile per child + Add child action
 *   • Per-member card — open mistakes count, last session, active plan,
 *                       quick actions (record progress / send praise / edit plan)
 *   • Mistake heatmap — toggleable per member
 *   • Voice-notes inbox — sent + received
 *
 * Adab non-negotiables (CLAUDE.md): NO XP, NO trophies, NO leaderboards,
 * NO streak-celebration popups. Numbers are calm reference text.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  family as familyApi,
  type DashboardMember,
  type FamilyMember,
  type FamilyPayload,
  type Plan,
} from '../../lib/family-api.js';
import { useUser } from '../../lib/use-user.js';

import { MemberAvatar } from './MemberAvatar.js';
import { MistakeHeatmap } from './MistakeHeatmap.js';
import { PlanEditor } from './PlanEditor.js';
import { StickerPicker } from './StickerPicker.js';
import { VoiceNotesInbox } from './VoiceNotesInbox.js';

import type { ReactNode } from 'react';

interface AddChildState {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
}

export function FamilyDashboard(): ReactNode {
  const { status, user } = useUser();
  const [family, setFamily] = useState<FamilyPayload | null>(null);
  const [dashboard, setDashboard] = useState<DashboardMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addChild, setAddChild] = useState<AddChildState>({
    open: false,
    name: '',
    busy: false,
    error: null,
  });
  const [planEditorFor, setPlanEditorFor] = useState<{
    member: FamilyMember;
    plan: Plan | null;
  } | null>(null);
  const [stickerFor, setStickerFor] = useState<FamilyMember | null>(null);
  const [heatmapFor, setHeatmapFor] = useState<FamilyMember | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([familyApi.get(), familyApi.dashboard()])
      .then(([f, d]) => {
        if (cancelled) return;
        setFamily(f);
        setDashboard([...d.members]);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load your family right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [status, refreshKey]);

  const refresh = useCallback((): void => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (status === 'loading') {
    return <DashboardSkeleton />;
  }
  if (status === 'anonymous' || !user) {
    return <SignedOutCard />;
  }
  if (loading) {
    return <DashboardSkeleton />;
  }
  if (error || !family || !dashboard) {
    return (
      <div className="border-hairline bg-paper rounded-2xl border p-6">
        <p className="text-ink-muted text-sm">{error ?? 'Could not load your family.'}</p>
      </div>
    );
  }

  const isGuardian = family.myRole === 'guardian';
  const others = family.members.filter((m) => m.userId !== user.id);

  async function handleAddChild(): Promise<void> {
    const name = addChild.name.trim();
    if (name.length === 0) return;
    setAddChild((s) => ({ ...s, busy: true, error: null }));
    try {
      await familyApi.addMember({ displayName: name, isMinor: true, role: 'child' });
      setAddChild({ open: false, name: '', busy: false, error: null });
      refresh();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const msg =
        e.code === 'qalaam.family.seat-limit'
          ? 'Family seat limit reached. Email us to expand.'
          : e.code === 'qalaam.family.bad-name'
            ? 'Pick a name 1-80 characters.'
            : (e.message ?? 'Could not add this profile.');
      setAddChild((s) => ({ ...s, busy: false, error: msg }));
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <FamilyHeader family={family} memberCount={family.members.length} />

      <section
        className="border-hairline bg-paper rounded-2xl border p-6"
        aria-label="Family members"
      >
        <header className="mb-4 flex items-baseline justify-between gap-2">
          <h3
            className="text-ink-strong text-lg"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            Members
          </h3>
          <p className="text-ink-muted text-xs">
            {family.members.length}/{family.family.maxSeats}
          </p>
        </header>
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
          {family.members.map((m) => {
            const stats = dashboard.find((d) => d.userId === m.userId);
            const isMe = m.userId === user.id;
            return (
              <li
                key={m.userId}
                className={`border-hairline flex min-w-[16rem] flex-1 items-center gap-3 rounded-xl border bg-white p-4 ${
                  isMe ? 'border-leaf-300 bg-leaf/5' : ''
                }`}
              >
                <MemberAvatar displayName={m.displayName} avatarColor={m.avatarColor} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-ink-strong truncate text-sm font-medium">
                    {m.displayName}
                    {isMe ? (
                      <span className="text-ink-muted ml-1 text-[10px] font-normal">(you)</span>
                    ) : null}
                  </p>
                  <p className="smallcaps text-leaf text-[10px] tracking-widest">
                    {m.role === 'guardian' ? 'Guardian' : m.role === 'child' ? 'Child' : 'Member'}
                    {stats?.openMistakes && stats.openMistakes > 0 ? (
                      <>
                        {' · '}
                        <span className="text-mistake-error normal-case">
                          {stats.openMistakes.toString()} to revisit
                        </span>
                      </>
                    ) : null}
                  </p>
                  {stats?.activePlan ? (
                    <p className="text-ink-muted truncate text-[10px] italic">
                      {stats.activePlan.title} · {stats.activePlan.dailyPages.toString()}p/day
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
          {isGuardian ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  setAddChild((s) => ({ ...s, open: !s.open }));
                }}
                className="border-hairline hover:border-leaf hover:text-leaf text-ink-muted flex h-full w-full min-w-[12rem] items-center justify-center gap-2 rounded-xl border border-dashed bg-white px-4 py-4 text-sm transition-colors"
              >
                <span aria-hidden className="text-lg leading-none">
                  +
                </span>
                <span>Add child profile</span>
              </button>
            </li>
          ) : null}
        </ul>

        {addChild.open ? (
          <div className="border-hairline bg-paper-50 mt-4 flex flex-col gap-3 rounded-xl border p-4">
            <label className="flex flex-col gap-1.5">
              <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
                Child's name
              </span>
              <input
                type="text"
                autoFocus
                value={addChild.name}
                onChange={(e) => {
                  setAddChild((s) => ({ ...s, name: e.currentTarget.value }));
                }}
                maxLength={80}
                className="border-hairline focus:border-leaf focus:ring-leaf/30 rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
              />
            </label>
            {addChild.error ? (
              <div
                role="alert"
                className="rounded-lg border border-red-300/40 bg-red-50/60 px-3 py-2 text-sm text-red-800"
              >
                {addChild.error}
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddChild({ open: false, name: '', busy: false, error: null });
                }}
                className="text-ink-muted hover:text-ink-strong rounded-lg px-3 py-1.5 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addChild.busy || addChild.name.trim().length === 0}
                onClick={() => {
                  void handleAddChild();
                }}
                className="bg-ink hover:bg-ink-strong text-paper rounded-lg px-4 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addChild.busy ? 'Adding…' : 'Add child'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Per-member action panel — shown for assignees other than self */}
      {dashboard
        .filter((m) => m.userId !== user.id)
        .map((m) => (
          <MemberCard
            key={m.userId}
            member={m}
            isGuardian={isGuardian}
            onCreatePlan={() => {
              setPlanEditorFor({ member: m, plan: null });
            }}
            onSendSticker={() => {
              setStickerFor(m);
            }}
            onToggleHeatmap={() => {
              setHeatmapFor((cur) => (cur?.userId === m.userId ? null : m));
            }}
            heatmapOpen={heatmapFor?.userId === m.userId}
          />
        ))}

      {/* Plan editor */}
      {planEditorFor ? (
        <PlanEditor
          assignee={planEditorFor.member}
          existingPlan={planEditorFor.plan}
          onSaved={() => {
            setPlanEditorFor(null);
            refresh();
          }}
          onCancel={() => {
            setPlanEditorFor(null);
          }}
        />
      ) : null}

      {/* Sticker picker */}
      {stickerFor ? (
        <StickerPicker
          recipients={[stickerFor]}
          defaultRecipientId={stickerFor.userId}
          onSent={() => {
            setStickerFor(null);
          }}
          onCancel={() => {
            setStickerFor(null);
          }}
        />
      ) : null}

      {/* My own heatmap — appears once, for the signed-in user */}
      <MistakeHeatmap userId={user.id} userDisplayName={user.displayName ?? 'You'} />

      {/* Voice notes inbox */}
      <VoiceNotesInbox currentUserId={user.id} members={others} />

      <SeeAlsoLinks />
    </div>
  );
}

function FamilyHeader({
  family,
  memberCount,
}: {
  family: FamilyPayload;
  memberCount: number;
}): ReactNode {
  return (
    <header className="flex flex-col gap-2">
      <p className="smallcaps text-leaf text-[10px] tracking-[0.22em]">Family-private</p>
      <h1
        className="text-ink-strong"
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 'clamp(1.75rem, 4vw, 2.4rem)',
          fontWeight: 600,
          letterSpacing: '-0.012em',
          lineHeight: 1.15,
        }}
      >
        {family.family.name}
      </h1>
      <p className="text-ink-muted max-w-[60ch] text-sm leading-relaxed">
        Daily Hifdh, mistake heatmap, and family-only voice notes. Your role:{' '}
        <strong className="text-ink-strong font-medium">
          {family.myRole === 'guardian'
            ? 'Guardian'
            : family.myRole === 'child'
              ? 'Child'
              : 'Member'}
        </strong>
        . Audio + Hifdh state never leave your installation. {memberCount.toString()} member
        {memberCount === 1 ? '' : 's'}.
      </p>
    </header>
  );
}

function MemberCard({
  member,
  isGuardian,
  onCreatePlan,
  onSendSticker,
  onToggleHeatmap,
  heatmapOpen,
}: {
  member: DashboardMember;
  isGuardian: boolean;
  onCreatePlan: () => void;
  onSendSticker: () => void;
  onToggleHeatmap: () => void;
  heatmapOpen: boolean;
}): ReactNode {
  const recordedToday =
    member.lastSessionDate !== null &&
    member.lastSessionDate === new Date().toISOString().slice(0, 10);
  return (
    <section
      className="border-hairline bg-paper rounded-2xl border p-6"
      aria-label={`Quick actions for ${member.displayName}`}
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <MemberAvatar
            displayName={member.displayName}
            avatarColor={member.avatarColor}
            size={48}
          />
          <div>
            <h3
              className="text-ink-strong text-lg"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              {member.displayName}
            </h3>
            <p className="text-ink-muted text-xs">
              {member.portionsLast7.toString()} portion{member.portionsLast7 === 1 ? '' : 's'} this
              week ·{' '}
              {recordedToday
                ? 'recited today'
                : member.lastSessionDate
                  ? `last on ${member.lastSessionDate}`
                  : 'no sessions yet'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isGuardian ? (
            <button
              type="button"
              onClick={onCreatePlan}
              className="border-hairline hover:border-leaf hover:text-leaf rounded-lg border bg-white px-3 py-1.5 text-xs transition-colors"
            >
              {member.activePlan ? 'Edit plan' : 'New plan'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSendSticker}
            className="border-hairline hover:border-leaf hover:text-leaf rounded-lg border bg-white px-3 py-1.5 text-xs transition-colors"
          >
            Send a kind word
          </button>
          <button
            type="button"
            onClick={onToggleHeatmap}
            aria-pressed={heatmapOpen}
            className="border-hairline hover:border-leaf hover:text-leaf rounded-lg border bg-white px-3 py-1.5 text-xs transition-colors"
          >
            {heatmapOpen ? 'Hide heatmap' : 'View heatmap'}
          </button>
        </div>
      </div>

      {heatmapOpen ? (
        <div className="mt-5">
          <MistakeHeatmap userId={member.userId} userDisplayName={member.displayName} />
        </div>
      ) : null}
    </section>
  );
}

function SeeAlsoLinks(): ReactNode {
  return (
    <nav
      aria-label="Family quick links"
      className="border-hairline bg-paper rounded-2xl border p-6"
    >
      <h3
        className="text-ink-strong mb-3 text-sm"
        style={{ fontFamily: 'Fraunces, Georgia, serif' }}
      >
        See also
      </h3>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        <li>
          <Link
            href="/family/khatm"
            className="border-hairline hover:border-leaf hover:text-leaf flex flex-col gap-1 rounded-xl border bg-white p-4 transition-colors"
          >
            <span
              className="text-ink-strong text-sm"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Family khatm
            </span>
            <span className="text-ink-muted text-[11px] leading-relaxed">
              Track a multi-user reading of the entire mushaf, sequential or distributed.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/hifdh"
            className="border-hairline hover:border-leaf hover:text-leaf flex flex-col gap-1 rounded-xl border bg-white p-4 transition-colors"
          >
            <span
              className="text-ink-strong text-sm"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Daily Hifdh
            </span>
            <span className="text-ink-muted text-[11px] leading-relaxed">
              Today's portions due, streak count, mutashabihat watchlist.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/recite/2:255"
            className="border-hairline hover:border-leaf hover:text-leaf flex flex-col gap-1 rounded-xl border bg-white p-4 transition-colors"
          >
            <span
              className="text-ink-strong text-sm"
              style={{ fontFamily: 'Fraunces, Georgia, serif' }}
            >
              Recite-and-check
            </span>
            <span className="text-ink-muted text-[11px] leading-relaxed">
              Live recite mode with on-device ASR. Mistakes feed into the heatmap automatically.
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function DashboardSkeleton(): ReactNode {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
      <div className="bg-paper-100 h-12 w-52 animate-pulse rounded" />
      <div className="bg-paper-100 h-44 animate-pulse rounded-2xl" />
      <div className="bg-paper-100 h-44 animate-pulse rounded-2xl" />
    </div>
  );
}

function SignedOutCard(): ReactNode {
  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <p className="smallcaps text-leaf mb-2 text-[10px] tracking-[0.22em]">Family</p>
      <h1
        className="text-ink-strong"
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 'clamp(1.75rem, 4vw, 2.4rem)',
          fontWeight: 600,
        }}
      >
        Sign in to see your family
      </h1>
      <p className="text-ink-muted mx-auto mt-3 max-w-[40ch] text-sm leading-relaxed">
        Family Hifdh, child profiles, mistake heatmap, and praise notes are auth-gated and private.
        Your data lives on your installation, not on a third party.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link
          href="/signin"
          className="bg-ink hover:bg-ink-strong text-paper rounded-lg px-5 py-2 text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="border-hairline hover:border-leaf hover:text-leaf rounded-lg border bg-white px-5 py-2 text-sm font-medium transition-colors"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
