/**
 * Telegram Mini App utilities
 * Provides helpers for BackButton, HapticFeedback, theme, etc.
 */

/**
 * Gets Telegram WebApp instance
 */
export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/**
 * BackButton utilities
 */
export const BackButton = {
  /**
   * Shows back button with callback
   */
  show(onClick: () => void): void {
    const tg = getTelegramWebApp();
    if (tg?.BackButton) {
      tg.BackButton.show();
      tg.BackButton.onClick(onClick);
    }
  },

  /**
   * Hides back button
   */
  hide(): void {
    const tg = getTelegramWebApp();
    if (tg?.BackButton) {
      tg.BackButton.hide();
    }
  },

  /**
   * Checks if back button is visible
   */
  isVisible(): boolean {
    const tg = getTelegramWebApp();
    return tg?.BackButton?.isVisible || false;
  },
};

/**
 * HapticFeedback utilities
 */
export const HapticFeedback = {
  /**
   * Triggers impact feedback
   */
  impact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium'): void {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred(style);
      } catch (error) {
        // Silently fail if haptic feedback is not available
        console.debug('Haptic feedback not available');
      }
    }
  },

  /**
   * Triggers notification feedback
   */
  notification(type: 'error' | 'success' | 'warning'): void {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.notificationOccurred(type);
      } catch (error) {
        console.debug('Haptic feedback not available');
      }
    }
  },

  /**
   * Triggers selection feedback
   */
  selection(): void {
    const tg = getTelegramWebApp();
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.selectionChanged();
      } catch (error) {
        console.debug('Haptic feedback not available');
      }
    }
  },
};

/**
 * Theme utilities
 */
export const Theme = {
  /**
   * Gets current theme (light/dark)
   */
  getColorScheme(): 'light' | 'dark' {
    const tg = getTelegramWebApp();
    return tg?.colorScheme || 'light';
  },

  /**
   * Gets theme parameters
   */
  getParams() {
    const tg = getTelegramWebApp();
    return tg?.themeParams || {};
  },

  /**
   * Applies theme colors to document
   */
  applyTheme(): void {
    const tg = getTelegramWebApp();
    if (!tg?.themeParams) return;

    const params = tg.themeParams;
    const root = document.documentElement;

    if (params.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', params.bg_color);
    }
    if (params.text_color) {
      root.style.setProperty('--tg-theme-text-color', params.text_color);
    }
    if (params.hint_color) {
      root.style.setProperty('--tg-theme-hint-color', params.hint_color);
    }
    if (params.link_color) {
      root.style.setProperty('--tg-theme-link-color', params.link_color);
    }
    if (params.button_color) {
      root.style.setProperty('--tg-theme-button-color', params.button_color);
    }
    if (params.button_text_color) {
      root.style.setProperty('--tg-theme-button-text-color', params.button_text_color);
    }
  },
};

/**
 * MainButton utilities
 */
export const MainButton = {
  /**
   * Shows main button
   */
  show(): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.show();
    }
  },

  /**
   * Hides main button
   */
  hide(): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.hide();
    }
  },

  /**
   * Sets button text
   */
  setText(text: string): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.setText(text);
    }
  },

  /**
   * Sets button click handler
   */
  onClick(handler: () => void): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.onClick(handler);
    }
  },

  /**
   * Shows progress on button
   */
  showProgress(): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.showProgress();
    }
  },

  /**
   * Hides progress on button
   */
  hideProgress(): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.hideProgress();
    }
  },

  /**
   * Enables button
   */
  enable(): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.enable();
    }
  },

  /**
   * Disables button
   */
  disable(): void {
    const tg = getTelegramWebApp();
    if (tg?.MainButton) {
      tg.MainButton.disable();
    }
  },
};
