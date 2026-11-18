import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { isMock, resolve } from "@/lib/models/router";
import { canPublish, dailyLimit, usageToday } from "@/lib/usage";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, plan: user.plan, register: user.register }}
      usage={{ used: usageToday(user.id), limit: dailyLimit(user) }}
      canPublish={canPublish(user)}
      demo={isMock(resolve("chat")) || isMock(resolve("code"))}
    >
      {children}
    </AppShell>
  );
}
