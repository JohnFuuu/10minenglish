import { AdminLayout } from './AdminLayout';
import { CreditPackPricing } from './CreditPackPricing';

export function AdminPricingPage() {
  return (
    <AdminLayout title="Pricing" liveChanges>
      <CreditPackPricing />
    </AdminLayout>
  );
}
