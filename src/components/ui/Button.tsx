import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: the one main action; secondary: everything else; danger: the confirm button of a destructive action only. */
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'normal' | 'small';
  block?: boolean;
};

export function Button({ variant = 'primary', size = 'normal', block, className = '', type = 'button', ...rest }: Props) {
  const classes = ['ui-btn', variant === 'secondary' && 'ui-btn--secondary', variant === 'danger' && 'ui-btn--danger', size === 'small' && 'ui-btn--small', block && 'ui-btn--block', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
