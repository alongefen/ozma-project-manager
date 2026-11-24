import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Common = {
  /** What the button does, in Hebrew. It is the accessible name and the tooltip, so it is required. */
  label: string;
  children: ReactNode;
  /** `danger` only for delete / cancel-an-entry / remove (the bin). */
  tone?: 'default' | 'danger';
  /** No border: for a row of tools that sit directly on the page (the phone's export / print). */
  plain?: boolean;
  className?: string;
};

/**
 * The one icon-only button (edit, delete, print, export, open): a 44px square with a label. Renders a `<button>`,
 * or an `<a>` when `href` is given (print / export / download links). Row order, right to left: print, export, delete, edit.
 */
export function IconButton(props: Common & (({ href: string; target?: string; rel?: string; download?: boolean } & { onClick?: never }) | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'title'>))) {
  const { label, children, tone = 'default', plain, className = '', ...rest } = props;
  const classes = ['ui-iconbtn', tone === 'danger' && 'ui-iconbtn--danger', plain && 'ui-iconbtn--plain', className].filter(Boolean).join(' ');
  if ('href' in rest && rest.href !== undefined) {
    const { href, target, rel, download } = rest as { href: string; target?: string; rel?: string; download?: boolean };
    return <a className={classes} href={href} target={target} rel={rel} download={download} aria-label={label} title={label}>{children}</a>;
  }
  const { type = 'button', ...button } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type={type} className={classes} aria-label={label} title={label} {...button}>{children}</button>;
}
