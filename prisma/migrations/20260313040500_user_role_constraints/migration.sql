-- AlterTable
ALTER TABLE "User"
ADD CONSTRAINT "User_supplier_role_requires_supplier_id"
CHECK ("role" <> 'SUPPLIER' OR "supplier_id" IS NOT NULL),
ADD CONSTRAINT "User_country_admin_requires_country_id"
CHECK ("role" <> 'COUNTRY_ADMIN' OR "country_id" IS NOT NULL);
