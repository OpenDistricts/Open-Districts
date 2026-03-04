// Central state -> language visibility config for the topbar language selector.
// Keep locale codes aligned with available entries in mock-translations.

export const DEFAULT_AVAILABLE_LOCALES = ["en", "hi"];

// Preferred order per state/UT. Only listed locales are shown to users in that state
// (plus "en" as a universal fallback).
export const STATE_LANGUAGE_PREFERENCES = {
  AN: ["en", "hi", "bn", "ta"],
  AP: ["en", "te", "hi"],
  AR: ["en", "hi"],
  AS: ["en", "hi", "bn"],
  BR: ["en", "hi", "ur"],
  CH: ["en", "hi", "pa"],
  CT: ["en", "hi"],
  DD: ["en", "gu", "hi"],
  DL: ["en", "hi", "ur", "pa"],
  DN: ["en", "gu", "hi"],
  GA: ["en", "mr", "hi"],
  GJ: ["en", "gu", "hi", "mr"],
  HP: ["en", "hi"],
  HR: ["en", "hi", "pa"],
  JH: ["en", "hi", "bn"],
  JK: ["en", "ur", "hi"],
  KA: ["en", "kn", "hi"],
  KL: ["en", "ta", "hi"],
  LD: ["en", "ta", "hi"],
  MH: ["en", "mr", "hi"],
  ML: ["en", "hi"],
  MN: ["en", "hi"],
  MP: ["en", "hi"],
  MZ: ["en", "hi"],
  NL: ["en", "hi"],
  OD: ["en", "or", "hi"],
  PB: ["en", "pa", "hi"],
  PY: ["en", "ta", "hi"],
  RJ: ["en", "hi"],
  SK: ["en", "hi"],
  TN: ["en", "ta", "hi"],
  TR: ["en", "bn", "hi"],
  TS: ["en", "te", "hi", "ur"],
  UP: ["en", "hi", "ur"],
  UT: ["en", "hi"],
  WB: ["en", "bn", "hi"],
};

