'use strict';

// Eagerly resolve Expo's `__ExpoImportMetaRegistry` lazy global. The winter
// runtime installs this as a lazy getter, and on Windows + Jest's native
// preset, something (likely Jest's globals iteration) triggers the getter
// outside of "test code" scope, which Jest then refuses to satisfy with
// `ReferenceError: You are trying to import a file outside of the scope of
// the test code.` Forcing the getter to run during setup (when we ARE in
// scope) replaces it with the resolved value, so later accesses are no-ops.
const winterLazyGlobals = [
  '__ExpoImportMetaRegistry',
  'structuredClone',
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
];
for (const name of winterLazyGlobals) {
  try {
    void globalThis[name];
  } catch {
    // Best-effort: if it can't be resolved, fall through. Tests will fail
    // with a clearer error if they actually need it.
  }
}

require('@testing-library/jest-native/extend-expect');
