/**
 * Types for the plain-JS registry helpers, so the patch tripwire test can
 * import INTENTIONAL without the whole scripts/ directory becoming `any`.
 */
export declare const BASE: string
export declare const INTENTIONAL: Record<string, string>
export declare const applyLocalRewrites: (source: string) => string
export declare const isRepoOwned: (target: string) => boolean
export declare const toItemName: (dep: string) => string
