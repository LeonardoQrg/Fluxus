// Íconos (los mismos trazos que el prototipo)
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

type IconProps = { size?: number; color?: string };

export function BackIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function EyeIcon({ size = 22, color = colors.textMuted, off }: IconProps & { off?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
      {off ? <Path d="M4 4l16 16" /> : null}
    </Svg>
  );
}

export function CheckIcon({ size = 30, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

/** Logo: dos cintas que suben y terminan en una flecha */
export function LogoMark({ size = 36, color = colors.accent }: IconProps) {
  return (
    <Svg width={(size * 2) / 3} height={size} viewBox="300 200 400 600">
      <Path
        d="M483 328 L565 220 L648 328 L620 328 C620 390 600 440 545 480 C480 525 400 560 382 620 C376 645 378 665 380 682 C345 655 325 615 330 570 C338 510 380 470 430 445 C490 415 515 385 520 328 Z"
        fill={color}
      />
      <Path
        d="M635 405 C662 435 672 480 655 520 C635 565 585 590 540 615 C495 640 475 680 480 720 C483 748 490 765 500 780 C460 770 420 740 410 695 C400 645 430 610 480 585 C540 555 595 530 620 485 C632 460 636 430 635 405 Z"
        fill={color}
      />
    </Svg>
  );
}

export function WalletIcon({ size = 22, color = colors.income }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11v3" />
      <Circle cx={16} cy={13.5} r={1.3} fill={color} />
    </Svg>
  );
}

export function CardIcon({ size = 22, color = colors.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Path d="M5 5.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
      <Path d="M3 10h18M7 15h4" />
    </Svg>
  );
}
