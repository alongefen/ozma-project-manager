import type { ButtonHTMLAttributes } from 'react';
import { AddIcon } from './ActionIcons';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: the one main action; secondary: everything else; danger: the confirm button of a destructive action only. */
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'normal' | 'small';
  block?: boolean;
  /** `add` puts the plus at the left of the label (the end of the text in RTL): every "create" button (new report, add movement...) uses it. */
  icon?: 'add';
};

export function Button({ variant = 'primary', size = 'normal', block, icon, className = '', type = 'button', children, ...rest }: Props) {
  const classes = ['ui-btn', variant === 'secondary' && 'ui-btn--secondary', variant === 'danger' && 'ui-btn--danger', size === 'small' && 'ui-btn--small', block && 'ui-btn--block', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest}>{children}{icon === 'add' && <AddIcon size={18} />}</button>;
}
