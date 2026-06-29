// Inline stroke icons (lucide-style, 1.5px, currentColor). No emoji anywhere —
// a deliberate move away from the generic "AI app" look toward a finance tool.

type P = { className?: string };
const base = (className = "h-4 w-4") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function DashboardIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function BoardIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="11" rx="1.5" />
      <rect x="17" y="4" width="4" height="14" rx="1.5" />
    </svg>
  );
}

export function ShieldIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function PlusIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BookIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M4 19a2 2 0 0 1 2-2h13" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function CheckIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function RefreshIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function BellIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function CalendarIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function HandshakeIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="m11 17 2 2a1 1 0 0 0 1.4 0l3.6-3.6" />
      <path d="m18 13 2-2a2 2 0 0 0 0-2.8l-3.2-3.2a2 2 0 0 0-2.8 0L12 7" />
      <path d="M6 8 4 10a2 2 0 0 0 0 2.8L8 17" />
      <path d="m14 6-3 3" />
    </svg>
  );
}

export function GavelIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="m14.5 12.5-8 8a2.1 2.1 0 0 1-3-3l8-8" />
      <path d="m16 16 6-6M8 8l6-6M9 7l4 4M17 11l4 4" />
      <path d="M3 21h7" />
    </svg>
  );
}

export function BanknoteIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

export function MailIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function ChatIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function TrendingIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M17 7h4v4" />
    </svg>
  );
}

export function ClockIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function SignOutIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function SparkIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

export function SendIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

export function PlugIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M9 2v6M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8z" />
      <path d="M12 17v5" />
    </svg>
  );
}

export function ActivityIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}

export function AlertIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

export function PulseIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function XMarkIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function InfoIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function CodeIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

export function SearchIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function TrashIcon({ className }: P) {
  return (
    <svg {...base(className)}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
