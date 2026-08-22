"use client";

import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export type PublicMediaLightboxSlide = {
  src: string;
  alt: string;
  title: string;
  description: string;
};

type PublicMediaLightboxProps = {
  index: number;
  slides: PublicMediaLightboxSlide[];
  reduceMotion: boolean;
  onClose: () => void;
};

export default function PublicMediaLightbox({ index, slides, reduceMotion, onClose }: PublicMediaLightboxProps) {
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Captions, Fullscreen, Zoom]}
      carousel={{ finite: slides.length < 2 }}
      controller={{ closeOnBackdropClick: true }}
      animation={reduceMotion ? { fade: 0, swipe: 0 } : undefined}
    />
  );
}
