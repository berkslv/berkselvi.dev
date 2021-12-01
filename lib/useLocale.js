export default function useLocale(router) {

  const { locale, locales, defaultLocale } = router;

    if (locale === defaultLocale) 
        return "EN";

    if (locale.includes("tr")) 
        return "TR";
 
    if (!locales.includes(locale)) 
        return "EN"
}
