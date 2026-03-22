import {
  type FormOption,
  type PublicFormDefinition,
  type PublicFormField,
} from "@/lib/forms/types";

export type SupportedLocale = "zh-TW" | "en";

type TranslationField = {
  label?: string;
  placeholder?: string | null;
  helpText?: string | null;
  options?: Record<string, string>;
};

const chromeMessages = {
  "zh-TW": {
    brandIntro: "請填寫聯絡資料與學生資訊，我們會盡快與您聯繫。",
    submit: "送出表單",
    submitting: "送出中...",
    choose: "請選擇",
    chooseFile: "選擇檔案",
    uploadHint: "可上傳圖片或檔案，送出前可重新選擇。",
    requiredMark: "必填",
    errorFallback: "送出失敗，請稍後再試。",
    languageLabel: "語言",
    zhLabel: "繁中",
    enLabel: "EN",
  },
  en: {
    brandIntro:
      "Please leave your contact details and student information. We will get back to you soon.",
    submit: "Submit Form",
    submitting: "Submitting...",
    choose: "Please choose",
    chooseFile: "Choose a file",
    uploadHint: "You can upload an image or file and replace it before submitting.",
    requiredMark: "Required",
    errorFallback: "Unable to submit the form right now.",
    languageLabel: "Language",
    zhLabel: "繁中",
    enLabel: "EN",
  },
} as const;

const formTranslations: Record<
  string,
  Partial<
    Record<
      SupportedLocale,
      {
        name?: string;
        fields?: Record<string, TranslationField>;
      }
    >
  >
> = {
  "lead-intake": {
    en: {
      name: "Lead Intake",
      fields: {
        parent_name: {
          label: "Parent Name",
          placeholder: "Enter parent name",
        },
        phone: {
          label: "Phone Number",
          placeholder: "Example 0912345678",
        },
        child_name: {
          label: "Student Name",
          placeholder: "Enter student name",
        },
        child_grade: {
          label: "Student Grade",
          options: {
            K1: "Kindergarten 1",
            K2: "Kindergarten 2",
            K3: "Kindergarten 3",
            G1: "Grade 1",
            G2: "Grade 2",
            G3: "Grade 3",
            G4: "Grade 4",
            G5: "Grade 5",
            G6: "Grade 6",
            other: "Other",
          },
        },
        source: {
          label: "How Did You Hear About Us?",
          options: {
            walk_in: "Walk-in",
            referral: "Referral",
            facebook: "Facebook",
            line: "LINE",
            website: "Website",
            flyer: "Flyer",
            other: "Other",
          },
        },
        notes: {
          label: "Notes",
          placeholder: "Share learning goals or a preferred contact time",
        },
        child_photo: {
          label: "Student Photo",
          helpText: "Optional. JPG, PNG, and WEBP are supported.",
        },
      },
    },
  },
};

export function getChromeMessages(locale: SupportedLocale) {
  return chromeMessages[locale];
}

export function getLocalizedFormName(
  form: PublicFormDefinition,
  locale: SupportedLocale,
) {
  return formTranslations[form.slug]?.[locale]?.name ?? form.name;
}

export function getLocalizedField(
  form: PublicFormDefinition,
  field: PublicFormField,
  locale: SupportedLocale,
) {
  const translated =
    formTranslations[form.slug]?.[locale]?.fields?.[field.fieldKey] ?? {};

  return {
    ...field,
    label: translated.label ?? field.label,
    placeholder:
      translated.placeholder === undefined ? field.placeholder : translated.placeholder,
    helpText: translated.helpText === undefined ? field.helpText : translated.helpText,
    options: localizeOptions(field.options, translated.options),
  };
}

function localizeOptions(
  options: FormOption[],
  translatedOptions?: Record<string, string>,
) {
  if (!translatedOptions) {
    return options;
  }

  return options.map((option) => ({
    ...option,
    label: translatedOptions[option.value] ?? option.label,
  }));
}
