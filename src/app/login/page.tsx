import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Zap } from "lucide-react";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/domains");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Angebots-Engine</h1>
            <p className="mt-1 text-sm text-muted-foreground">Melde dich an, um fortzufahren</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
