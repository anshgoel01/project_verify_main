/**
 * Centralized app constants.
 * Override via env vars when needed (e.g. in production).
 */
const HEAD_ADMIN_EMAILS_RAW = import.meta.env.VITE_HEAD_ADMIN_EMAILS;
export const HEAD_ADMIN_EMAILS: string[] = HEAD_ADMIN_EMAILS_RAW
  ? HEAD_ADMIN_EMAILS_RAW.split(",").map((e: string) => e.trim()).filter(Boolean)
  : ["agoel2_be23@thapar.edu", "prashant.singh@thapar.edu"];

export const isHeadAdmin = (email: string | undefined | null): boolean =>
  !!email && HEAD_ADMIN_EMAILS.includes(email);

export const THAPAR_COLLEGE_ID =
  import.meta.env.VITE_THAPAR_COLLEGE_ID || "d8958a90-d06a-467e-818d-64277f84f5c3";
