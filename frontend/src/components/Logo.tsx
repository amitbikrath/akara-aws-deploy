interface LogoProps {
  className?: string
}

export default function Logo({ className = "h-8 w-8" }: LogoProps) {
  return (
    <div className={`${className} relative`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Outer ring with gradient */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="url(#logoGradient)"
          strokeWidth="3"
          fill="none"
          className="animate-spin-slow"
        />
        
        {/* Inner sacred geometry */}
        <circle
          cx="50"
          cy="50"
          r="25"
          fill="url(#innerGradient)"
          className="animate-pulse-slow"
        />
        
        {/* Center dot */}
        <circle
          cx="50"
          cy="50"
          r="8"
          fill="white"
          className="animate-float"
        />
        
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59440" />
            <stop offset="50%" stopColor="#f3761b" />
            <stop offset="100%" stopColor="#e45a11" />
          </linearGradient>
          <radialGradient id="innerGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(243, 118, 27, 0.3)" />
            <stop offset="100%" stopColor="rgba(243, 118, 27, 0.1)" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  )
}
