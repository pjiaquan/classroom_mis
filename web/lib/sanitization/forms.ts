import {
  type PublicFormDefinition,
  type SubmissionStoredFile,
} from "@/lib/forms/types";

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function normalizePhone(value: string) {
  return value.trim().replace(/[\s\-()]+/g, "");
}

export function normalizeSubmissionPayload(
  form: PublicFormDefinition,
  payload: Record<string, unknown>,
) {
  const cleanedPayload: Record<string, unknown> = {};

  for (const field of form.fields) {
    const rawValue = payload[field.fieldKey];

    if (field.fieldType === "image" || field.fieldType === "file") {
      if (rawValue) {
        cleanedPayload[field.fieldKey] = rawValue as SubmissionStoredFile;
      }
      continue;
    }

    if (field.fieldType === "checkbox") {
      if (Array.isArray(rawValue)) {
        cleanedPayload[field.fieldKey] = rawValue
          .filter((value): value is string => typeof value === "string")
          .map(collapseWhitespace)
          .filter(Boolean);
      }
      continue;
    }

    if (typeof rawValue !== "string") {
      if (rawValue !== undefined) {
        cleanedPayload[field.fieldKey] = rawValue;
      }
      continue;
    }

    const sanitized = stripHtml(rawValue);
    const normalized =
      field.fieldType === "phone"
        ? normalizePhone(sanitized)
        : collapseWhitespace(sanitized);

    cleanedPayload[field.fieldKey] = normalized === "" ? "" : normalized;
  }

  return {
    cleanedPayload,
  };
}
