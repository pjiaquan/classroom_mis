import { getPublishedFormBySlug } from "@/lib/forms/repository";
import { buildSubmissionSchema } from "@/lib/forms/schema";
import { withTransaction } from "@/lib/db/client";
import { normalizeSubmissionPayload } from "@/lib/sanitization/forms";
import { verifyTurnstileToken } from "@/lib/anti-spam/turnstile";
import {
  type PublicFormDefinition,
  type SubmissionStoredFile,
} from "@/lib/forms/types";
import { persistUploadedFile } from "@/lib/uploads/service";

type SubmitPublicFormInput = {
  slug: string;
  payload: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
};

type SubmitPublicFormResult =
  | {
      ok: true;
      submissionId: number;
      leadId: number;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
      fieldErrors?: Record<string, string>;
    };

export async function submitPublicForm(
  input: SubmitPublicFormInput,
): Promise<SubmitPublicFormResult> {
  const form = await getPublishedFormBySlug(input.slug);

  if (!form) {
    return {
      ok: false,
      statusCode: 404,
      error: "Form not found.",
    };
  }

  const verification = await verifyTurnstileToken(
    typeof input.payload.turnstileToken === "string"
      ? input.payload.turnstileToken
      : undefined,
  );

  if (!verification.ok) {
    return {
      ok: false,
      statusCode: 400,
      error: verification.error,
    };
  }

  const normalized = normalizeSubmissionPayload(form, input.payload);
  const schema = buildSubmissionSchema(form);
  const parseResult = schema.safeParse(normalized.cleanedPayload);

  if (!parseResult.success) {
    return {
      ok: false,
      statusCode: 422,
      error: "Please fix the highlighted fields.",
      fieldErrors: Object.fromEntries(
        parseResult.error.issues.map((issue) => [
          String(issue.path[0] ?? "form"),
          issue.message,
        ]),
      ),
    };
  }

  const transactionResult = await withTransaction(async (client) => {
    const submissionInsert = await client.query<{
      id: number;
    }>(
      `
        INSERT INTO form_submissions (
          form_definition_id,
          status,
          payload_json,
          normalized_json,
          ip,
          user_agent,
          referer,
          turnstile_success,
          source
        )
        VALUES ($1, 'received', $2::jsonb, $3::jsonb, NULLIF($4, '')::inet, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        form.id,
        JSON.stringify(input.payload),
        JSON.stringify(parseResult.data),
        input.ipAddress ?? "",
        input.userAgent ?? null,
        input.referer ?? null,
        true,
        typeof parseResult.data.source === "string" ? parseResult.data.source : null,
      ],
    );

    const submissionId = submissionInsert.rows[0].id;
    const mappedLead = mapSubmissionToLead(form, parseResult.data);
    const extraJson = {
      ...mappedLead.extraJson,
      submission_id: submissionId,
    };

    const leadInsert = await client.query<{ id: number }>(
      `
        INSERT INTO leads (
          parent_name,
          phone,
          child_name,
          child_grade,
          source,
          notes,
          extra_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING id
      `,
      [
        mappedLead.parentName,
        mappedLead.phone,
        mappedLead.childName,
        mappedLead.childGrade,
        mappedLead.source,
        mappedLead.notes,
        JSON.stringify(extraJson),
      ],
    );

    const leadId = leadInsert.rows[0].id;

    for (const file of mappedLead.files) {
      await client.query(
        `
          INSERT INTO submission_files (
            form_submission_id,
            field_key,
            storage_key,
            original_filename,
            mime_type,
            file_size_bytes,
            public_url
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          submissionId,
          file.fieldKey,
          file.storageKey,
          file.originalFilename,
          file.mimeType,
          file.fileSizeBytes,
          file.publicUrl,
        ],
      );
    }

    await client.query(
      `
        UPDATE form_submissions
        SET lead_id = $2,
            status = 'accepted'
        WHERE id = $1
      `,
      [submissionId, leadId],
    );

    return { submissionId, leadId };
  });

  return {
    ok: true,
    submissionId: transactionResult.submissionId,
    leadId: transactionResult.leadId,
  };
}

export async function parsePublicFormPayload(input: {
  form: PublicFormDefinition;
  formData: FormData;
}) {
  const payload: Record<string, unknown> = {};

  for (const field of input.form.fields) {
    if (field.fieldType === "checkbox") {
      payload[field.fieldKey] = input.formData
        .getAll(field.fieldKey)
        .map((value) => String(value));
      continue;
    }

    if (field.fieldType === "image" || field.fieldType === "file") {
      const entry = input.formData.get(field.fieldKey);

      if (entry instanceof File && entry.size > 0) {
        payload[field.fieldKey] = await persistUploadedFile({
          formSlug: input.form.slug,
          fieldKey: field.fieldKey,
          file: entry,
        });
      }
      continue;
    }

    const entry = input.formData.get(field.fieldKey);
    if (typeof entry === "string") {
      payload[field.fieldKey] = entry;
    }
  }

  const turnstileToken = input.formData.get("turnstileToken");
  if (typeof turnstileToken === "string") {
    payload.turnstileToken = turnstileToken;
  }

  return payload;
}

function mapSubmissionToLead(
  form: PublicFormDefinition,
  payload: Record<string, unknown>,
) {
  const lead = {
    parentName: "",
    phone: "",
    childName: null as string | null,
    childGrade: "",
    source: "website",
    notes: null as string | null,
    extraJson: {} as Record<string, unknown>,
    files: [] as SubmissionStoredFile[],
  };

  for (const field of form.fields) {
    const value = payload[field.fieldKey];
    const target = field.mapping.target;

    if (value === undefined) {
      continue;
    }

    if (target === "leads.parent_name" && typeof value === "string") {
      lead.parentName = value;
      continue;
    }
    if (target === "leads.phone" && typeof value === "string") {
      lead.phone = value;
      continue;
    }
    if (target === "leads.child_name" && typeof value === "string") {
      lead.childName = value || null;
      continue;
    }
    if (target === "leads.child_grade" && typeof value === "string") {
      lead.childGrade = value;
      continue;
    }
    if (target === "leads.source" && typeof value === "string") {
      lead.source = value;
      continue;
    }
    if (target === "leads.notes" && typeof value === "string") {
      lead.notes = value || null;
      continue;
    }
    if (target.startsWith("leads.extra_json.")) {
      const key = target.replace("leads.extra_json.", "");
      lead.extraJson[key] = value;
      if (isStoredFile(value)) {
        lead.files.push(value);
      }
    }
  }

  return lead;
}

function isStoredFile(value: unknown): value is SubmissionStoredFile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SubmissionStoredFile).storageKey === "string"
  );
}
