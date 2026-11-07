/** Most step dots a phone shows under the question; more than this and they'd wrap on a 390px screen, so it shows "3 / 10". */
export const MAX_STEP_DOTS = 8;

export const showStepDots = (count: number) => count <= MAX_STEP_DOTS;
