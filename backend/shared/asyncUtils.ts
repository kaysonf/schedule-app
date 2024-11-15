export function waitForCondition(name?: string) {
  let cond: () => void | undefined = undefined;
  let done = false;
  let rejectTimer: NodeJS.Timeout;
  return {
    done: () => {
      if (cond === undefined) {
        done = true;
      } else {
        cond();
      }
    },
    condition: async (timeout: number) => {
      if (done) return;
      return new Promise((resolve, reject) => {
        cond = () => {
          clearTimeout(rejectTimer);
          resolve();
        };
        rejectTimer = setTimeout(
          () => reject(`condition ${name} timed out after ${timeout}ms`),
          timeout
        );
      });
    },
  };
}

export function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
