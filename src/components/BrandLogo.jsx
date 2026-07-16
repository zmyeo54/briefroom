/**
 * Briefroom mark — nested rehearsal room.
 * dormi-inspired multi-stop warm→cool gradient tile.
 */
export default function BrandLogo({ size = 28, className = "", title }) {
  const gradId = `br-room-${size}`;
  const softId = `br-room-soft-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradId} x1="0%" y1="20%" x2="100%" y2="85%">
          <stop offset="0%" stopColor="#FFC757" />
          <stop offset="35%" stopColor="#FF7648" />
          <stop offset="68%" stopColor="#4A7FF8" />
          <stop offset="100%" stopColor="#C5B4E3" />
        </linearGradient>
        <linearGradient id={softId} x1="50%" y1="12%" x2="50%" y2="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="18" fill={`url(#${gradId})`} />
      <rect x="10" y="10" width="44" height="44" rx="14" fill={`url(#${softId})`} />

      <path
        d="M16 48V22.5c0-4.2 3.3-7.5 7.5-7.5h17c4.2 0 7.5 3.3 7.5 7.5V48"
        fill="none"
        stroke="#fff"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.5 48V25.5c0-2.5 2-4.5 4.5-4.5h10c2.5 0 4.5 2 4.5 4.5V48"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />
      <path
        d="M14.5 48h35"
        fill="none"
        stroke="#fff"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d="M27 48v-8.5M37 48v-8.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="32" cy="19.5" r="2.4" fill="#fff" opacity="0.95" />
      <path
        d="M32 22.2v3.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
