import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'small';
  block?: boolean;
};

export function Button({ variant = 'primary', size = 'normal', block, className = '', type = 'button', ...rest }: Props) {
  const classes = ['ui-btn', variant === 'secondary' && 'ui-btn--secondary', size === 'small' && 'ui-btn--small', block && 'ui-btn--block', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
