import type { AssetClassId } from '@/data/assets';
import type { RouteId } from '@/engine/pillars';

/** Farba triedy aktív — usporiadaná škála, teplá pre riziko, chladná pre istotu. */
export const ASSET_COLOR: Record<AssetClassId, string> = {
  dm: 'var(--c-dm)',
  em: 'var(--c-em)',
  sc: 'var(--c-sc)',
  reit: 'var(--c-reit)',
  gold: 'var(--c-gold)',
  bond: 'var(--c-bond)',
  cash: 'var(--c-cash)',
};

/** Farba porovnávanej cesty — kategoriálna paleta overená na farbosleposť. */
export const ROUTE_COLOR: Record<RouteId, string> = {
  own: 'var(--c-own)',
  pillar2: 'var(--c-p2)',
  pillar3: 'var(--c-p3)',
};
