'use client';

import React from 'react';
import './SkipToMain.css';

/**
 * SkipToMain component
 *
 * Provides a "Skip to main content" link that:
 * - Is hidden by default
 * - Becomes visible when focused (keyboard navigation)
 * - Allows screen reader users to jump directly to main content
 * - Improves accessibility for users with keyboard-only navigation
 *
 * Usage: Place at the beginning of your layout, before the header
 */
export const SkipToMain: React.FC = () => {
  const handleSkipClick = () => {
    const mainContent = document.querySelector('main') || document.querySelector('.wrapper');
    if (mainContent) {
      // Focus the main element
      (mainContent as HTMLElement).focus();
      mainContent.scrollIntoView();
    }
  };

  return (
    <a
      href="#main-content"
      className="skip-to-main"
      onClick={handleSkipClick}
      role="navigation"
      aria-label="Aller au contenu principal"
    >
      Aller au contenu principal
    </a>
  );
};

export default SkipToMain;
