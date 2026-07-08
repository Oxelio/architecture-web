import { useTranslation } from "react-i18next";
import { changeLanguage, type Language } from "../i18n";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language.startsWith("en") ? "en" : "fr";

  const handleChange = (language: Language) => {
    changeLanguage(language);
  };

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-3 py-2">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
        {t("language.label")}
      </span>
      <button
        type="button"
        onClick={() => handleChange("fr")}
        className={`rounded-full px-2.5 py-1 text-sm font-semibold transition ${
          currentLanguage === "fr"
            ? "bg-slate-100 text-slate-950"
            : "text-slate-300 hover:text-white"
        }`}
      >
        {t("language.french")}
      </button>
      <button
        type="button"
        onClick={() => handleChange("en")}
        className={`rounded-full px-2.5 py-1 text-sm font-semibold transition ${
          currentLanguage === "en"
            ? "bg-slate-100 text-slate-950"
            : "text-slate-300 hover:text-white"
        }`}
      >
        {t("language.english")}
      </button>
    </div>
  );
}
