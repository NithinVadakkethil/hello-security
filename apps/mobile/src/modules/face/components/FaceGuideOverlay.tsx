import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Ellipse, Defs, Mask } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FaceGuideOverlayProps {
  statusColor?: string;
  guideWidth?: number;
  guideHeight?: number;
}

export const FaceGuideOverlay: React.FC<FaceGuideOverlayProps> = ({
  statusColor = '#2563EB',
  guideWidth = SCREEN_WIDTH * 0.7,
  guideHeight = SCREEN_HEIGHT * 0.42,
}) => {
  const cx = SCREEN_WIDTH / 2;
  const cy = SCREEN_HEIGHT * 0.38;
  const rx = guideWidth / 2;
  const ry = guideHeight / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg height={SCREEN_HEIGHT} width={SCREEN_WIDTH}>
        <Defs>
          <Mask id="mask">
            {/* Background solid white rectangle */}
            <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="#ffffff" />
            {/* Cut out central face oval */}
            <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000000" />
          </Mask>
        </Defs>

        {/* Semi-transparent dark overlay around oval cut-out */}
        <Rect
          x="0"
          y="0"
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#mask)"
        />

        {/* Dynamic status-colored oval outline */}
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={statusColor}
          strokeWidth="3"
          strokeDasharray="8 6"
          fill="transparent"
        />
      </Svg>
    </View>
  );
};
