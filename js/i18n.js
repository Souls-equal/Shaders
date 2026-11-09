import { messages } from './translations.js';

export const LANGUAGE_KEY = 'bloxd-file-share-language';
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'fr']);
const listeners = new Set();
let initialized = false;
let language = 'en';
try {
  const saved = globalThis.localStorage?.getItem(LANGUAGE_KEY);
  if (SUPPORTED_LANGUAGES.includes(saved)) language = saved;
} catch { /* Private browsing or blocked storage: keep English as the default. */ }

export function getLanguage() { return language; }
export function getLocale() { return language === 'fr' ? 'fr-FR' : 'en-US'; }
export function t(key, params = {}) {
  const template = messages[language][key] ?? messages.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}
export function number(value, options = {}) { return new Intl.NumberFormat(getLocale(), options).format(value); }
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return t('size.unknown');
  if (bytes < 1024) return `${number(bytes)} ${t('size.byte')}`;
  const megabytes = bytes >= 1024 * 1024;
  return `${number(bytes / (megabytes ? 1024 * 1024 : 1024), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${t(megabytes ? 'size.mb' : 'size.kb')}`;
}
/** Catalogue identifiers, filenames, author names, hashes and proper names never change. */
export function packText(pack, field) {
  const key = `pack.${pack.id}.${field}`;
  return pack.translations?.[language]?.[field] ?? messages[language][key] ?? (field === 'description' ? pack.description : pack.preview?.[field]) ?? '';
}
export function categoryText(category, field) { return t(`category.${category.id}.${field}`); }

export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  for (const attribute of ['aria-label', 'title', 'content']) {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(node => {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    });
  }
  document.documentElement.lang = language;
  root.querySelectorAll('[data-language-toggle]').forEach(button => {
    button.setAttribute('aria-label', t('language.switch'));
    button.setAttribute('title', t('language.switch'));
    button.setAttribute('aria-pressed', String(language === 'fr'));
    button.querySelectorAll('[data-language-option]').forEach(label => {
      label.classList.toggle('active-language', label.dataset.languageOption === language);
    });
  });
}
export function setLanguage(next, { persist = true } = {}) {
  language = SUPPORTED_LANGUAGES.includes(next) ? next : 'en';
  if (persist) {
    try { globalThis.localStorage?.setItem(LANGUAGE_KEY, language); } catch { /* Selection still works without storage. */ }
  }
  if (typeof document !== 'undefined') translatePage();
  listeners.forEach(listener => listener(language));
}
export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function initI18n() {
  if (initialized) return;
  initialized = true;
  translatePage();
  document.querySelectorAll('[data-language-toggle]').forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => setLanguage(language === 'en' ? 'fr' : 'en'));
  });
  // Keep the catalogue and a separately opened diagnostic tab in sync.
  window.addEventListener('storage', event => {
    if (event.key === LANGUAGE_KEY || event.key === null) setLanguage(event.newValue, { persist: false });
  });
}
