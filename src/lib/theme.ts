export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/**
 * Runs in <head> before the page paints, so the right colours are there from
 * the first frame (no flash). A saved choice wins; otherwise it follows the
 * system setting.
 */
export const THEME_SCRIPT = `(function () {
  var theme = null;
  try { theme = localStorage.getItem("${THEME_STORAGE_KEY}"); } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();`;
