import joplin from 'api';

// src/decorators.ts
export function TryCatch(options?: {
  fallback?: any;
  logError?: boolean;
  rethrow?: boolean;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        const result = originalMethod.apply(this, args);
        // Handle both sync and async methods
        return result instanceof Promise ? await result : result;
      } catch (error) {
        // Optional: Log to Joplin console
        if (options?.logError ?? true) {
          console.error(`[TryCatch] Error in ${propertyKey}:`, error);
        }

        // Optional: Return fallback value
        if (options?.fallback !== undefined) {
          return options.fallback;
        }

        // Optional: Rethrow
        if (options?.rethrow) {
          throw error;
        }

        // Default: swallow error, return undefined
        return undefined;
      }
    };

    return descriptor;
  };
}


export function Log(prefix: string = '') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      console.log(`${prefix}[LOG] ${propertyKey} called with:`, args);
      const result = original.apply(this, args);
      console.log(`${prefix}[LOG] ${propertyKey} result:`, result);
      return result;
    };
    return descriptor;
  };
}



export function Trace() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Check debug setting
      let debugEnabled = false;
      try {
        debugEnabled = await joplin.settings.value('debug');
      } catch {}

      if (!debugEnabled) {
        return originalMethod.apply(this, args);
      }

      const className = target.constructor.name;
      const methodName = `${className}.${propertyKey}`;

      console.info(`[TRACE] → ${methodName}`, args);

      try {
        const result = await originalMethod.apply(this, args);
        console.info(`[TRACE] ← ${methodName}`, result);
        return result;
      } catch (error) {
        console.error(`[TRACE] ✗ ${methodName} threw:`, error);
        throw error;
      }
    };

    return descriptor;
  };
}