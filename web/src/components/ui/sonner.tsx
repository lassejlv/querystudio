import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme='dark'
      position='bottom-right'
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex items-center gap-2 w-full rounded-md border border-border bg-zinc-900 px-3 py-2 shadow-md text-xs',
          title: 'font-medium text-foreground',
          description: 'text-muted-foreground',
          actionButton: 'inline-flex items-center justify-center rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-6 px-2',
          cancelButton: 'inline-flex items-center justify-center rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-6 px-2',
          closeButton: 'absolute right-1 top-1 rounded p-0.5 text-muted-foreground hover:text-foreground',
          error: '!border-red-500/50 !bg-red-950 [&_[data-title]]:!text-red-200',
          success: '!border-green-500/50 !bg-green-950 [&_[data-title]]:!text-green-200',
          warning: '!border-yellow-500/50 !bg-yellow-950 [&_[data-title]]:!text-yellow-200',
          info: '!border-blue-500/50 !bg-blue-950 [&_[data-title]]:!text-blue-200',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
