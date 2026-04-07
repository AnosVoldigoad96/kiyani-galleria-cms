import { createClient } from "@nhost/nhost-js";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const authUrl = process.env.NEXT_PUBLIC_NHOST_AUTH_URL;
const graphqlUrl = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL;
const storageUrl = process.env.NEXT_PUBLIC_NHOST_STORAGE_URL;
const functionsUrl = process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL;

export const nhostConfigError =
  subdomain && region
    ? null
    : authUrl
      ? null
      : "Missing Nhost configuration. Set NEXT_PUBLIC_NHOST_SUBDOMAIN and NEXT_PUBLIC_NHOST_REGION, or provide NEXT_PUBLIC_NHOST_AUTH_URL.";

export const nhost =
  nhostConfigError === null
    ? createClient({
        subdomain,
        region,
        authUrl,
        graphqlUrl,
        storageUrl,
        functionsUrl,
      })
    : null;
