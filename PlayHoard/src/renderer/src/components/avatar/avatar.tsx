import { PersonIcon } from "@primer/octicons-react";
import { resolveImageUrl } from "@renderer/helpers";
import cn from "classnames";

import "./avatar.scss";

export interface AvatarProps
  extends Omit<
    React.DetailedHTMLProps<
      React.ImgHTMLAttributes<HTMLImageElement>,
      HTMLImageElement
    >,
    "src" | "color"
  > {
  size: number;
  src?: string | null;
  icon?: string | null;
  color?: string | null;
}

export function Avatar({
  size,
  alt,
  src,
  icon,
  color,
  className,
  ...props
}: AvatarProps) {
  const imageUrl = resolveImageUrl(src);

  return (
    <div
      className="profile-avatar"
      style={{ width: size, height: size, backgroundColor: color ?? undefined }}
    >
      {imageUrl ? (
        <img
          className={cn("profile-avatar__image", className)}
          alt={alt}
          src={imageUrl}
          width={size}
          height={size}
          {...props}
        />
      ) : icon ? (
        <span className="material-symbols-outlined profile-avatar__icon">
          {icon}
        </span>
      ) : (
        <PersonIcon size={size * 0.7} />
      )}
    </div>
  );
}
