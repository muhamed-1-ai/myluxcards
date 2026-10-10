import React from "react";
import { BrandLogo, BrandLogoProps, ZappitLogo, OFFICIAL_ZAPPIT_LOGO } from "./BrandLogo";

export type LogoProps = BrandLogoProps;

export function Logo(props: LogoProps) {
  return <BrandLogo {...props} />;
}

export { BrandLogo, ZappitLogo, OFFICIAL_ZAPPIT_LOGO };
export default Logo;
