import { Button, Icon } from '@/components/ui';
import { signOutAction } from './actions';

export function SignOutButton({ block, variant = 'secondary' }: { block?: boolean; variant?: 'primary' | 'secondary' }) {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant={variant} block={block} size={block ? 'normal' : 'small'}>
        <Icon name="logout" />
        יציאה
      </Button>
    </form>
  );
}
