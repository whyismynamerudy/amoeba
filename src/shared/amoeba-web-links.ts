/** Amoeba's public web presence; every page the app opens for a user goes through here. */
export const AMOEBA_WEBSITE_URL = 'https://www.amoeba.sh'
export const AMOEBA_REPO_URL = 'https://github.com/whyismynamerudy/amoeba'
export const AMOEBA_REPO_SLUG = 'whyismynamerudy/amoeba'

/** A page on amoeba.sh, e.g. amoebaWebsiteUrl('/docs/ssh'). */
export function amoebaWebsiteUrl(path: string): string {
  return `${AMOEBA_WEBSITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export const AMOEBA_DOCS_URL = amoebaWebsiteUrl('/docs')
export const AMOEBA_CHANGELOG_URL = amoebaWebsiteUrl('/changelog')
export const AMOEBA_PRIVACY_URL = amoebaWebsiteUrl('/privacy')
export const AMOEBA_ISSUES_URL = `${AMOEBA_REPO_URL}/issues`
export const AMOEBA_NEW_ISSUE_URL = `${AMOEBA_REPO_URL}/issues/new`
