import { Modal } from '@nmd/ui';
import PlatformFeePreviewCalculator from './PlatformFeePreviewCalculator';
import type { PlatformFeeConfig, TenantPlatformFeeOverride } from '../../lib/platform-fee';

type Props = {
  open: boolean;
  onClose: () => void;
  storeName: string;
  marketFeeConfig?: PlatformFeeConfig | null;
  tenantFeeOverride?: TenantPlatformFeeOverride | null;
};

export default function PlatformFeePreviewModal({
  open,
  onClose,
  storeName,
  marketFeeConfig,
  tenantFeeOverride,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={`معاينة الرسوم — ${storeName}`}>
      <div className="pt-2">
        <PlatformFeePreviewCalculator
          marketFeeConfig={marketFeeConfig}
          tenantFeeOverride={tenantFeeOverride}
          title="معاينة الرسوم"
        />
      </div>
    </Modal>
  );
}
