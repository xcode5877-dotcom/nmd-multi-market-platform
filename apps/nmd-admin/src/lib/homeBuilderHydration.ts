import {
  homePageBlocksSnapshotKey,
  type HomePageBlock,
} from '../types/homePageBlock';

/** Dirty only after a successful hydration for the active market. */
export function isHomeBuilderDirty(
  working: HomePageBlock[],
  serverKey: string,
  hydrated: boolean,
): boolean {
  if (!hydrated) return false;
  return homePageBlocksSnapshotKey(working) !== serverKey;
}

/**
 * Decide whether the editor may replace local `working` from a successful query.
 * Blocks overwrite when:
 * - query succeeded, and
 * - we have not hydrated this market yet, OR local state is not dirty.
 */
export function shouldApplyHomeBuilderServerBlocks(opts: {
  querySuccess: boolean;
  marketSlug: string;
  hydratedSlug: string | null;
  isDirty: boolean;
}): boolean {
  if (!opts.querySuccess) return false;
  if (!opts.marketSlug.trim()) return false;
  const alreadyHydrated = opts.hydratedSlug === opts.marketSlug;
  if (alreadyHydrated && opts.isDirty) return false;
  return true;
}

/** Save is unsafe until hydration succeeded for the selected market. */
export function canSaveHomeBuilderLayout(opts: {
  hydrated: boolean;
  isDirty: boolean;
  savePending: boolean;
  validationErrorCount: number;
}): boolean {
  if (!opts.hydrated) return false;
  if (!opts.isDirty) return false;
  if (opts.savePending) return false;
  if (opts.validationErrorCount > 0) return false;
  return true;
}

/**
 * Empty layout saves require an intentional confirmation — never treat
 * failed hydration / never-loaded as an intentional empty layout.
 */
export function shouldConfirmEmptyHomeBuilderSave(opts: {
  hydrated: boolean;
  blockCount: number;
}): boolean {
  return opts.hydrated && opts.blockCount === 0;
}
