/**
 * Reads a required environment variable and throws if it is missing.
 */
export const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

/**
 * Reads an optional environment variable and returns undefined if empty.
 */
export const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
};
