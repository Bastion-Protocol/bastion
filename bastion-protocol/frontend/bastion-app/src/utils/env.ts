type EnvRecord = Record<string, string | undefined>;

type GlobalWithProcess = typeof globalThis & {
  process?: {
    env?: EnvRecord;
  };
};

const getEnvRecord = (): EnvRecord | undefined => {
  const globalWithProcess = globalThis as GlobalWithProcess;
  return globalWithProcess.process?.env;
};

export const getEnvOrDefault = (key: string, fallback: string): string => {
  const value = getEnvRecord()?.[key];
  return value ?? fallback;
};

export const getEnvNumber = (key: string): number | undefined => {
  const value = getEnvRecord()?.[key];
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
