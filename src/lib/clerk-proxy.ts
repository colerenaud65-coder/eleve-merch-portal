export function clerkDevProxyEnabled(publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  return publishableKey?.startsWith("pk_test_") === true;
}
