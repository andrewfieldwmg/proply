'use client';

export default function ThemeToggle() {
  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('proply-theme', nextTheme);
    window.dispatchEvent(new CustomEvent('proply-theme-change', { detail: nextTheme }));
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle light or dark mode"
      title="Toggle light or dark mode"
    >
      <span className="theme-choice-dark" aria-hidden="true">☾ <span className="theme-toggle-label">Dark</span></span>
      <span className="theme-choice-light" aria-hidden="true">☀ <span className="theme-toggle-label">Light</span></span>
    </button>
  );
}
