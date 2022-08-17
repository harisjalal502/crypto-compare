import React, { useEffect } from "react"
import { Pressable, PressableProps, ViewStyle } from "react-native"
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated"
import type { SharedValue } from "react-native-reanimated"
import { colors } from "../../theme"

interface DrawerIconButtonProps extends PressableProps {
  open: boolean
  progress: SharedValue<number>
}

export function DrawerIconButton(props: DrawerIconButtonProps) {
  const { open, progress, ...PressableProps } = props

  const animatedContainerStyles = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [0, -60])
    return {
      transform: [{ translateX }],
    }
  })

  const animatedTopBarStyles = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(progress.value, [0, 1], [colors.text, colors.tint])
    const marginLeft = interpolate(progress.value, [0, 1], [0, -11.5])
    const topBarRotation = interpolate(progress.value, [0, 1], [0, -45])
    const marginBottom = interpolate(progress.value, [0, 1], [0, -2])
    const width = interpolate(progress.value, [0, 1], [18, 12])
    return {
      backgroundColor,
      marginLeft,
      marginBottom,
      width,
      transform: [{ rotate: `${topBarRotation}deg` }],
    }
  })

  const animatedMiddleBarStyles = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(progress.value, [0, 1], [colors.text, colors.tint])
    const width = interpolate(progress.value, [0, 1], [18, 16])
    return {
      backgroundColor,
      width,
    }
  })

  const animatedBottomBarStyles = useAnimatedStyle(() => {
    const marginTop = interpolate(progress.value, [0, 1], [4, 2])
    const backgroundColor = interpolateColor(progress.value, [0, 1], [colors.text, colors.tint])
    const marginLeft = interpolate(progress.value, [0, 1], [0, -11.5])
    const bottomBarRotation = interpolate(progress.value, [0, 1], [0, 45])
    const width = interpolate(progress.value, [0, 1], [18, 12])
    return {
      backgroundColor,
      marginLeft,
      width,
      marginTop,
      transform: [{ rotate: `${bottomBarRotation}deg` }],
    }
  })

  useEffect(() => {
    progress.value = withSpring(open ? 1 : 0)
  }, [open, progress])

  return (
    <Pressable {...PressableProps}>
      <Animated.View style={[$container, animatedContainerStyles]}>
        <Animated.View style={[$topBar, animatedTopBarStyles]} />

        <Animated.View style={[$middleBar, animatedMiddleBarStyles]} />

        <Animated.View style={[$bottomBar, animatedBottomBarStyles]} />
      </Animated.View>
    </Pressable>
  )
}

const barHeight = 2

const $container: ViewStyle = {
  alignItems: "center",
  height: 56,
  justifyContent: "center",
  width: 56,
}

const $topBar: ViewStyle = {
  height: barHeight,
}

const $middleBar: ViewStyle = {
  height: barHeight,
  marginTop: 4,
}

const $bottomBar: ViewStyle = {
  height: barHeight,
}
