import { requireAuth } from "@/lib/auth-helpers";
import { Sidebar } from "@/components/layout/sidebar";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import type { UserRolle } from "@/lib/auth-helpers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="flex h-full">
      <NavigationProgress />
      <Sidebar
        userRolle={user.rolle as UserRolle}
        userName={user.name ?? ""}
        userEmail={user.email ?? ""}
      />
      {/* On mobile, add top padding to account for the fixed header bar */}
      <main className="flex-1 overflow-y-auto bg-background pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
