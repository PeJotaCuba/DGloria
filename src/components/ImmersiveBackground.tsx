/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ASSETS } from '../lib/assets';

interface ImmersiveBackgroundProps {
  progress: number;
  prefersReducedMotion: boolean;
}

export const ImmersiveBackground: React.FC<ImmersiveBackgroundProps> = ({
  progress,
  prefersReducedMotion,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Progressive zoom calculation: from 1.00 up to 1.30 as scroll progresses from 0 to 1
  // With transform-origin centered on the venue and focal points
  const scale = prefersReducedMotion ? 1.05 : 1 + progress * 0.28;
  const translateY = prefersReducedMotion ? 0 : progress * -3; // subtle 3% parallax shift

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#1E1E1E]"
    >
      {/* Fallback surface if image fails */}
      {imageError && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#1E1E1E] via-[#2A1F21] to-[#121212]" />
      )}

      {/* Main Photographic Background */}
      {!imageError && (
        <div
          className="absolute inset-0 w-full h-full transition-transform duration-100 ease-out"
          style={{
            transform: `scale(${scale}) translateY(${translateY}%)`,
            transformOrigin: '50% 45%',
            willChange: 'transform',
          }}
        >
          <img
            src={ASSETS.establishmentBg}
            alt="Ambiente y terraza de Doña Gloria"
            className={`w-full h-full object-cover object-center transition-opacity duration-700 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="eager"
            fetchPriority="high"
          />
        </div>
      )}

      {/* Atmosphere Scrim Layer 1: Global dark veil for text legibility */}
      <div className="absolute inset-0 bg-[#1E1E1E]/65" />

      {/* Atmosphere Scrim Layer 2: Editorial Vignette with Burdeos tint */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, rgba(155, 27, 48, 0.12) 0%, rgba(30, 30, 30, 0.6) 60%, rgba(20, 20, 20, 0.88) 100%)',
        }}
      />

      {/* Atmosphere Scrim Layer 3: Vertical Top/Bottom Contrast Gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1E1E1E]/80 via-transparent to-[#1E1E1E]/95" />
    </div>
  );
};
