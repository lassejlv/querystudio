import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const spokes = Array.from({ length: 12 }, (_, index) => ({
    rotate: index * 30,
    opacity: 0.2 + (index / 12) * 0.8,
  }));

  return (
    <svg
      role="status"
      aria-label="Loading"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4 animate-spin text-black animation-duration-[900ms]", className)}
      {...props}
    >
      {spokes.map((spoke) => (
        <line
          key={spoke.rotate}
          x1="12"
          y1="3"
          x2="12"
          y2="6.3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity={spoke.opacity}
          transform={`rotate(${spoke.rotate} 12 12)`}
        />
      ))}
    </svg>
  );
}

export { Spinner };
