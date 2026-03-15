import arCommon from "../../locales/ar/common.json";
import arDashboard from "../../locales/ar/dashboard.json";
import arOrders from "../../locales/ar/orders.json";
import arProducts from "../../locales/ar/products.json";
import arProfile from "../../locales/ar/profile.json";
import arSuppliers from "../../locales/ar/suppliers.json";
import enCommon from "../../locales/en/common.json";
import enDashboard from "../../locales/en/dashboard.json";
import enOrders from "../../locales/en/orders.json";
import enProducts from "../../locales/en/products.json";
import enProfile from "../../locales/en/profile.json";
import enSuppliers from "../../locales/en/suppliers.json";
import koCommon from "../../locales/ko/common.json";
import koDashboard from "../../locales/ko/dashboard.json";
import koOrders from "../../locales/ko/orders.json";
import koProducts from "../../locales/ko/products.json";
import koProfile from "../../locales/ko/profile.json";
import koSuppliers from "../../locales/ko/suppliers.json";
import mnCommon from "../../locales/mn/common.json";
import mnDashboard from "../../locales/mn/dashboard.json";
import mnOrders from "../../locales/mn/orders.json";
import mnProducts from "../../locales/mn/products.json";
import mnProfile from "../../locales/mn/profile.json";
import mnSuppliers from "../../locales/mn/suppliers.json";
import {
  detectLanguageFromBrowser,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@/lib/i18n-config";

export type { SupportedLanguage } from "@/lib/i18n-config";

type Dictionary = Record<string, string>;

function mergeDictionary(...sources: Dictionary[]) {
  return sources.reduce<Dictionary>((acc, source) => Object.assign(acc, source), {});
}

const dictionaries: Record<SupportedLanguage, Dictionary> = {
  ko: mergeDictionary(koCommon, koDashboard, koOrders, koProducts, koSuppliers, koProfile),
  en: mergeDictionary(enCommon, enDashboard, enOrders, enProducts, enSuppliers, enProfile),
  mn: mergeDictionary(mnCommon, mnDashboard, mnOrders, mnProducts, mnSuppliers, mnProfile),
  ar: mergeDictionary(arCommon, arDashboard, arOrders, arProducts, arSuppliers, arProfile),
};

const STORAGE_KEY = "language";
const LEGACY_STORAGE_KEY = "arklux-ui-language";

let currentLanguage: SupportedLanguage = "en";
const subscribers = new Set<() => void>();
const warnedMissingKeys = new Set<string>();

type LanguageLoadOptions = {
  persist?: boolean;
};

function notify() {
  for (const callback of subscribers) {
    callback();
  }
}

function applyDocumentDirection(lang: SupportedLanguage) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function loadLanguage(
  lang?: string | null,
  options: LanguageLoadOptions = {},
) {
  return loadLanguageWithOptions(lang, options);
}

function readStoredLanguage(): SupportedLanguage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isSupportedLanguage(stored)) {
    return stored;
  }

  const legacyStored = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (isSupportedLanguage(legacyStored)) {
    window.localStorage.setItem(STORAGE_KEY, legacyStored);
    return legacyStored;
  }

  return null;
}

function loadLanguageWithOptions(
  lang?: string | null,
  options: LanguageLoadOptions = {},
) {
  const shouldPersist = options.persist ?? true;
  const nextLanguage = isSupportedLanguage(lang) ? lang : getCurrentLanguage();
  currentLanguage = nextLanguage;
  if (typeof window !== "undefined" && shouldPersist) {
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }
  applyDocumentDirection(nextLanguage);
  notify();
}

export function translate(key: string) {
  const currentValue = dictionaries[currentLanguage][key];
  if (currentValue) {
    return currentValue;
  }

  const fallbackValue = dictionaries.en[key];
  if (fallbackValue) {
    if (process.env.NODE_ENV === "development") {
      const warnKey = `${currentLanguage}:${key}`;
      if (!warnedMissingKeys.has(warnKey)) {
        warnedMissingKeys.add(warnKey);
        console.warn(`Missing translation key: ${key}`);
      }
    }
    return fallbackValue;
  }

  if (process.env.NODE_ENV === "development") {
    const warnKey = `missing:${key}`;
    if (!warnedMissingKeys.has(warnKey)) {
      warnedMissingKeys.add(warnKey);
      console.warn(`Missing translation key: ${key}`);
    }
  }

  return key;
}

export function setLanguage(lang: SupportedLanguage, options: LanguageLoadOptions = {}) {
  loadLanguageWithOptions(lang, options);
}

export function getCurrentLanguage() {
  if (typeof window !== "undefined") {
    const stored = readStoredLanguage();
    if (stored) {
      currentLanguage = stored;
      return currentLanguage;
    }
    currentLanguage = detectLanguageFromBrowser(window.navigator.language);
  }
  return currentLanguage;
}

export function subscribeLanguage(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
