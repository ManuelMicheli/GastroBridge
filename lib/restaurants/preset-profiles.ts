// GastroBridge: preset supply-profile templates for restaurants.
// Plain TS, no DB access. Used by the settings UI and the apply action.
import type {
  CategoryMacro,
  CertificationType,
  PresetProfile,
  QualityTier,
} from "@/types/database";

export type PresetCategoryOverride = {
  min_quality_tier?: QualityTier;
  lead_time_max_days?: number;
  required_certifications?: CertificationType[];
  price_weight?: number;
  quality_weight?: number;
  delivery_weight?: number;
};

export type PresetProfileTemplate = {
  label: string;
  description: string;
  price_weight: number;
  quality_weight: number;
  delivery_weight: number;
  required_certifications: CertificationType[];
  prefer_bio: boolean;
  prefer_km0: boolean;
  lead_time_max_days: number | null;
  min_order_max_eur: number | null;
  max_distance_km: number | null;
  categoryOverrides: Partial<Record<CategoryMacro, PresetCategoryOverride>>;
};

export const PRESET_PROFILES: Record<
  Exclude<PresetProfile, "custom">,
  PresetProfileTemplate
> = {
  stellato: {
    label: "Ristorante Stellato",
    description: "Massima qualità, certificazioni, fornitori selezionati",
    price_weight: 20,
    quality_weight: 65,
    delivery_weight: 15,
    required_certifications: ["DOP", "IGP"],
    prefer_bio: true,
    prefer_km0: true,
    lead_time_max_days: 2,
    min_order_max_eur: null,
    max_distance_km: 150,
    categoryOverrides: {
      pesce: {
        min_quality_tier: "premium",
        lead_time_max_days: 1,
        required_certifications: ["MSC"],
      },
      carne: {
        min_quality_tier: "premium",
        lead_time_max_days: 2,
      },
      verdura: {
        min_quality_tier: "premium",
        lead_time_max_days: 1,
      },
      frutta: {
        min_quality_tier: "premium",
        lead_time_max_days: 1,
      },
      latticini: {
        min_quality_tier: "premium",
        required_certifications: ["DOP"],
      },
      bevande: {
        min_quality_tier: "luxury",
        required_certifications: ["DOCG"],
      },
    },
  },
  trattoria: {
    label: "Trattoria",
    description: "Qualità genuina, ingredienti locali, equilibrio costo/valore",
    price_weight: 50,
    quality_weight: 30,
    delivery_weight: 20,
    required_certifications: [],
    prefer_bio: false,
    prefer_km0: true,
    lead_time_max_days: 3,
    min_order_max_eur: null,
    max_distance_km: 80,
    categoryOverrides: {
      carne: {
        min_quality_tier: "standard",
      },
      verdura: {
        min_quality_tier: "standard",
        lead_time_max_days: 2,
      },
      latticini: {
        min_quality_tier: "standard",
        required_certifications: ["DOP"],
      },
      bevande: {
        required_certifications: ["DOC"],
      },
    },
  },
  pizzeria: {
    label: "Pizzeria",
    description: "Farina, mozzarella e pomodoro top; consegne affidabili",
    price_weight: 55,
    quality_weight: 25,
    delivery_weight: 20,
    required_certifications: [],
    prefer_bio: false,
    prefer_km0: false,
    lead_time_max_days: 3,
    min_order_max_eur: null,
    max_distance_km: 120,
    categoryOverrides: {
      latticini: {
        min_quality_tier: "premium",
        required_certifications: ["DOP"],
        lead_time_max_days: 2,
      },
      secco: {
        min_quality_tier: "standard",
      },
      verdura: {
        lead_time_max_days: 2,
      },
    },
  },
  bar: {
    label: "Bar / Caffetteria",
    description: "Mix di qualità e prezzo, forniture frequenti",
    price_weight: 60,
    quality_weight: 20,
    delivery_weight: 20,
    required_certifications: [],
    prefer_bio: false,
    prefer_km0: false,
    lead_time_max_days: 2,
    min_order_max_eur: null,
    max_distance_km: 50,
    categoryOverrides: {
      bevande: {
        min_quality_tier: "standard",
      },
      panetteria: {
        lead_time_max_days: 1,
      },
    },
  },
  mensa: {
    label: "Mensa / Catering",
    description: "Volumi elevati, prezzo prioritario, nessun vincolo hard",
    price_weight: 75,
    quality_weight: 15,
    delivery_weight: 10,
    required_certifications: [],
    prefer_bio: false,
    prefer_km0: false,
    lead_time_max_days: 5,
    min_order_max_eur: null,
    max_distance_km: null,
    categoryOverrides: {},
  },
};

export const PRESET_PROFILE_LABELS: Record<PresetProfile, string> = {
  custom: "Personalizzato",
  stellato: PRESET_PROFILES.stellato.label,
  trattoria: PRESET_PROFILES.trattoria.label,
  pizzeria: PRESET_PROFILES.pizzeria.label,
  bar: PRESET_PROFILES.bar.label,
  mensa: PRESET_PROFILES.mensa.label,
};
