/**
 * Capability runtime guards — keep adapter code honest about what each speaker can do.
 */
import { QalaamError } from '@qalaam/core';

import type { Capability, Speaker, SpeakerId } from './types.js';

export class CapabilityError extends QalaamError {
  public readonly speakerId: SpeakerId;
  public readonly required: Capability;

  public constructor(speakerId: SpeakerId, required: Capability, speakerName: string) {
    super(
      'qalaam.adapter.capability-unsupported',
      `Speaker "${speakerName}" (${speakerId}) does not support capability "${required}".`,
      { outcomeImpacted: 'O-09' },
    );
    this.name = 'CapabilityError';
    this.speakerId = speakerId;
    this.required = required;
  }
}

/** Throw if the speaker lacks the capability. Use at the start of any adapter method. */
export function requireCapability(speaker: Speaker, capability: Capability): void {
  if (!speaker.capabilities.has(capability)) {
    throw new CapabilityError(speaker.id, capability, speaker.name);
  }
}

/** Type-narrowing helper. */
export function hasCapability(speaker: Speaker, capability: Capability): boolean {
  return speaker.capabilities.has(capability);
}
