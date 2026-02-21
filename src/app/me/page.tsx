import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { AddChildForm } from "@/components/add-child-form";
import { MeasurementUpsertForm } from "@/components/measurement-upsert-form";
import { createClient } from "@/lib/supabase/server";

type Child = {
  id: string;
  name: string;
  birthdate: string;
  created_at: string;
};

type MeasurementValues = {
  height_cm: number | null;
  weight_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  inseam_cm: number | null;
  shoe_size: number | null;
};

type ChildMeasurement = MeasurementValues & {
  id: string;
  child_id: string;
  updated_at: string;
};

const birthdateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC"
});

const defaultMeasurements: MeasurementValues = {
  height_cm: null,
  weight_kg: null,
  chest_cm: null,
  waist_cm: null,
  hips_cm: null,
  inseam_cm: null,
  shoe_size: null
};

const measurementLabels: Record<keyof MeasurementValues, string> = {
  height_cm: "Height",
  weight_kg: "Weight",
  chest_cm: "Chest",
  waist_cm: "Waist",
  hips_cm: "Hips",
  inseam_cm: "Inseam",
  shoe_size: "Shoe Size"
};

const measurementUnits: Record<keyof MeasurementValues, string> = {
  height_cm: "cm",
  weight_kg: "kg",
  chest_cm: "cm",
  waist_cm: "cm",
  hips_cm: "cm",
  inseam_cm: "cm",
  shoe_size: ""
};

function formatMeasurement(value: number | null, unit: string) {
  if (value === null) {
    return "Not set";
  }

  return unit ? `${value} ${unit}` : String(value);
}

function MeasurementsSummary({ values }: { values: MeasurementValues }) {
  return (
    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
      {(Object.keys(values) as Array<keyof MeasurementValues>).map((key) => (
        <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {measurementLabels[key]}
          </dt>
          <dd>{formatMeasurement(values[key], measurementUnits[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function MePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id" })
    .select("family_id")
    .single();

  const { data: children, error: childrenError } = await supabase
    .from("children")
    .select("id, name, birthdate, created_at")
    .eq("created_by", user.id)
    .order("birthdate", { ascending: true });

  const { data: profileMeasurement, error: profileMeasurementError } = await supabase
    .from("profile_measurements")
    .select(
      "id, profile_id, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size, updated_at"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  const childIds = (children as Child[] | null)?.map((child) => child.id) ?? [];
  const childMeasurementQuery = supabase
    .from("child_measurements")
    .select("id, child_id, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size, updated_at");

  const { data: childMeasurements, error: childMeasurementsError } =
    childIds.length > 0
      ? await childMeasurementQuery.in("child_id", childIds)
      : { data: [] as ChildMeasurement[], error: null };

  const profileValues = profileMeasurement
    ? {
        height_cm: profileMeasurement.height_cm,
        weight_kg: profileMeasurement.weight_kg,
        chest_cm: profileMeasurement.chest_cm,
        waist_cm: profileMeasurement.waist_cm,
        hips_cm: profileMeasurement.hips_cm,
        inseam_cm: profileMeasurement.inseam_cm,
        shoe_size: profileMeasurement.shoe_size
      }
    : defaultMeasurements;

  const childMeasurementByChildId = new Map(
    ((childMeasurements as ChildMeasurement[] | null) ?? []).map((measurement) => [
      measurement.child_id,
      measurement
    ])
  );

  const hasError = Boolean(
    profileError || childrenError || profileMeasurementError || childMeasurementsError
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8 sm:max-w-lg">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <nav className="mt-4">
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          Back Home
        </Link>
      </nav>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">My Measurements</h2>
        <MeasurementsSummary values={profileValues} />
        <MeasurementUpsertForm
          scope="profile"
          ownerId={user.id}
          initialValues={profileValues}
          hasRecord={Boolean(profileMeasurement)}
        />
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">My Children</h2>
        <AddChildForm userId={user.id} familyId={profileRow?.family_id ?? null} />
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Saved Children</h2>
        {hasError ? (
          <p className="mt-3 text-sm text-rose-700">
            Could not load children. Please verify your database schema and RLS policies.
          </p>
        ) : null}
        {!hasError && (!children || children.length === 0) ? (
          <p className="mt-3 text-sm text-slate-600">No children added yet.</p>
        ) : null}
        {!hasError && children && children.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {(children as Child[]).map((child) => (
              <li key={child.id} className="rounded-xl border border-slate-200 px-3 py-3">
                <p className="text-sm font-medium text-slate-900">{child.name}</p>
                <p className="text-xs text-slate-600">
                  Birthdate: {birthdateFormatter.format(new Date(`${child.birthdate}T00:00:00Z`))}
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-900">Measurements</p>
                <MeasurementsSummary
                  values={
                    childMeasurementByChildId.get(child.id)
                      ? {
                          height_cm: childMeasurementByChildId.get(child.id)!.height_cm,
                          weight_kg: childMeasurementByChildId.get(child.id)!.weight_kg,
                          chest_cm: childMeasurementByChildId.get(child.id)!.chest_cm,
                          waist_cm: childMeasurementByChildId.get(child.id)!.waist_cm,
                          hips_cm: childMeasurementByChildId.get(child.id)!.hips_cm,
                          inseam_cm: childMeasurementByChildId.get(child.id)!.inseam_cm,
                          shoe_size: childMeasurementByChildId.get(child.id)!.shoe_size
                        }
                      : defaultMeasurements
                  }
                />
                <MeasurementUpsertForm
                  scope="child"
                  ownerId={child.id}
                  initialValues={
                    childMeasurementByChildId.get(child.id)
                      ? {
                          height_cm: childMeasurementByChildId.get(child.id)!.height_cm,
                          weight_kg: childMeasurementByChildId.get(child.id)!.weight_kg,
                          chest_cm: childMeasurementByChildId.get(child.id)!.chest_cm,
                          waist_cm: childMeasurementByChildId.get(child.id)!.waist_cm,
                          hips_cm: childMeasurementByChildId.get(child.id)!.hips_cm,
                          inseam_cm: childMeasurementByChildId.get(child.id)!.inseam_cm,
                          shoe_size: childMeasurementByChildId.get(child.id)!.shoe_size
                        }
                      : defaultMeasurements
                  }
                  hasRecord={Boolean(childMeasurementByChildId.get(child.id))}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
