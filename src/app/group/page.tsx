import Link from "next/link";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type GroupPageProps = {
  searchParams?: Promise<{
    member?: string;
    inviteToken?: string;
    error?: string;
  }>;
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

type MemberRow = {
  profile_id: string;
  role: "admin" | "member";
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  created_at: string;
};

type ChildRow = {
  id: string;
  name: string;
  birthdate: string;
  created_at: string;
};

type ChildMeasurement = MeasurementValues & {
  child_id: string;
};

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

const birthdateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC"
});

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

async function createFamilyAction(formData: FormData) {
  "use server";

  const familyName = String(formData.get("name") ?? "").trim();
  if (!familyName) {
    redirect("/group?error=Family%20name%20is%20required.");
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: familyName })
    .select("id")
    .single();

  if (familyError || !family) {
    redirect(`/group?error=${encodeURIComponent(familyError?.message ?? "Could not create family")}`);
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ family_id: family.id })
    .eq("id", user.id);

  if (profileUpdateError) {
    redirect(
      `/group?error=${encodeURIComponent(profileUpdateError.message ?? "Could not join created family")}`
    );
  }

  const { error: memberError } = await supabase.from("family_members").insert({
    family_id: family.id,
    profile_id: user.id,
    role: "admin"
  });

  if (memberError) {
    redirect(`/group?error=${encodeURIComponent(memberError.message ?? "Could not add family member")}`);
  }

  redirect("/group");
}

async function createInviteAction() {
  "use server";

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.family_id) {
    redirect("/group?error=You%20must%20be%20in%20a%20family%20to%20create%20an%20invite.");
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: inviteError } = await supabase.from("family_invites").insert({
    family_id: profile.family_id,
    invited_by: user.id,
    token,
    expires_at: expiresAt
  });

  if (inviteError) {
    redirect(`/group?error=${encodeURIComponent(inviteError.message ?? "Could not create invite")}`);
  }

  redirect(`/group?inviteToken=${encodeURIComponent(token)}`);
}

export default async function GroupPage({ searchParams }: GroupPageProps) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, family_id")
    .eq("id", user.id)
    .maybeSingle();

  const params = searchParams ? await searchParams : undefined;
  const selectedMemberId = params?.member;
  const inviteToken = params?.inviteToken;
  const errorMessage = params?.error;

  const headerStore = headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${protocol}://${host}` : null;

  if (!profile?.family_id) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8 sm:max-w-lg">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Family Group</h1>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        </header>

        <nav className="mt-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Back Home
          </Link>
        </nav>

        {errorMessage ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</p>
        ) : null}

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Create Family Group</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create a family to share read-only profile, child, and measurement data.
          </p>
          <form action={createFamilyAction} className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="family-name">
                Family name
              </label>
              <input
                id="family-name"
                name="name"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                placeholder="Smith Family"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Create Family
            </button>
          </form>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Join via Invite</h2>
          <p className="mt-2 text-sm text-slate-600">Paste an invite token to join an existing family.</p>
          <form action="/accept-invite" method="get" className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="invite-token">
                Invite token
              </label>
              <input
                id="invite-token"
                name="token"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                placeholder="Paste token"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Continue
            </button>
          </form>
        </section>
      </main>
    );
  }

  const familyId = profile.family_id;

  const { data: family } = await supabase
    .from("families")
    .select("id, name")
    .eq("id", familyId)
    .maybeSingle();

  const { data: membersData } = await supabase
    .from("family_members")
    .select("profile_id, role, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  const members = (membersData as MemberRow[] | null) ?? [];
  const memberIds = members.map((member) => member.profile_id);

  const { data: memberProfilesData } =
    memberIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, created_at").in("id", memberIds)
      : { data: [] as ProfileRow[] };

  const memberProfiles = (memberProfilesData as ProfileRow[] | null) ?? [];
  const memberProfileById = new Map(memberProfiles.map((memberProfile) => [memberProfile.id, memberProfile]));

  const effectiveSelectedMemberId =
    selectedMemberId && memberIds.includes(selectedMemberId) ? selectedMemberId : user.id;

  const { data: selectedProfileData } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .eq("id", effectiveSelectedMemberId)
    .maybeSingle();

  const selectedProfile = selectedProfileData as ProfileRow | null;

  const { data: selectedProfileMeasurementData } = await supabase
    .from("profile_measurements")
    .select("height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size")
    .eq("profile_id", effectiveSelectedMemberId)
    .maybeSingle();

  const selectedProfileMeasurements = selectedProfileMeasurementData
    ? {
        height_cm: selectedProfileMeasurementData.height_cm,
        weight_kg: selectedProfileMeasurementData.weight_kg,
        chest_cm: selectedProfileMeasurementData.chest_cm,
        waist_cm: selectedProfileMeasurementData.waist_cm,
        hips_cm: selectedProfileMeasurementData.hips_cm,
        inseam_cm: selectedProfileMeasurementData.inseam_cm,
        shoe_size: selectedProfileMeasurementData.shoe_size
      }
    : defaultMeasurements;

  const { data: selectedChildrenData } = await supabase
    .from("children")
    .select("id, name, birthdate, created_at")
    .eq("family_id", familyId)
    .eq("created_by", effectiveSelectedMemberId)
    .order("birthdate", { ascending: true });

  const selectedChildren = (selectedChildrenData as ChildRow[] | null) ?? [];
  const selectedChildIds = selectedChildren.map((child) => child.id);

  const { data: selectedChildMeasurementsData } =
    selectedChildIds.length > 0
      ? await supabase
          .from("child_measurements")
          .select("child_id, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size")
          .in("child_id", selectedChildIds)
      : { data: [] as ChildMeasurement[] };

  const childMeasurementByChildId = new Map(
    ((selectedChildMeasurementsData as ChildMeasurement[] | null) ?? []).map((measurement) => [
      measurement.child_id,
      measurement
    ])
  );

  const invitePath = inviteToken ? `/accept-invite?token=${encodeURIComponent(inviteToken)}` : null;
  const inviteLink = invitePath && origin ? `${origin}${invitePath}` : invitePath;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8 sm:max-w-lg">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Family Group</h1>
        <p className="mt-1 text-sm text-slate-600">{family?.name ?? "My Family"}</p>
      </header>

      <nav className="mt-4">
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          Back Home
        </Link>
      </nav>

      {errorMessage ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</p>
      ) : null}

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Invite</h2>
          <form action={createInviteAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Create Invite
            </button>
          </form>
        </div>

        {inviteLink ? (
          <div className="mt-3 rounded-xl bg-teal-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Invite Link</p>
            <p className="mt-1 break-all text-sm text-teal-900">{inviteLink}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Create a 7-day invite link to share with another user.</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Members</h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No members found.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {members.map((member) => {
              const memberProfile = memberProfileById.get(member.profile_id);
              const label = memberProfile?.full_name?.trim() || member.profile_id;
              const isSelected = member.profile_id === effectiveSelectedMemberId;

              return (
                <li key={member.profile_id}>
                  <Link
                    href={`/group?member=${member.profile_id}`}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                      isSelected
                        ? "border-teal-300 bg-teal-50 text-teal-900"
                        : "border-slate-200 text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">{member.role}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Read-Only Member Details</h2>
        {selectedProfile ? (
          <>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {selectedProfile.full_name?.trim() || selectedProfile.id}
            </p>
            <p className="text-xs text-slate-600">Profile Measurements</p>
            <MeasurementsSummary values={selectedProfileMeasurements} />

            <h3 className="mt-4 text-sm font-semibold text-slate-900">Children</h3>
            {selectedChildren.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No children shared for this member.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {selectedChildren.map((child) => {
                  const childMeasurement = childMeasurementByChildId.get(child.id);

                  return (
                    <li key={child.id} className="rounded-xl border border-slate-200 px-3 py-3">
                      <p className="text-sm font-medium text-slate-900">{child.name}</p>
                      <p className="text-xs text-slate-600">
                        Birthdate: {birthdateFormatter.format(new Date(`${child.birthdate}T00:00:00Z`))}
                      </p>
                      <MeasurementsSummary
                        values={
                          childMeasurement
                            ? {
                                height_cm: childMeasurement.height_cm,
                                weight_kg: childMeasurement.weight_kg,
                                chest_cm: childMeasurement.chest_cm,
                                waist_cm: childMeasurement.waist_cm,
                                hips_cm: childMeasurement.hips_cm,
                                inseam_cm: childMeasurement.inseam_cm,
                                shoe_size: childMeasurement.shoe_size
                              }
                            : defaultMeasurements
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">Select a member to view details.</p>
        )}
      </section>
    </main>
  );
}
