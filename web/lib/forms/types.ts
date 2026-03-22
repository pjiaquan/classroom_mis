export type FormStatus = "draft" | "published" | "archived";

export type FieldType =
  | "text"
  | "textarea"
  | "phone"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "image"
  | "file";

export type FormOption = {
  value: string;
  label: string;
  sortOrder: number;
};

export type FormTheme = {
  brandName: string;
  logoUrl: string;
  fontHeading: string;
  fontBody: string;
  colorPrimary: string;
  colorAccent: string;
  colorSurface: string;
  backgroundStyle: string;
  buttonStyle: string;
};

export type FieldMapping = {
  target: string;
};

export type PublicFormField = {
  id: number;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  placeholder: string | null;
  helpText: string | null;
  isRequired: boolean;
  sortOrder: number;
  width: "full" | "half";
  defaultValue: string | null;
  validation: Record<string, unknown>;
  ui: Record<string, unknown>;
  mapping: FieldMapping;
  options: FormOption[];
};

export type PublicFormDefinition = {
  id: number;
  name: string;
  slug: string;
  status: FormStatus;
  successMessage: string | null;
  theme: FormTheme;
  settings: Record<string, unknown>;
  fields: PublicFormField[];
};

export type AdminFormDefinition = PublicFormDefinition;

export type AdminFormSummary = Pick<
  PublicFormDefinition,
  "id" | "name" | "slug" | "status"
>;

export type SubmissionStoredFile = {
  fieldKey: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  publicUrl: string;
};

export type SubmissionPendingFile = {
  fieldKey: string;
  file: File;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
};
