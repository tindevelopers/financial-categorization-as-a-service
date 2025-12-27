import React from 'react'
import clsx from 'clsx'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type HeadingProps = { level?: HeadingLevel } & React.ComponentPropsWithoutRef<
  'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
>

export function Heading({ className, level = 1, ...props }: HeadingProps) {
  const baseClasses = 'text-2xl/8 font-semibold text-zinc-950 sm:text-xl/8 dark:text-white'
  
  switch (level) {
    case 1:
      return <h1 {...props} className={clsx(className, baseClasses)} />
    case 2:
      return <h2 {...props} className={clsx(className, baseClasses)} />
    case 3:
      return <h3 {...props} className={clsx(className, baseClasses)} />
    case 4:
      return <h4 {...props} className={clsx(className, baseClasses)} />
    case 5:
      return <h5 {...props} className={clsx(className, baseClasses)} />
    case 6:
      return <h6 {...props} className={clsx(className, baseClasses)} />
    default:
      return <h1 {...props} className={clsx(className, baseClasses)} />
  }
}

export function Subheading({ className, level = 2, ...props }: HeadingProps) {
  const baseClasses = 'text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white'
  
  switch (level) {
    case 1:
      return <h1 {...props} className={clsx(className, baseClasses)} />
    case 2:
      return <h2 {...props} className={clsx(className, baseClasses)} />
    case 3:
      return <h3 {...props} className={clsx(className, baseClasses)} />
    case 4:
      return <h4 {...props} className={clsx(className, baseClasses)} />
    case 5:
      return <h5 {...props} className={clsx(className, baseClasses)} />
    case 6:
      return <h6 {...props} className={clsx(className, baseClasses)} />
    default:
      return <h2 {...props} className={clsx(className, baseClasses)} />
  }
}
