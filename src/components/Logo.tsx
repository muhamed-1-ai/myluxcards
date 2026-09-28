import React from "react";
import { BrandLogo, BrandLogoProps } from "./BrandLogo";

export type LogoProps = BrandLogoProps;

export function Logo(props: LogoProps) {
  return <BrandLogo {...props} />;
}

export { BrandLogo };
export default Logo;
