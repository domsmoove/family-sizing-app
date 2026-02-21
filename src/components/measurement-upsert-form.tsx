"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type MeasurementValues = {
  height_cm: number | null;
  weight_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  inseam_cm: number | null;
  shoe_size: number | null;
};

type MeasurementUpsertFormProps = {
  scope: "profile" | "child";
  ownerId: string;
  initialValues: MeasurementValues;
  hasRecord: boolean;
};

type MeasurementField = {
  key: keyof MeasurementValues;
  label: string;
};

const measurementFields: MeasurementField[] = [
  { key: "height_cm", label: "Height (cm)" },
  { key: "weight_kg", label: "Weight (kg)" },
  { key: "chest_cm", label: "Chest (cm)" },
  { key: "waist_cm", label: "Waist (cm)" },
  { key: "hips_cm", label: "Hips (cm)" },
  { key: "inseam_cm", label: "Inseam (cm)" },
  { key: "shoe_size", label: "Shoe Size" }
];

function toInputValue(value: number | null) {
  return value === null ? "" : String(value);
}

function toNumericValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function MeasurementUpsertForm({
  scope,
  ownerId,
  initialValues,
  hasRecord
}: MeasurementUpsertFormProps) {
  const router = useRouter();
  const [heightCm, setHeightCm] = useState(toInputValue(initialValues.height_cm));
  const [weightKg, setWeightKg] = useState(toInputValue(initialValues.weight_kg));
  const [chestCm, setChestCm] = useState(toInputValue(initialValues.chest_cm));
  const [waistCm, setWaistCm] = useState(toInputValue(initialValues.waist_cm));
  const [hipsCm, setHipsCm] = useState(toInputValue(initialValues.hips_cm));
  const [inseamCm, setInseamCm] = useState(toInputValue(initialValues.inseam_cm));
  const [shoeSize, setShoeSize] = useState(toInputValue(initialValues.shoe_size));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formValues = useMemo(
    () => ({
      height_cm: heightCm,
      weight_kg: weightKg,
      chest_cm: chestCm,
      waist_cm: waistCm,
      hips_cm: hipsCm,
      inseam_cm: inseamCm,
      shoe_size: shoeSize
    }),
    [chestCm, heightCm, hipsCm, inseamCm, shoeSize, waistCm, weightKg]
  );

  const setFieldValue = (key: keyof MeasurementValues, value: string) => {
    switch (key) {
      case "height_cm":
        setHeightCm(value);
        break;
      case "weight_kg":
        setWeightKg(value);
        break;
      case "chest_cm":
        setChestCm(value);
        break;
      case "waist_cm":
        setWaistCm(value);
        break;
      case "hips_cm":
        setHipsCm(value);
        break;
      case "inseam_cm":
        setInseamCm(value);
        break;
      case "shoe_size":
        setShoeSize(value);
        break;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const tableName = scope === "profile" ? "profile_measurements" : "child_measurements";
    const ownerColumn = scope === "profile" ? "profile_id" : "child_id";

    const payload = {
      [ownerColumn]: ownerId,
      height_cm: toNumericValue(heightCm),
      weight_kg: toNumericValue(weightKg),
      chest_cm: toNumericValue(chestCm),
      waist_cm: toNumericValue(waistCm),
      hips_cm: toNumericValue(hipsCm),
      inseam_cm: toNumericValue(inseamCm),
      shoe_size: toNumericValue(shoeSize),
      updated_at: new Date().toISOString()
    };

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from(tableName)
      .upsert(payload, { onConflict: ownerColumn });

    setIsSubmitting(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    router.refresh();
  };

  return (
    <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {measurementFields.map((field) => (
          <div key={field.key}>
            <label
              className="block text-sm font-medium text-slate-800"
              htmlFor={`${scope}-${ownerId}-${field.key}`}
            >
              {field.label}
            </label>
            <input
              id={`${scope}-${ownerId}-${field.key}`}
              type="number"
              step="0.1"
              value={formValues[field.key]}
              onChange={(event) => setFieldValue(field.key, event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder="Optional"
            />
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Saving..." : hasRecord ? "Update Measurements" : "Add Measurements"}
      </button>
    </form>
  );
}
