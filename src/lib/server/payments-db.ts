import 'server-only';
import { serviceRoleClient } from '@/lib/server/service-role';

export function paymentsServiceClient() {
  return serviceRoleClient();
}
