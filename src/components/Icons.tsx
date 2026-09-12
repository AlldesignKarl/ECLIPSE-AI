import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const Menu = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const Plus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Search = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const Image = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L20 20" />
  </svg>
);

export const Code = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 17-5-5 5-5M15 7l5 5-5 5" />
  </svg>
);

export const Video = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="5.5" width="14" height="13" rx="2.5" />
    <path d="m16.5 10.5 5-3v9l-5-3z" />
  </svg>
);

export const Paperclip = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 11.5 12.4 19a4.6 4.6 0 0 1-6.5-6.5l7.9-7.9a3.1 3.1 0 1 1 4.4 4.4l-7.8 7.8a1.6 1.6 0 0 1-2.2-2.2l7.2-7.2" />
  </svg>
);

export const Send = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
  </svg>
);

export const Stop = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </svg>
);

export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
  </svg>
);

export const Copy = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2.2" />
    <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
  </svg>
);

export const Refresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 11.5A8 8 0 1 0 18.4 17" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const Github = (p: P) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);

export const Sparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.7 9l5.3 1.8-5.3 1.7L12 18l-1.7-5.5L5 10.8 10.3 9z" />
    <path d="M18.5 4v3M20 5.5h-3" />
  </svg>
);

export const Settings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const Download = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
  </svg>
);

export const External = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5" />
  </svg>
);

export const Bolt = (p: P) => (
  <svg {...base(p)}>
    <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" />
  </svg>
);

export const Brain = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.5 4.5a2.5 2.5 0 0 0-2.4 3.2A2.6 2.6 0 0 0 5 10.2c0 1 .5 1.8 1.3 2.3A2.6 2.6 0 0 0 8 17a2.5 2.5 0 0 0 4.5-1.5V6.8A2.3 2.3 0 0 0 9.5 4.5ZM14.5 4.5a2.5 2.5 0 0 1 2.4 3.2A2.6 2.6 0 0 1 19 10.2c0 1-.5 1.8-1.3 2.3A2.6 2.6 0 0 1 16 17a2.5 2.5 0 0 1-4.5-1.5" />
  </svg>
);

export const Pin = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4h6l-.8 5.2 3.3 3.1H6.5l3.3-3.1z" />
    <path d="M12 12.3V20" />
  </svg>
);

export const ChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const Camera = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1.5 1.5 0 0 0 1.26-.69l.7-1.08A1.5 1.5 0 0 1 9.92 4.5h4.16a1.5 1.5 0 0 1 1.26.73l.7 1.08A1.5 1.5 0 0 0 17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
);

export const LogOut = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H10" />
  </svg>
);

export const User = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const Mic = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
    <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V21.5M8.5 21.5h7" />
  </svg>
);

export const Home = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 10.5 12 3.5l8.5 7M5.5 9.5V20h13V9.5" />
    <path d="M9.5 20v-5.5h5V20" />
  </svg>
);

export const Play = (p: P) => (
  <svg {...base(p)}>
    <path d="M7.5 5.2v13.6a.6.6 0 0 0 .93.5l10.3-6.8a.6.6 0 0 0 0-1l-10.3-6.8a.6.6 0 0 0-.93.5z" />
  </svg>
);

export const Bot = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="3.5" />
    <circle cx="9" cy="13" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13" r="1.15" fill="currentColor" stroke="none" />
    <path d="M12 4.5v3M9.5 16.5h5M2 12v3M22 12v3" />
  </svg>
);

export const Pencil = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4.2l9.4-9.4a2.4 2.4 0 0 0-3.4-3.4L4.8 16.6z" />
    <path d="M13.8 6.6 17.4 10.2" />
  </svg>
);
