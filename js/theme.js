(() => {
  const storageKey = 'ebenliving:theme';
  const button = document.getElementById('themeToggle');
  let theme = 'light';

  try {
    theme = localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
  } catch {
    // Keep the default light theme when browser storage is unavailable.
  }

  const applyTheme = () => {
    document.documentElement.dataset.theme = theme;
    if (!button) return;
    const dark = theme === 'dark';
    button.textContent = dark ? '☀️ Claro' : '🌙 Escuro';
    button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    button.setAttribute('aria-pressed', String(dark));
    button.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
  };

  applyTheme();
  button?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // The theme still applies for the current page.
    }
    applyTheme();
  });
})();
