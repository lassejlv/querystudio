"use client";

import type { CSSProperties } from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const defaultClassNames: NonNullable<ToasterProps["toastOptions"]>["classNames"] = {
  toast:
    "border border-border/70 bg-background/70 text-foreground backdrop-blur-xl shadow-[0_10px_34px_rgba(0,0,0,0.36)]",
  title: "font-medium tracking-tight",
  description: "text-muted-foreground",
  success: "border-emerald-400/40 bg-emerald-500/16 text-emerald-100",
  info: "border-sky-400/40 bg-sky-500/16 text-sky-100",
  warning: "border-amber-400/40 bg-amber-500/16 text-amber-100",
  error: "border-rose-400/40 bg-rose-500/16 text-rose-100",
  loading: "border-blue-400/35 bg-blue-500/14 text-blue-100",
  actionButton: "bg-foreground text-background hover:bg-foreground/90 rounded-lg",
  cancelButton: "bg-accent/80 text-foreground hover:bg-accent rounded-lg border border-border/60",
  closeButton: "bg-transparent text-muted-foreground hover:text-foreground border border-border/60",
};

const defaultStyle = {
  "--normal-bg": "color-mix(in srgb, var(--card) 78%, transparent)",
  "--normal-text": "var(--foreground)",
  "--normal-border": "color-mix(in srgb, var(--border) 76%, transparent)",
  "--success-bg": "color-mix(in srgb, #30d158 22%, transparent)",
  "--success-text": "#d9ffe5",
  "--success-border": "color-mix(in srgb, #30d158 40%, transparent)",
  "--info-bg": "color-mix(in srgb, #0a84ff 20%, transparent)",
  "--info-text": "#d9ecff",
  "--info-border": "color-mix(in srgb, #0a84ff 38%, transparent)",
  "--warning-bg": "color-mix(in srgb, #ff9f0a 21%, transparent)",
  "--warning-text": "#fff3dc",
  "--warning-border": "color-mix(in srgb, #ff9f0a 40%, transparent)",
  "--error-bg": "color-mix(in srgb, #ff453a 21%, transparent)",
  "--error-text": "#ffe1df",
  "--error-border": "color-mix(in srgb, #ff453a 42%, transparent)",
  "--border-radius": "calc(var(--radius) + 4px)",
} as CSSProperties;

function Toaster({
  position = "bottom-center",
  richColors = true,
  toastOptions,
  style,
  ...props
}: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      richColors={richColors}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...defaultClassNames,
          ...toastOptions?.classNames,
        },
      }}
      style={{
        ...defaultStyle,
        ...style,
      }}
      {...props}
    />
  );
}

export { Toaster };
