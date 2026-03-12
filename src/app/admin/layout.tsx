import { ReactNode } from "react";

import { PortalShell } from "@/components/portal/shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
