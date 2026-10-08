import { AdminLayout } from './AdminLayout';
import { CreditPackPricing } from './CreditPackPricing';
import { LessonPriceSetting } from './LessonPriceSetting';

export function AdminPricingPage() {
  return (
    <AdminLayout title="Pricing" liveChanges>
      <LessonPriceSetting />
      <CreditPackPricing />
    </AdminLayout>
  );
}
