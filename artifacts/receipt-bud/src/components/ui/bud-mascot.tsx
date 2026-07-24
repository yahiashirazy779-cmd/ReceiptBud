import React, { HTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BudMascotProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  emotion?: "happy" | "neutral" | "celebrate" | "think" | "wave";
  floating?: boolean;
}

export function BudMascot({ 
  size = 100, 
  emotion = "neutral", 
  floating = true,
  className,
  ...props 
}: BudMascotProps) {
  
  const floatingVariants: any = {
    initial: { y: 0 },
    animate: { 
      y: floating ? [-5, 5, -5] : 0,
      transition: { 
        duration: 4, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }
    }
  };

  const eyeVariants = {
    neutral: { scaleY: 1 },
    happy: { scaleY: [1, 0.1, 1], transition: { times: [0, 0.5, 1], duration: 0.3 } },
    celebrate: { scaleY: [1, 0.1, 1], transition: { repeat: Infinity, repeatDelay: 1, duration: 0.3 } },
    think: { scaleY: 0.8, x: 2 }
  };

  const antennaVariants = {
    neutral: { rotate: 0 },
    think: { rotate: [0, 15, -15, 0], transition: { repeat: Infinity, duration: 2 } },
    celebrate: { rotate: [0, 20, -20, 0], transition: { repeat: Infinity, duration: 0.5 } }
  };

  return (
    <motion.div 
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      variants={floatingVariants}
      initial="initial"
      animate="animate"
      {...props}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <linearGradient id="bud-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#0f9d58" />
          </linearGradient>
          <linearGradient id="bud-glass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Hover Rings */}
        <ellipse cx="50" cy="92" rx="20" ry="4" fill="#0f9d58" opacity="0.15" filter="url(#glow)" />
        <ellipse cx="50" cy="92" rx="10" ry="2" fill="#0f9d58" opacity="0.3" />

        {/* Antenna Group */}
        <motion.g variants={antennaVariants as any} animate={emotion} style={{ transformOrigin: "50px 20px" }}>
          <line x1="50" y1="22" x2="50" y2="8" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="8" r="4" fill={emotion === 'celebrate' || emotion === 'think' ? "#f59e0b" : "#0f9d58"} filter="url(#glow)" />
        </motion.g>
        
        {/* Head */}
        <rect x="25" y="20" width="50" height="42" rx="16" fill="url(#bud-bg)" />
        <rect x="25" y="20" width="50" height="42" rx="16" fill="url(#bud-glass)" />
        
        {/* Face Screen */}
        <rect x="31" y="28" width="38" height="22" rx="8" fill="#0f172a" />
        
        {/* Eyes Group */}
        <motion.g variants={eyeVariants as any} animate={emotion} style={{ transformOrigin: "50px 39px" }}>
          {emotion === 'happy' || emotion === 'celebrate' ? (
            <>
              <path d="M 37 41 Q 41 35 45 41" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
              <path d="M 55 41 Q 59 35 63 41" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
            </>
          ) : (
            <>
              <circle cx="41" cy="39" r="3.5" fill="#22c55e" filter="url(#glow)" />
              <circle cx="59" cy="39" r="3.5" fill="#22c55e" filter="url(#glow)" />
            </>
          )}
        </motion.g>

        {/* Cheeks */}
        {(emotion === 'happy' || emotion === 'celebrate') && (
          <>
            <ellipse cx="35" cy="43" rx="3" ry="2" fill="#fb7185" opacity="0.6" />
            <ellipse cx="65" cy="43" rx="3" ry="2" fill="#fb7185" opacity="0.6" />
          </>
        )}
        
        {/* Body */}
        <rect x="35" y="66" width="30" height="18" rx="9" fill="#f8fafc" />
        <rect x="35" y="66" width="30" height="18" rx="9" fill="url(#bud-glass)" />
        
        {/* Heart/Core */}
        <circle cx="50" cy="75" r="4.5" fill={emotion === 'happy' ? "#fb7185" : "#0f9d58"} filter="url(#glow)" />

        {/* Arms (Wave) */}
        {emotion === 'wave' && (
          <motion.g
            animate={{ rotate: [0, 45, 0, 45, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 1 }}
            style={{ transformOrigin: "28px 70px" }}
          >
            <path d="M 32 70 Q 20 60 15 50" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
            <circle cx="15" cy="50" r="4" fill="#0f9d58" />
          </motion.g>
        )}
        {emotion !== 'wave' && (
          <g>
            <path d="M 32 72 Q 25 78 28 85" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
            <path d="M 68 72 Q 75 78 72 85" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
          </g>
        )}

      </svg>
    </motion.div>
  );
}
