/**
 * usePreferences - Manages user preferences with localStorage persistence
 * Handles favorites, recent calculators, dark mode, and disclaimer state
 */
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEYS = {
  FAVORITES: "radulator-favorites",
  RECENT: "radulator-recent",
  DARK_MODE: "radulator-dark-mode",
  DISCLAIMER_SEEN: "radulator-disclaimer-seen",
  WELCOME_SEEN: "radulator-welcome-seen",
};

const MAX_RECENT = 5;

/**
 * Safe localStorage getter with fallback
 */
function getStoredValue(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe localStorage setter
 */
function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Hook for managing user preferences
 */
export function usePreferences() {
  // Favorites
  const [favorites, setFavoritesState] = useState(() =>
    getStoredValue(STORAGE_KEYS.FAVORITES, []),
  );

  // Recent calculators
  const [recentCalcs, setRecentCalcsState] = useState(() =>
    getStoredValue(STORAGE_KEYS.RECENT, []),
  );

  // Dark mode - check system preference as fallback
  const [darkMode, setDarkModeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
      if (stored !== null) return stored === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  // Disclaimer visibility
  const [showDisclaimer, setShowDisclaimerState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.DISCLAIMER_SEEN) !== "true";
    } catch {
      return true;
    }
  });

  // Welcome card visibility (one-time)
  const [showWelcome, setShowWelcomeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN) !== "true";
    } catch {
      return true;
    }
  });

  // Toggle favorite
  const toggleFavorite = useCallback((calcId) => {
    setFavoritesState((prev) => {
      const newFavorites = prev.includes(calcId)
        ? prev.filter((id) => id !== calcId)
        : [...prev, calcId];
      setStoredValue(STORAGE_KEYS.FAVORITES, newFavorites);
      return newFavorites;
    });
  }, []);

  // Check if calculator is favorited
  const isFavorite = useCallback(
    (calcId) => favorites.includes(calcId),
    [favorites],
  );

  // Add to recent calculators
  const addToRecent = useCallback((calcId) => {
    setRecentCalcsState((prev) => {
      const filtered = prev.filter((id) => id !== calcId);
      const newRecent = [calcId, ...filtered].slice(0, MAX_RECENT);
      setStoredValue(STORAGE_KEYS.RECENT, newRecent);
      return newRecent;
    });
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setDarkModeState((prev) => {
      const newMode = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(newMode));
      } catch {
        // Silently fail
      }
      return newMode;
    });
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Dismiss disclaimer
  const dismissDisclaimer = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DISCLAIMER_SEEN, "true");
    } catch {
      // Silently fail
    }
    setShowDisclaimerState(false);
  }, []);

  // Dismiss welcome card
  const dismissWelcome = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, "true");
    } catch {
      // Silently fail
    }
    setShowWelcomeState(false);
  }, []);

  return {
    // Favorites
    favorites,
    toggleFavorite,
    isFavorite,
    // Recent
    recentCalcs,
    addToRecent,
    // Dark mode
    darkMode,
    toggleDarkMode,
    // Disclaimer
    showDisclaimer,
    dismissDisclaimer,
    // Welcome
    showWelcome,
    dismissWelcome,
  };
}

export default usePreferences;
