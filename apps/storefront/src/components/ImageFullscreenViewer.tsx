import { memo, useCallback, useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface ImageFullscreenViewerProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
  productName?: string;
}

function ImageFullscreenViewerInner({
  images,
  initialIndex,
  onClose,
  productName = '',
}: ImageFullscreenViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const currentImage = images[index] ?? images[0];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);
  const goNext = useCallback(() => {
    setIndex((i) => (i < images.length - 1 ? i + 1 : i));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goPrev();
      if (e.key === 'ArrowLeft') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (touchStart == null || touchEnd == null) return;
    const diff = touchStart - touchEnd;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="عرض الصورة بحجم كامل"
    >
      {/* Header: close button */}
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white/90 hover:bg-white/10 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-6 h-6" strokeWidth={2} />
        </button>
        <span className="text-white/70 text-sm">
          {index + 1} / {images.length}
        </span>
      </div>

      {/* Main image area - swipeable */}
      <div
        className="flex-1 flex items-center justify-center min-h-0 overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={currentImage}
          alt={productName ? `${productName} - صورة ${index + 1}` : `صورة ${index + 1}`}
          className="max-w-full max-h-full w-auto h-auto object-contain select-none"
          draggable={false}
          style={{ touchAction: 'pan-y' }}
        />
      </div>

      {/* Prev/Next buttons - RTL: prev=right, next=left */}
      {hasPrev && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute top-1/2 -translate-y-1/2 end-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label="الصورة السابقة"
        >
          <ChevronRight className="w-6 h-6" strokeWidth={2} />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={goNext}
          className="absolute top-1/2 -translate-y-1/2 start-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label="الصورة التالية"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2} />
        </button>
      )}

      {/* Thumbnails - optional, at bottom */}
      {images.length > 1 && (
        <div className="flex gap-2 p-4 overflow-x-auto justify-center flex-shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.slice(0, 8).map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                index === i ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ImageFullscreenViewer = memo(ImageFullscreenViewerInner);
