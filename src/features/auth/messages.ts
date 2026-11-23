import type { ErrorCode } from '@/types/contracts';

export function signInMessage(code: ErrorCode): string {
  switch (code) {
    case 'VALIDATION':
      return 'האימייל או הסיסמה אינם תקינים';
    case 'RATE_LIMITED':
      return 'בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות';
    case 'UNAVAILABLE':
      return 'לא ניתן להתחבר כרגע. נסו שוב בעוד רגע';
    default:
      return 'האימייל או הסיסמה שגויים';
  }
}
