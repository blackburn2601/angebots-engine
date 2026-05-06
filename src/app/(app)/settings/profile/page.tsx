import { requireAuth } from "@/lib/auth-helpers";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const user = await requireAuth();
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-semibold">Profil</h1>
      <ProfileForm userId={user.id} userName={user.name ?? ""} userEmail={user.email ?? ""} />
    </div>
  );
}
