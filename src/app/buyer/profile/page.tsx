"use client";

import { UserProfileSettings } from "@/components/portal/user-profile-settings";
import { useTranslation } from "@/hooks/useTranslation";

export default function BuyerProfilePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">{t("profile")}</h1>
      <UserProfileSettings />
    </div>
  );
}
