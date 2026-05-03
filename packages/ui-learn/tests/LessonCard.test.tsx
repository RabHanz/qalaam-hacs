import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { lessonById } from '@qalaam/curriculum';

import { LessonCard } from '../src/cards/LessonCard.js';

describe('LessonCard', () => {
  it('renders a Level 2 tajweed lesson with title + minutes', () => {
    const lesson = lessonById('l2-madd-asli');
    render(<LessonCard lesson={lesson} status="available" href="/learn/2/madd-asli" />);
    expect(screen.getByText(/Madd Aṣlī/i)).toBeDefined();
    expect(screen.getByText(/min/i)).toBeDefined();
  });
  it('disables interaction when locked', () => {
    const lesson = lessonById('l2-madd-asli');
    render(<LessonCard lesson={lesson} status="locked" href="/learn/2/madd-asli" />);
    const link = screen.getByText(/Madd Aṣlī/i).closest('a');
    expect(link?.getAttribute('aria-disabled')).toBe('true');
  });
});
