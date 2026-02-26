import { languages } from "../client/src/i18n";

if (!languages.ar) {
  throw new Error("Arabic language not registered");
}

console.log("Arabic i18n foundation initialized successfully.");
