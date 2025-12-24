const isDev = import.meta.env.DEV;

export const logDev = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

export const warnDev = (...args: unknown[]) => {
  if (isDev) console.warn(...args);
};

export const errorDev = (...args: unknown[]) => {
  if (isDev) console.error(...args);
};








