export function waitForCondition() {
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
        rejectTimer = setTimeout(reject, timeout);
      });
    },
  };
}
