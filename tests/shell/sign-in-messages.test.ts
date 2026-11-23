import { describe, expect, it } from 'vitest';
import { signInMessage } from '@/features/auth/messages';

describe('sign-in messages', () => {
  it('does not reveal whether an account exists', () => {
    expect(signInMessage('UNAUTHENTICATED')).toBe(signInMessage('FORBIDDEN'));
    expect(signInMessage('UNAUTHENTICATED')).toBe(signInMessage('NOT_FOUND'));
  });
  it('tells the user to retry later when limited or unavailable', () => {
    expect(signInMessage('RATE_LIMITED')).toContain('נסו שוב');
    expect(signInMessage('UNAVAILABLE')).toContain('נסו שוב');
  });
});
