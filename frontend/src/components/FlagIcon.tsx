// Named imports (not `import * as Flags`) so the bundler only ships the ~150
// flags actually referenced in src/lib/countries.ts, not the package's full
// set of ~250.
import {
  AD, AE, AF, AL, AM, AO, AR, AT, AU, AZ,
  BA, BB, BD, BE, BF, BG, BH, BI, BJ, BN, BO, BR, BS, BT, BW, BY, BZ,
  CA, CH, CL, CM, CN, CO, CR, CU, CY, CZ,
  DE, DK, DO, DZ,
  EC, EE, EG, ES, ET,
  FI, FJ, FR,
  GB, GE, GH, GR, GT,
  HK, HN, HR, HT, HU,
  ID, IE, IL, IN, IQ, IR, IS, IT,
  JM, JO, JP,
  KE, KG, KH, KP, KR, KW, KZ,
  LA, LB, LI, LK, LT, LU, LV, LY,
  MA, MC, MD, ME, MG, MK, ML, MM, MN, MT, MV, MX, MY, MZ,
  NA, NG, NI, NL, NO, NP, NZ,
  OM,
  PA, PE, PG, PH, PK, PL, PT, PY,
  QA,
  RO, RS, RU, RW,
  SA, SD, SE, SG, SI, SK, SN, SV, SY,
  TH, TJ, TM, TN, TO, TR, TW, TZ,
  UA, UG, US, UY, UZ,
  VE, VN, VU,
  WS,
  YE,
  ZA, ZM, ZW,
} from 'country-flag-icons/react/3x2';

const FLAG_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  AD, AE, AF, AL, AM, AO, AR, AT, AU, AZ,
  BA, BB, BD, BE, BF, BG, BH, BI, BJ, BN, BO, BR, BS, BT, BW, BY, BZ,
  CA, CH, CL, CM, CN, CO, CR, CU, CY, CZ,
  DE, DK, DO, DZ,
  EC, EE, EG, ES, ET,
  FI, FJ, FR,
  GB, GE, GH, GR, GT,
  HK, HN, HR, HT, HU,
  ID, IE, IL, IN, IQ, IR, IS, IT,
  JM, JO, JP,
  KE, KG, KH, KP, KR, KW, KZ,
  LA, LB, LI, LK, LT, LU, LV, LY,
  MA, MC, MD, ME, MG, MK, ML, MM, MN, MT, MV, MX, MY, MZ,
  NA, NG, NI, NL, NO, NP, NZ,
  OM,
  PA, PE, PG, PH, PK, PL, PT, PY,
  QA,
  RO, RS, RU, RW,
  SA, SD, SE, SG, SI, SK, SN, SV, SY,
  TH, TJ, TM, TN, TO, TR, TW, TZ,
  UA, UG, US, UY, UZ,
  VE, VN, VU,
  WS,
  YE,
  ZA, ZM, ZW,
};

interface FlagIconProps {
  code?: string;
  className?: string;
}

// Renders nothing when there's no match — e.g. free text that isn't in the
// countries dataset — rather than a broken-flag placeholder.
export function FlagIcon({ code, className = 'h-4 w-5' }: FlagIconProps) {
  if (!code) return null;
  const Flag = FLAG_COMPONENTS[code];
  if (!Flag) return null;
  return <Flag className={`shrink-0 rounded-sm ${className}`} />;
}
