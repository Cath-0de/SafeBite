// The app's button. `variant` picks the look (index.css .btn-*); `size="lg"`
// is the larger version used when flare mode or low energy is on.
// Defaults to type="button"; pass type="submit" inside forms.
import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'lg'
}

export default function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...rest }: Props) {
  const classes = ['btn', `btn-${variant}`, size === 'lg' && 'btn-lg', className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
