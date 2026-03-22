import { getPublishedFormBySlug } from "@/lib/forms/repository";
import { buildSubmissionSchema } from "@/lib/forms/schema";
import { withTransaction } from "@/lib/db/client";
import { normalizeSubmissionPayload } from "@/lib/sanitization/forms";
import { verifyTurnstileToken } from "@/lib/anti-spam/turnstile";
import {
  type PublicFormDefinition,
  type SubmissionPendingFile,
  type SubmissionStoredFile,
} from "@/lib/forms/types";
import { deleteStoredFile, persistUploadedFile } from "@/lib/uploads/service";

type SubmitPublicFormInput = {
  slug: string;
  payload: Record<string, unknown>;
  uploadedFiles?: Record<string, File[]>;
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

  const verification = await verifyTurnstileToken(
    typeof input.payload.turnstileToken === "string"
      ? input.payload.turnstileToken
      : undefined,
    input.ipAddress,
  );

  if (!verification.ok) {
    return {
      ok: false,
      statusCode: 400,
      error: verification.error,
    };
  }

  const preparedUploads = preparePendingUploads({
    form,
    uploadedFiles: input.uploadedFiles ?? {},
  });

  if (!preparedUploads.ok) {
    return {
      ok: false,
      statusCode: 422,
      error: "Please fix the highlighted fields.",
      fieldErrors: preparedUploads.fieldErrors,
    };
  }

  let storedFiles: SubmissionStoredFile[] = [];

  try {
    storedFiles = await persistPendingUploads(form.slug, preparedUploads.pendingFiles);
    const normalizedPayload = attachStoredFilesToPayload(parseResult.data, storedFiles);

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
          JSON.stringify(normalizedPayload),
          input.ipAddress ?? "",
          input.userAgent ?? null,
          input.referer ?? null,
          true,
          typeof normalizedPayload.source === "string" ? normalizedPayload.source : null,
        ],
      );

      const submissionId = submissionInsert.rows[0].id;
      const mappedLead = mapSubmissionToLead(form, normalizedPayload);
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
  } catch (error) {
    await Promise.allSettled(storedFiles.map((file) => deleteStoredFile(file.storageKey)));
    throw error;
  }
}

export async function parsePublicFormPayload(input: {
  form: PublicFormDefinition;
  formData: FormData;
}) {
  const payload: Record<string, unknown> = {};
  const uploadedFiles: Record<string, File[]> = {};

  for (const field of input.form.fields) {
    if (field.fieldType === "checkbox") {
      payload[field.fieldKey] = input.formData
        .getAll(field.fieldKey)
        .map((value) => String(value));
      continue;
    }

    if (field.fieldType === "image" || field.fieldType === "file") {
      uploadedFiles[field.fieldKey] = input.formData
        .getAll(field.fieldKey)
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
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

  return { payload, uploadedFiles };
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

const DEFAULT_MAX_FILE_SIZE_MB = 10;

function preparePendingUploads(input: {
  form: PublicFormDefinition;
  uploadedFiles: Record<string, File[]>;
}) {
  const fieldErrors: Record<string, string> = {};
  const pendingFiles: SubmissionPendingFile[] = [];

  for (const field of input.form.fields) {
    if (field.fieldType !== "image" && field.fieldType !== "file") {
      continue;
    }

    const files = input.uploadedFiles[field.fieldKey] ?? [];

    if (files.length > 1) {
      fieldErrors[field.fieldKey] = `${field.label} only accepts one file per submission.`;
      continue;
    }

    const file = files[0];

    if (!file) {
      if (field.isRequired) {
        fieldErrors[field.fieldKey] = `${field.label} is required.`;
      }
      continue;
    }

    const maxFileSizeMb =
      typeof field.validation.maxFileSizeMb === "number"
        ? Number(field.validation.maxFileSizeMb)
        : DEFAULT_MAX_FILE_SIZE_MB;
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

    if (!Number.isFinite(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
      fieldErrors[field.fieldKey] = `${field.label} has an invalid upload size limit.`;
      continue;
    }

    if (file.size > maxFileSizeBytes) {
      fieldErrors[field.fieldKey] = `${field.label} must be ${maxFileSizeMb}MB or smaller.`;
      continue;
    }

    const mimeType = file.type || "application/octet-stream";
    const allowedMimeTypes = Array.isArray(field.validation.allowedMimeTypes)
      ? field.validation.allowedMimeTypes.filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        )
      : [];

    if (field.fieldType === "image" && !mimeType.startsWith("image/")) {
      fieldErrors[field.fieldKey] = `${field.label} must be an image file.`;
      continue;
    }

    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimeType)) {
      fieldErrors[field.fieldKey] = `${field.label} has an unsupported file type.`;
      continue;
    }

    pendingFiles.push({
      fieldKey: field.fieldKey,
      file,
      originalFilename: file.name || "upload.bin",
      mimeType,
      fileSizeBytes: file.size,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false as const,
      fieldErrors,
    };
  }

  return {
    ok: true as const,
    pendingFiles,
  };
}

async function persistPendingUploads(
  formSlug: string,
  pendingFiles: SubmissionPendingFile[],
) {
  const storedFiles: SubmissionStoredFile[] = [];

  try {
    for (const pendingFile of pendingFiles) {
      const storedFile = await persistUploadedFile({
        formSlug,
        fieldKey: pendingFile.fieldKey,
        file: pendingFile.file,
      });
      storedFiles.push(storedFile);
    }

    return storedFiles;
  } catch (error) {
    await Promise.allSettled(storedFiles.map((file) => deleteStoredFile(file.storageKey)));
    throw error;
  }
}

function attachStoredFilesToPayload(
  payload: Record<string, unknown>,
  storedFiles: SubmissionStoredFile[],
) {
  if (storedFiles.length === 0) {
    return payload;
  }

  return storedFiles.reduce<Record<string, unknown>>(
    (accumulator, file) => {
      accumulator[file.fieldKey] = file;
      return accumulator;
    },
    { ...payload },
  );
}
