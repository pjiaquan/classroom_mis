import { z } from "zod";
import { type PublicFormDefinition } from "@/lib/forms/types";

export function buildSubmissionSchema(form: PublicFormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of form.fields) {
    if (field.fieldType === "image" || field.fieldType === "file") {
      continue;
    }

    let schema: z.ZodTypeAny;

    if (field.fieldType === "checkbox") {
      schema = z.array(z.string()).optional();
    } else {
      let stringSchema = z.string();

      if (typeof field.validation.minLength === "number") {
        stringSchema = stringSchema.min(
          Number(field.validation.minLength),
          `${field.label} is too short.`,
        );
      }

      if (typeof field.validation.maxLength === "number") {
        stringSchema = stringSchema.max(
          Number(field.validation.maxLength),
          `${field.label} is too long.`,
        );
      }

      let finalSchema: z.ZodTypeAny = field.isRequired
        ? stringSchema.min(1, `${field.label} is required.`)
        : stringSchema.optional();

      const allowedValues = Array.isArray(field.validation.allowedValues)
        ? field.validation.allowedValues.filter(
            (value): value is string => typeof value === "string",
          )
        : null;

      if (allowedValues) {
        finalSchema = finalSchema.refine(
          (value) =>
            typeof value !== "string" ||
            value.length === 0 ||
            allowedValues.includes(value),
          `${field.label} is invalid.`,
        );
      }

      schema = finalSchema;
    }

    shape[field.fieldKey] = schema;
  }

  return z.object(shape).strip();
}
