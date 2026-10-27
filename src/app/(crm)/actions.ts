'use server';

import { revalidatePath } from 'next/cache';
import { can, requireStaff, getSetting } from '@/lib/auth';
import { decideCrew, estimateCleaningPrice, type RoofType } from '@/lib/rules';

/** Buchung annehmen: Besetzung und Richtpreis nach den Regeln setzen. */
export async function acceptOrder(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  if (!can(staff, 'customers') && !can(staff, 'dispatch')) return;
  const id = String(formData.get('order_id'));

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, service_id, area_m2, plants(area_m2, roof, heavily_soiled), services(price_per_m2, price_per_m2_heavy, min_price, min_price_below_m2)')
    .eq('id', id)
    .single();
  if (error || !order || order.status !== 'neu') return;

  const plant = (Array.isArray(order.plants) ? order.plants[0] : order.plants) as
    { area_m2: number | null; roof: RoofType; heavily_soiled: boolean } | null;
  const svc = (Array.isArray(order.services) ? order.services[0] : order.services) as
    { price_per_m2: number | null; price_per_m2_heavy: number | null; min_price: number | null; min_price_below_m2: number | null } | null;
  const area = Number(order.area_m2 ?? plant?.area_m2 ?? 0);

  const update: Record<string, unknown> = { status: 'angenommen' };

  if (order.service_id === 'reinigung' && plant && area > 0) {
    const threshold = Number(await getSetting(supabase, 'two_person_threshold_m2', 1000));
    const crew = decideCrew(plant.roof, area, threshold);
    update.crew_size = crew.crewSize;
    update.needs_robot = crew.needsRobot;
    if (svc?.price_per_m2 != null && svc.price_per_m2_heavy != null && svc.min_price != null && svc.min_price_below_m2 != null) {
      const price = estimateCleaningPrice(area, {
        price_per_m2: Number(svc.price_per_m2),
        price_per_m2_heavy: Number(svc.price_per_m2_heavy),
        min_price: Number(svc.min_price),
        min_price_below_m2: Number(svc.min_price_below_m2),
      }, plant.heavily_soiled);
      if (price) update.estimated_price = price.from;
    }
  } else {
    update.crew_size = 1;
  }

  await supabase.from('orders').update(update).eq('id', id);
  revalidatePath('/');
}
