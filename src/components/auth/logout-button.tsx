import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <Button className={className} type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
