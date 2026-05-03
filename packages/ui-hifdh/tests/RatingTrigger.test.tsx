import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RatingTrigger } from '../src/session/RatingTrigger.js';

afterEach(() => {
  cleanup();
});

describe('RatingTrigger', () => {
  it('disables submit until both axes are picked', () => {
    const onSubmit = vi.fn();
    render(<RatingTrigger portionLabel="2:1-2:5" onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: /save rating/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('emits derived FSRS grade on submit', () => {
    const onSubmit = vi.fn();
    render(<RatingTrigger portionLabel="2:1-2:5" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Fluent' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Clean' }));
    fireEvent.click(screen.getByRole('button', { name: /save rating/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
    const [fluency, accuracy, grade] = onSubmit.mock.calls[0]!;
    expect(fluency).toBe(3);
    expect(accuracy).toBe(3);
    expect(grade).toBe(4); // Easy per the matrix
  });
});
