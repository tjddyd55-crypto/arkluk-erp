import { ReactNode } from "react";

import { PortalShell } from "@/components/portal/shell";

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
