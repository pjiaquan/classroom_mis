import {
  adminFormDetails,
  adminForms,
  seededLeadForm,
} from "@/lib/forms/mock-data";
import { query } from "@/lib/db/client";
import {
  type AdminFormDefinition,
  type AdminFormSummary,
  type FormOption,
  type PublicFormDefinition,
  type PublicFormField,
} from "@/lib/forms/types";

export async function getPublishedFormBySlug(
  slug: string,
): Promise<PublicFormDefinition | null> {
  try {
    return await getFormBySlug(slug, true);
  } catch {
    if (slug === seededLeadForm.slug) {
      return seededLeadForm;
    }

    return null;
  }
}

export async function getAdminFormSummaries(): Promise<AdminFormSummary[]> {
  try {
    const result = await query<{
      id: number;
      name: string;
      slug: string;
      status: PublicFormDefinition["status"];
    }>(
      `
        SELECT id, name, slug, status
        FROM form_definitions
        ORDER BY updated_at DESC, id DESC
      `,
    );

    return result.rows;
  } catch {
    return adminForms;
  }
}

export async function getAdminFormById(
  id: number,
): Promise<AdminFormDefinition | null> {
  try {
    return await getFormById(id);
  } catch {
    return adminFormDetails.find((form) => form.id === id) ?? null;
  }
}

export const formSql = {
  publishedFormBySlug: `
    SELECT
      fd.id,
      fd.name,
      fd.slug,
      fd.status,
      fd.success_message,
      fd.theme_json,
      fd.settings_json
    FROM form_definitions fd
    WHERE fd.slug = $1
      AND fd.status = 'published'
  `,
  fieldsForDefinition: `
    SELECT
      ff.id,
      ff.field_key,
      ff.label,
      ff.field_type,
      ff.placeholder,
      ff.help_text,
      ff.is_required,
      ff.sort_order,
      ff.default_value,
      ff.validation_json,
      ff.ui_json,
      ff.mapping_json
    FROM form_fields ff
    WHERE ff.form_definition_id = $1
    ORDER BY ff.sort_order ASC, ff.id ASC
  `,
  optionsForField: `
    SELECT
      ffo.value,
      ffo.label,
      ffo.sort_order
    FROM form_field_options ffo
    WHERE ffo.form_field_id = $1
    ORDER BY ffo.sort_order ASC, ffo.id ASC
  `,
};

async function getFormBySlug(
  slug: string,
  publishedOnly: boolean,
): Promise<PublicFormDefinition | null> {
  const formResult = await query<{
    id: number;
    name: string;
    slug: string;
    status: PublicFormDefinition["status"];
    success_message: string | null;
    theme_json: Record<string, unknown>;
    settings_json: Record<string, unknown>;
  }>(
    `
      SELECT
        fd.id,
        fd.name,
        fd.slug,
        fd.status,
        fd.success_message,
        fd.theme_json,
        fd.settings_json
      FROM form_definitions fd
      WHERE fd.slug = $1
        ${publishedOnly ? "AND fd.status = 'published'" : ""}
      LIMIT 1
    `,
    [slug],
  );

  const row = formResult.rows[0];

  if (!row) {
    return null;
  }

  return buildFormDefinition(row);
}

async function getFormById(id: number): Promise<AdminFormDefinition | null> {
  const formResult = await query<{
    id: number;
    name: string;
    slug: string;
    status: PublicFormDefinition["status"];
    success_message: string | null;
    theme_json: Record<string, unknown>;
    settings_json: Record<string, unknown>;
  }>(
    `
      SELECT
        fd.id,
        fd.name,
        fd.slug,
        fd.status,
        fd.success_message,
        fd.theme_json,
        fd.settings_json
      FROM form_definitions fd
      WHERE fd.id = $1
      LIMIT 1
    `,
    [id],
  );

  const row = formResult.rows[0];

  if (!row) {
    return null;
  }

  return buildFormDefinition(row);
}

async function buildFormDefinition(row: {
  id: number;
  name: string;
  slug: string;
  status: PublicFormDefinition["status"];
  success_message: string | null;
  theme_json: Record<string, unknown>;
  settings_json: Record<string, unknown>;
}): Promise<PublicFormDefinition> {
  const fieldsResult = await query<{
    id: number;
    field_key: string;
    label: string;
    field_type: PublicFormField["fieldType"];
    placeholder: string | null;
    help_text: string | null;
    is_required: boolean;
    sort_order: number;
    width: "full" | "half";
    default_value: string | null;
    validation_json: Record<string, unknown>;
    ui_json: Record<string, unknown>;
    mapping_json: { target: string };
  }>(
    `
      SELECT
        ff.id,
        ff.field_key,
        ff.label,
        ff.field_type,
        ff.placeholder,
        ff.help_text,
        ff.is_required,
        ff.sort_order,
        ff.width,
        ff.default_value,
        ff.validation_json,
        ff.ui_json,
        ff.mapping_json
      FROM form_fields ff
      WHERE ff.form_definition_id = $1
      ORDER BY ff.sort_order ASC, ff.id ASC
    `,
    [row.id],
  );

  const fieldIds = fieldsResult.rows.map((field) => field.id);
  let optionsByFieldId = new Map<number, FormOption[]>();

  if (fieldIds.length > 0) {
    const optionsResult = await query<{
      form_field_id: number;
      value: string;
      label: string;
      sort_order: number;
    }>(
      `
        SELECT
          ffo.form_field_id,
          ffo.value,
          ffo.label,
          ffo.sort_order
        FROM form_field_options ffo
        WHERE ffo.form_field_id = ANY($1::bigint[])
        ORDER BY ffo.form_field_id ASC, ffo.sort_order ASC, ffo.id ASC
      `,
      [fieldIds],
    );

    optionsByFieldId = optionsResult.rows.reduce((map, option) => {
      const current = map.get(option.form_field_id) ?? [];
      current.push({
        value: option.value,
        label: option.label,
        sortOrder: option.sort_order,
      });
      map.set(option.form_field_id, current);
      return map;
    }, new Map<number, FormOption[]>());
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    successMessage: row.success_message,
    theme: {
      brandName: String(row.theme_json.brandName ?? "Classroom MIS"),
      logoUrl: String(row.theme_json.logoUrl ?? ""),
      fontHeading: String(row.theme_json.fontHeading ?? "Manrope"),
      fontBody: String(row.theme_json.fontBody ?? "Noto Sans TC"),
      colorPrimary: String(row.theme_json.colorPrimary ?? "#0f766e"),
      colorAccent: String(row.theme_json.colorAccent ?? "#f59e0b"),
      colorSurface: String(row.theme_json.colorSurface ?? "#f8fafc"),
      backgroundStyle: String(row.theme_json.backgroundStyle ?? "gradient-soft"),
      buttonStyle: String(row.theme_json.buttonStyle ?? "rounded"),
    },
    settings: row.settings_json,
    fields: fieldsResult.rows.map((field) => ({
      id: field.id,
      fieldKey: field.field_key,
      label: field.label,
      fieldType: field.field_type,
      placeholder: field.placeholder,
      helpText: field.help_text,
      isRequired: field.is_required,
      sortOrder: field.sort_order,
      width: field.width,
      defaultValue: field.default_value,
      validation: field.validation_json,
      ui: field.ui_json,
      mapping: field.mapping_json,
      options: optionsByFieldId.get(field.id) ?? [],
    })),
  };
}
