const PRODUCTION_SITE_URL = 'https://campusconnect.rameshworchaudhary.com.np';

/** Build absolute Auth callback URLs from one environment-aware site origin. */
export const getAuthRedirectUrl = (path: string): string => {
  const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
  const siteOrigin = configuredSiteUrl
    ? new URL(configuredSiteUrl).origin
    : import.meta.env.DEV && typeof window !== 'undefined'
      ? window.location.origin
      : PRODUCTION_SITE_URL;

  return new URL(path, `${siteOrigin}/`).toString();
};
