// src/constants/substitution.ts

/**
 * Constants for absence and substitution system
 */
export const SUBSTITUTION_LIMITS = {
  /** Maximum number of substitution assignments per teacher per day */
  MAX_DAILY_SUBSTITUTIONS: 5,
  
  /** Delay in milliseconds before starting auto-assignment (for UI feedback) */
  AUTO_ASSIGN_DELAY_MS: 600,
  
  /** Minimum score required for auto-approval */
  MIN_APPROVAL_SCORE: 50,
  
  /** Maximum substitutions per teacher per week */
  MAX_WEEKLY_LOAD: 20,
} as const;

/**
 * Priority weights for candidate scoring
 */
export const PRIORITY_WEIGHTS = {
  /** Class educator (مربي الصف) - highest priority */
  CLASS_EDUCATOR: 100,
  
  /** Teacher with same subject specialty */
  SAME_SUBJECT: 80,
  
  /** Teacher with free period */
  FREE_PERIOD: 70,
  
  /** Teacher with individual lesson */
  INDIVIDUAL_LESSON: 60,
  
  /** Teacher with stay/supervision lesson */
  STAY_LESSON: 40,
  
  /** External substitute */
  EXTERNAL_SUBSTITUTE: 30,
} as const;
