import Image from "next/image";

type PixelAvatarProps = {
  alt: string;
  backgroundColor: string;
  className?: string;
  src: string;
};

export function PixelAvatar({
  alt,
  backgroundColor,
  className,
  src,
}: PixelAvatarProps) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center overflow-hidden rounded-[18px] border border-black/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.36)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor }}
    >
      <Image
        alt={alt}
        className="h-full w-full object-cover"
        height={64}
        loading="lazy"
        src={src}
        unoptimized
        width={64}
      />
    </span>
  );
}
