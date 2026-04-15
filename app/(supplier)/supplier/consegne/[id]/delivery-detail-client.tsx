"use client";

import {
  DeliveryDetailMobile,
  type DeliveryDetail,
  type DeliveryActions,
} from "@/components/supplier/delivery/delivery-detail-mobile";
import {
  startTransit,
  markDelivered,
  markFailed,
  uploadPodPhoto,
} from "@/lib/supplier/delivery/actions";

/**
 * Bridge client-side che "fixa" le server action come `DeliveryActions`.
 * Il componente presentazionale è agnostico dal trasporto.
 */
export function DeliveryDetailPageClient({
  delivery,
}: {
  delivery: DeliveryDetail;
}) {
  const actions: DeliveryActions = {
    startTransit: (id) => startTransit(id),
    markDelivered: (input) => markDelivered(input),
    markFailed: (input) => markFailed(input),
    uploadPod: (input) => uploadPodPhoto(input),
  };

  return <DeliveryDetailMobile delivery={delivery} actions={actions} />;
}
