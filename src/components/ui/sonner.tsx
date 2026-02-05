import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-border/70 bg-background/80 px-3 py-3 text-xs text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/65",
          title: "font-semibold tracking-tight text-foreground",
          description: "text-[11px] leading-relaxed text-muted-foreground",
          actionButton:
            "inline-flex h-7 items-center justify-center rounded-full border border-border/70 bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          cancelButton:
            "inline-flex h-7 items-center justify-center rounded-full border border-border/70 bg-secondary px-3 text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-secondary/80",
          closeButton:
            "absolute right-2 top-2 rounded-full p-1 text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
          error:
            "!border-red-400/40 !bg-red-950/35 [&_[data-title]]:!text-red-100 [&_[data-description]]:!text-red-200/85",
          success:
            "!border-emerald-400/40 !bg-emerald-950/35 [&_[data-title]]:!text-emerald-100 [&_[data-description]]:!text-emerald-200/85",
          warning:
            "!border-amber-400/40 !bg-amber-950/35 [&_[data-title]]:!text-amber-100 [&_[data-description]]:!text-amber-200/85",
          info: "!border-sky-400/40 !bg-sky-950/35 [&_[data-title]]:!text-sky-100 [&_[data-description]]:!text-sky-200/85",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
