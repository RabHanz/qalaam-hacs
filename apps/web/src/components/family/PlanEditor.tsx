'use client';

/**
 * PlanEditor — inline form for creating or editing a Hifdh plan.
 *
 * Used inside FamilyDashboard as a slide-down panel. Aesthetic: warm-
 * paper inset card, hairline divider, small-caps section labels,
 * Fraunces title.
 */
import { useState } from 'react';

import { plans, type Plan } from '../../lib/family-api.js';

import { MemberAvatar } from './MemberAvatar.js';

import type { FamilyMember } from '../../lib/family-api.js';
import type { ReactNode } from 'react';

interface Props {
  readonly assignee: FamilyMember;
  readonly existingPlan?: Plan | null;
  readonly onSaved: (plan: Plan) => void;
  readonly onCancel: () => void;
}

const SCOPE_KINDS: { value: Plan['scopeKind']; label: string; hint: string }[] = [
  { value: 'juz', label: 'Juz', hint: '1 – 30' },
  { value: 'surah', label: 'Surah', hint: '1 – 114' },
  { value: 'range', label: 'Range', hint: 'e.g. 1:1-2:286' },
  { value: 'full', label: 'Full Mushaf', hint: '604 pages' },
];

export function PlanEditor({ assignee, existingPlan, onSaved, onCancel }: Props): ReactNode {
  const [title, setTitle] = useState(existingPlan?.title ?? `${assignee.displayName}'s plan`);
  const [scopeKind, setScopeKind] = useState<Plan['scopeKind']>(existingPlan?.scopeKind ?? 'juz');
  const [scopeValue, setScopeValue] = useState(existingPlan?.scopeValue ?? '30');
  const [dailyPages, setDailyPages] = useState(existingPlan?.dailyPages ?? 1);
  const [targetDate, setTargetDate] = useState(existingPlan?.targetDate ?? '');
  const [notes, setNotes] = useState(existingPlan?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const args = {
        title: title.trim(),
        scopeKind,
        scopeValue: scopeKind === 'full' ? null : scopeValue,
        dailyPages,
        targetDate: targetDate.length > 0 ? targetDate : null,
        notes: notes.length > 0 ? notes : null,
      };
      const res = existingPlan
        ? await plans.update(existingPlan.id, args)
        : await plans.create({ assigneeUserId: assignee.userId, ...args });
      onSaved(res.plan);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(humanizePlanError(e.code ?? '', e.message ?? ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="form"
      aria-label="Plan editor"
      className="border-hairline bg-paper-50 mt-3 rounded-xl border p-5"
    >
      <div className="mb-4 flex items-center gap-3">
        <MemberAvatar
          displayName={assignee.displayName}
          avatarColor={assignee.avatarColor}
          size={36}
        />
        <div className="flex flex-col">
          <span
            className="text-ink-strong text-sm font-medium"
            style={{ fontFamily: 'Fraunces, Georgia, serif' }}
          >
            {existingPlan ? 'Edit plan' : 'Create a plan'}
          </span>
          <span className="text-ink-muted text-xs">For {assignee.displayName}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.currentTarget.value);
            }}
            className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
            maxLength={120}
            placeholder="e.g. Memorize Juz Amma by Eid"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SCOPE_KINDS.map((s) => (
            <button
              type="button"
              key={s.value}
              onClick={() => {
                setScopeKind(s.value);
              }}
              aria-pressed={scopeKind === s.value}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                scopeKind === s.value
                  ? 'border-leaf bg-leaf/10 text-leaf-700'
                  : 'border-hairline hover:border-leaf-300 bg-surface'
              }`}
            >
              <p className="text-sm font-medium" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                {s.label}
              </p>
              <p className="text-ink-muted text-[10px]">{s.hint}</p>
            </button>
          ))}
        </div>

        {scopeKind !== 'full' ? (
          <label className="flex flex-col gap-1.5">
            <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
              {scopeKind === 'juz'
                ? 'Juz number'
                : scopeKind === 'surah'
                  ? 'Surah number'
                  : 'Verse range'}
            </span>
            <input
              type="text"
              value={scopeValue}
              onChange={(e) => {
                setScopeValue(e.currentTarget.value);
              }}
              className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
              placeholder={scopeKind === 'range' ? '1:1-2:286' : scopeKind === 'juz' ? '30' : '36'}
            />
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
              Daily pages
            </span>
            <input
              type="number"
              min="0.25"
              max="20"
              step="0.25"
              value={dailyPages}
              onChange={(e) => {
                setDailyPages(Number.parseFloat(e.currentTarget.value) || 1);
              }}
              className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
              Target date <span className="normal-case opacity-60">(optional)</span>
            </span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => {
                setTargetDate(e.currentTarget.value);
              }}
              className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="smallcaps text-ink-muted text-[10px] tracking-[0.18em]">
            Notes <span className="normal-case opacity-60">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.currentTarget.value);
            }}
            rows={2}
            className="border-hairline focus:border-leaf focus:ring-leaf/30 bg-surface rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
            placeholder="Reciter, time of day, encouragement…"
            maxLength={400}
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-300/40 bg-red-50/60 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-ink-muted hover:text-ink-strong rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || title.trim().length === 0}
            onClick={() => {
              void save();
            }}
            className="bg-ink hover:bg-ink-strong text-paper rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Saving…' : existingPlan ? 'Save plan' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function humanizePlanError(code: string, message: string): string {
  switch (code) {
    case 'qalaam.plan.bad-title':
      return 'Title is required (1-120 characters).';
    case 'qalaam.plan.bad-scope-kind':
      return 'Please pick a scope.';
    case 'qalaam.plan.bad-scope-value':
      return 'That scope value is not valid.';
    case 'qalaam.plan.bad-daily':
      return 'Daily pages must be between 0.25 and 20.';
    case 'qalaam.plan.bad-target-date':
      return 'Target date must be in YYYY-MM-DD format.';
    case 'qalaam.plan.assignee-not-in-family':
      return 'That family member could not be found.';
    case 'qalaam.plan.not-guardian':
      return 'Only a guardian can create plans for other members.';
    default:
      return message.length > 0 ? message : 'Something went wrong saving the plan.';
  }
}
