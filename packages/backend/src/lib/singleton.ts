/** @public — required for declaration emit */
export interface Singleton<T> {
  get(): T;
}

export function singleton<T>(factory: () => T): Singleton<T> {
  let instance: T | undefined;
  return {
    get(): T {
      if (instance === undefined) {
        instance = factory();
      }
      return instance;
    },
  };
}
