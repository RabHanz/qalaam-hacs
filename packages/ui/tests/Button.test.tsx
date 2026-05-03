import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '../src/primitives/Button.js';

describe('Button', () => {
  it('renders children and is focusable by default', () => {
    render(<Button>Recite</Button>);
    const btn = screen.getByRole('button', { name: 'Recite' });
    expect(btn).toBeDefined();
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('shows loading state with aria-busy and disables interaction', () => {
    render(<Button loading>Generating</Button>);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('honors disabled prop', () => {
    render(<Button disabled>Off</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
