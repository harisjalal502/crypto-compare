import { observer } from "mobx-react-lite"
import React, { useEffect, useMemo } from "react"
import {
  TouchableOpacity,
  FlatList,
  Image,
  ImageStyle,
  TextStyle,
  View,
  ViewStyle,
  StyleSheet,
  Platform,
  AccessibilityProps,
} from "react-native"
import { Button, Icon, Screen, Switch, Text } from "../components"
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { translate, isRTL } from "../i18n"
import { useStores } from "../models"
import { Episode } from "../models/Episode"
import { DemoTabScreenProps } from "../navigators/DemoNavigator"
import { colors, spacing } from "../theme"
import { delay } from "../utils/delay"
import { openLinkInBrowser } from "../utils/open-link-in-browser"

const ICON_SIZE = 24
const sadFace = require("../../assets/images/sad-face.png")

export const DemoPodcastListScreen = observer(function DemoPodcastListScreen(
  _props: DemoTabScreenProps<"DemoPodcastList">,
) {
  const { episodeStore } = useStores()

  const [refreshing, setRefreshing] = React.useState(false)

  // initially, kick off a background refresh without the refreshing UI
  useEffect(() => {
    episodeStore.fetchEpisodes()
  }, [episodeStore])

  // simulate a longer refresh, if the refresh is too fast for UX
  async function manualRefresh() {
    setRefreshing(true)
    await Promise.all([episodeStore.fetchEpisodes(), delay(750)])
    setRefreshing(false)
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]}>
      <FlatList<Episode>
        data={episodeStore.episodesForList}
        extraData={episodeStore.favorites.length + episodeStore.episodes.length}
        contentContainerStyle={$flatListContentContainer}
        refreshing={refreshing}
        onRefresh={manualRefresh}
        ListEmptyComponent={
          <View>
            <View style={$container}>
              {!episodeStore.favoritesOnly ? (
                <View>
                  <Text preset="subheading" style={$subheading}>
                    So empty... so sad
                  </Text>
                  <Text>No data found yet. You can click the button or reload the app.</Text>
                </View>
              ) : (
                <View>
                  <Text preset="subheading" style={$subheading}>
                    You don't have any favorites yet
                  </Text>
                  <Text>Please click the heart icon on each list to add it to your favorites.</Text>
                </View>
              )}
            </View>
            <View style={$buttonContainer}>
              <Button
                text="Go back to the list"
                onPress={() => episodeStore.setProp("favoritesOnly", !episodeStore.favoritesOnly)}
                style={$button}
              />
            </View>
            <View style={$sadFaceContainer}>
              <Image source={sadFace} style={$sadFace} resizeMode="contain" />
            </View>
          </View>
        }
        ListHeaderComponent={
          <View style={$heading}>
            <Text preset="heading" tx="demoPodcastListScreen.title" />
            <View style={[$rowLayout, $toggle]}>
              <Switch
                accessibilityLabel={translate("demoPodcastListScreen.accessibility.switch")}
                value={episodeStore.favoritesOnly}
                onToggle={() => episodeStore.setProp("favoritesOnly", !episodeStore.favoritesOnly)}
              />
              <Text style={$toggleText} tx="demoPodcastListScreen.onlyFavorites" />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <EpisodeCard
            episode={item}
            isFavorite={episodeStore.hasFavorite(item)}
            onPressFavorite={() => episodeStore.toggleFavorite(item)}
          />
        )}
      />
    </Screen>
  )
})

const EpisodeCard = observer(function EpisodeCard({
  episode,
  isFavorite,
  onPressFavorite,
}: {
  episode: Episode
  onPressFavorite: () => void
  isFavorite: boolean
}) {
  const liked = useSharedValue(isFavorite ? 1 : 0)

  // Grey heart
  const animatedLikeButtonStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(liked.value, [0, 1], [1, 0], Extrapolate.EXTEND),
        },
      ],
      opacity: interpolate(liked.value, [0, 1], [1, 0], Extrapolate.CLAMP),
    }
  })

  // Pink heart
  const animatedUnlikeButtonStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: liked.value,
        },
      ],
      opacity: liked.value,
    }
  })

  /**
   * Android has a "longpress" accessibility action. iOS does not, so we just have to use a hint.
   * @see https://reactnative.dev/docs/accessibility#accessibilityactions
   */
  const accessibilityHintProps = useMemo(
    () =>
      Platform.select<AccessibilityProps>({
        ios: {
          accessibilityHint: translate("demoPodcastListScreen.accessibility.cardHint", {
            action: isFavorite ? "unfavorite" : "favorite",
          }),
        },
        android: {
          accessibilityLabel: episode.title,
          accessibilityActions: [
            {
              name: "longpress",
              label: translate("demoPodcastListScreen.accessibility.favoriteAction"),
            },
          ],
          onAccessibilityAction: ({ nativeEvent }) => {
            if (nativeEvent.actionName === "longpress") {
              handlePressFavorite()
            }
          },
        },
      }),
    [episode, isFavorite],
  )

  const handlePressFavorite = () => {
    onPressFavorite()
    liked.value = withSpring(liked.value ? 0 : 1)
  }

  const handlePressCard = () => {
    openLinkInBrowser(episode.enclosure.link)
  }

  return (
    //  MAVERICKTODO: Switch this out for Card component when that is ready
    <TouchableOpacity
      style={[$rowLayout, $item]}
      onPress={handlePressCard}
      onLongPress={handlePressFavorite}
      // MAVERICKTODO: This button role should be set on the Card Component
      accessibilityRole="button"
      {...accessibilityHintProps}
    >
      <View style={$description}>
        <Text>{episode.title}</Text>
        <View style={[$rowLayout, $metadata]}>
          <Animated.View
            style={[$iconContainer, StyleSheet.absoluteFillObject, animatedLikeButtonStyles]}
          >
            <Icon
              icon="heart"
              size={ICON_SIZE}
              color={colors.palette.neutral800} // dark grey
              onPress={handlePressFavorite}
              accessibilityLabel={
                isFavorite
                  ? undefined
                  : translate("demoPodcastListScreen.accessibility.favoriteIcon")
              }
            />
          </Animated.View>
          <Animated.View style={[$iconContainer, animatedUnlikeButtonStyles]}>
            <Icon
              icon="heart"
              size={ICON_SIZE}
              color={colors.palette.primary400} // pink
              onPress={handlePressFavorite}
              accessibilityLabel={
                isFavorite
                  ? translate("demoPodcastListScreen.accessibility.unfavoriteIcon")
                  : undefined
              }
            />
          </Animated.View>
          <Text size="xs" accessibilityLabel={episode.datePublished.accessibilityLabel}>
            {episode.datePublished.textLabel}
          </Text>
          <Text size="xs" accessibilityLabel={episode.duration.accessibilityLabel}>
            {episode.duration.textLabel}
          </Text>
        </View>
      </View>
      <Image source={{ uri: episode.thumbnail }} style={$itemThumbnail} />
    </TouchableOpacity>
  )
})

// #region Styles
const THUMBNAIL_DIMENSION = 100

const $flatListContentContainer: ViewStyle = {
  paddingHorizontal: spacing.large,
  paddingTop: spacing.large,
}

const $heading: ViewStyle = {
  marginBottom: spacing.medium,
}

const $description: TextStyle = {
  flex: 1,
  justifyContent: "space-between",
}

const $item: ViewStyle = {
  backgroundColor: colors.palette.neutral100,
  borderRadius: 8,
  padding: spacing.medium,
  marginTop: spacing.medium,
}

const $rowLayout: ViewStyle = {
  flexDirection: "row",
}

const $toggle: ViewStyle = {
  alignItems: "center",
  marginTop: spacing.small,
}

const $toggleText: TextStyle = {
  marginStart: spacing.extraSmall,
}

const $iconContainer: ViewStyle = {
  height: ICON_SIZE,
  width: ICON_SIZE,
}

const $itemThumbnail: ImageStyle = {
  width: THUMBNAIL_DIMENSION,
  height: THUMBNAIL_DIMENSION,
  marginStart: spacing.extraSmall,
}

const $metadata: TextStyle = {
  justifyContent: "space-between",
  color: colors.textDim,
  marginTop: spacing.extraSmall,
}

const $sadFace: ImageStyle = {
  height: 169,
  width: 269,
  position: "absolute",
  bottom: -47,
  right: -80,
  transform: [{ scaleX: isRTL ? -1 : 1 }],
}

const $container: ViewStyle = {
  paddingVertical: spacing.large,
}

const $subheading: TextStyle = {
  paddingBottom: spacing.small,
}

const $buttonContainer: ViewStyle = {
  paddingBottom: spacing.huge,
}

const $button: ViewStyle = {
  marginVertical: spacing.huge,
}

const $sadFaceContainer: ViewStyle = {
  marginVertical: spacing.massive,
}
// #endregion
