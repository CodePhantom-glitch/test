import React from 'react';

export const HeroIllustration: React.FC = () => {
  return (
    <div className="relative w-full h-full min-h-[210px] flex items-center justify-center overflow-hidden select-none">
      {/* Radial ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_50%,rgba(14,165,233,0.22),rgba(6,182,212,0.06)_50%,transparent_75%)] pointer-events-none" />

      <svg
        viewBox="0 0 460 240"
        className="w-full h-full max-w-[440px] max-h-[230px] drop-shadow-[0_12px_28px_rgba(6,182,212,0.2)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="FlashAI Autonomous Arbitrage Sentinel and Ethereum Liquidity Network Illustration"
      >
        <defs>
          <linearGradient id="bgGridGrad" x1="0" y1="0" x2="460" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="ethCrystal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id="botArmor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="45%" stopColor="#7DD3FC" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <linearGradient id="visorGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="50%" stopColor="#020617" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="cyanBeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Perspective circuit lines */}
        <path
          d="M20 205 L160 155 L430 155 M60 225 L180 175 L440 175"
          stroke="url(#bgGridGrad)"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <ellipse cx="290" cy="195" rx="115" ry="22" fill="#0EA5E9" fillOpacity="0.12" />
        <ellipse
          cx="290"
          cy="195"
          rx="95"
          ry="16"
          stroke="#38BDF8"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          strokeDasharray="6 4"
        />

        {/* Atomic Flash-Loan Route Arcs connecting DEX Nodes */}
        <path
          d="M85 135 C 125 55, 215 45, 265 95"
          stroke="url(#cyanBeam)"
          strokeWidth="2"
          strokeDasharray="5 3"
        />
        <path
          d="M125 180 C 175 210, 235 195, 268 155"
          stroke="#38BDF8"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />

        {/* Floating Ethereum Crystal Left */}
        <g transform="translate(62, 92)">
          <polygon points="24,0 48,38 24,52 0,38" fill="url(#ethCrystal)" opacity="0.9" />
          <polygon points="24,0 48,38 24,28" fill="#7DD3FC" opacity="0.55" />
          <polygon points="24,58 48,44 24,78 0,44" fill="url(#ethCrystal)" opacity="0.75" />
          <circle cx="24" cy="39" r="32" stroke="#38BDF8" strokeOpacity="0.25" strokeWidth="1" />
        </g>

        {/* Secondary DEX Liquidity Node Top Left */}
        <g transform="translate(155, 36)">
          <rect
            x="0"
            y="0"
            width="64"
            height="28"
            rx="6"
            fill="#0F172A"
            stroke="#0EA5E9"
            strokeOpacity="0.5"
          />
          <text x="10" y="13" fill="#38BDF8" fontSize="8" fontFamily="IBM Plex Mono" fontWeight="600">
            UNI-V3 0.05%
          </text>
          <text x="10" y="23" fill="#10B981" fontSize="7.5" fontFamily="IBM Plex Mono">
            +58 bps Δ
          </text>
        </g>

        {/* Secondary DEX Liquidity Node Bottom Left */}
        <g transform="translate(108, 162)">
          <rect
            x="0"
            y="0"
            width="68"
            height="28"
            rx="6"
            fill="#0F172A"
            stroke="#06B6D4"
            strokeOpacity="0.45"
          />
          <text x="8" y="13" fill="#7DD3FC" fontSize="8" fontFamily="IBM Plex Mono" fontWeight="600">
            AAVE V3 POOL
          </text>
          <text x="8" y="23" fill="#94A3B8" fontSize="7.5" fontFamily="IBM Plex Mono">
            FLASH 0.05%
          </text>
        </g>

        {/* Floating Ethereum Crystal Right */}
        <g transform="translate(382, 58) scale(0.82)">
          <polygon points="24,0 48,38 24,52 0,38" fill="url(#ethCrystal)" opacity="0.85" />
          <polygon points="24,58 48,44 24,78 0,44" fill="url(#ethCrystal)" opacity="0.65" />
        </g>

        {/* FlashAI Sentinel Robot Center-Right */}
        <g transform="translate(232, 34)">
          {/* Antenna / Neural Transceiver */}
          <line x1="58" y1="6" x2="58" y2="22" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="58" cy="5" r="5" fill="#22D3EE" />
          <circle cx="58" cy="5" r="9" stroke="#22D3EE" strokeOpacity="0.4" strokeWidth="1.5" />

          {/* Robot Head Dome */}
          <rect
            x="16"
            y="20"
            width="84"
            height="64"
            rx="28"
            fill="url(#botArmor)"
            stroke="#E0F2FE"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />

          {/* Side Ear Acoustic Pods */}
          <rect x="6" y="40" width="12" height="26" rx="6" fill="#0284C7" stroke="#7DD3FC" strokeWidth="1.2" />
          <rect x="98" y="40" width="12" height="26" rx="6" fill="#0284C7" stroke="#7DD3FC" strokeWidth="1.2" />

          {/* Visor Screen */}
          <rect
            x="26"
            y="33"
            width="64"
            height="36"
            rx="14"
            fill="url(#visorGlow)"
            stroke="#38BDF8"
            strokeWidth="1.5"
          />

          {/* Glowing Cyan Eyes */}
          <rect x="37" y="45" width="14" height="9" rx="4.5" fill="#22D3EE" />
          <rect x="65" y="45" width="14" height="9" rx="4.5" fill="#22D3EE" />
          {/* Smile / Telemetry Wave */}
          <path
            d="M49 60 Q58 65 67 60"
            stroke="#38BDF8"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Robot Torso Chassis */}
          <path
            d="M24 92 C24 88, 92 88, 92 92 L84 148 C82 156, 34 156, 32 148 Z"
            fill="url(#botArmor)"
            stroke="#bae6fd"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />

          {/* Core Chest Reactor (Ethereum Shield) */}
          <circle cx="58" cy="118" r="16" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.5" />
          <polygon points="58,107 66,118 58,123 50,118" fill="#22D3EE" />
          <polygon points="58,125 66,120 58,130 50,120" fill="#0EA5E9" />

          {/* Floating Shoulder & Arm Left */}
          <rect
            x="2"
            y="94"
            width="18"
            height="42"
            rx="9"
            transform="rotate(10 2 94)"
            fill="url(#botArmor)"
            stroke="#7DD3FC"
            strokeWidth="1.2"
          />

          {/* Floating Shoulder & Arm Right */}
          <rect
            x="96"
            y="92"
            width="18"
            height="42"
            rx="9"
            transform="rotate(-12 96 92)"
            fill="url(#botArmor)"
            stroke="#7DD3FC"
            strokeWidth="1.2"
          />
        </g>
      </svg>
    </div>
  );
};
