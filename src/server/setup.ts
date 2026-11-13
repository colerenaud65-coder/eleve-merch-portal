export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
